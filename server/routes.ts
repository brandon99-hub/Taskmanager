import type { Express } from "express";
import { createServer, type Server } from "http";
import * as bcrypt from "bcryptjs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import {
  insertProjectSchema,
  insertBillingItemSchema,
  insertTeamSchema,
  insertTeamMemberSchema,
  insertNotificationSchema,
} from "../shared/schema";
import { z } from "zod";
import { generateExcelBuffer } from "./utils/excelExport";
import path from "path";
import { notificationService } from "./services/notificationService";
import { calendarService, GoogleCalendarService } from "./services/calendarService";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "../shared/schema";
import { registerMarketingRoutes } from "./routes/marketing";
import { registerRoleRoutes } from "./routes/roles";
import { registerTicketRoutes } from "./routes/tickets";
import { logProjectAction, logUserManagementAction, logTeamAction, logBillingItemAction, logInvoiceAction } from "./middleware/comprehensiveAudit";
import { userHasPermission, requirePermission } from "./utils/permissions";

// Utility function for date validation and conversion
function validateAndConvertDates(data: any, dateFields: string[]): { cleanedData: any; errors: string[] } {
  const cleanedData = { ...data };
  const errors: string[] = [];
  
  for (const field of dateFields) {
    if (data[field] !== undefined) {
      if (data[field]) {
        const date = new Date(data[field]);
        if (isNaN(date.getTime())) {
          errors.push(`Invalid ${field} format`);
        } else {
          cleanedData[field] = date;
        }
      } else {
        cleanedData[field] = null;
      }
    }
  }
  
  return { cleanedData, errors };
}

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    // Run initial automation checks on server startup
    console.log('Running initial automation checks...');
    try {
      await storage.checkContractExpirations();
      console.log('Initial automation checks completed successfully');
    } catch (error) {
      console.error('Error in initial automation checks:', error);
    }

    // Set up periodic automation checks (every 6 hours)
    const automationInterval = setInterval(async () => {
      try {
        console.log('Running periodic automation checks...');
        await storage.checkContractExpirations();
        console.log('Periodic automation checks completed successfully');
      } catch (error) {
        console.error('Error in periodic automation checks:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours in milliseconds

    // Store interval reference for cleanup if needed
    (app as any).automationInterval = automationInterval;
    // Auth middleware
    await setupAuth(app);
  } catch (error) {
    throw error;
  }

  // Auth routes are now handled in setupAuth

  // Marketing Pipeline Routes
  registerMarketingRoutes(app);

  // Dynamic RBAC: roles & permissions management (bootstrap-gated, see routes/roles.ts)
  registerRoleRoutes(app);

  // Tickets / SLA support + service categories
  registerTicketRoutes(app);

  // Comprehensive Audit Middleware - Apply to all routes
  const { comprehensiveAuditMiddleware } = await import('./middleware/comprehensiveAudit');
  app.use(comprehensiveAuditMiddleware());

  // Users listing (for selecting team members)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const role = (req.query.role as string) || undefined;
      const q = (req.query.q as string) || undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const users = await storage.getUsers({ role, q, limit, offset });
      const ticketCounts = await storage.getUserTicketCounts();
      const usersWithCounts = users.map((u) => ({
        ...u,
        openTicketCount: ticketCounts[u.id]?.open ?? 0,
        resolvedTicketCount: ticketCounts[u.id]?.resolved ?? 0,
      }));
      res.json(usersWithCounts);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Create a new employee user (dynamic RBAC role, sends invite email with temp password)
  app.post('/api/users', isAuthenticated, logUserManagementAction('create'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const { email, firstName, lastName, roleId } = req.body || {};
      if (!email || !firstName || !lastName) {
        return res.status(400).json({ message: 'Email, first name and last name are required' });
      }

      const existing = await storage.getUserByEmail(String(email).trim().toLowerCase());
      if (existing) {
        return res.status(409).json({ message: 'A user with this email already exists' });
      }

      const { user, temporaryPassword } = await storage.createUserWithRole(
        { email: String(email).trim().toLowerCase(), firstName, lastName, roleId: roleId || null },
        req.user.id
      );

      const { emailService } = await import('./services/emailService');
      const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;
      await emailService.sendUserCredentialsEmail({
        to: user.email,
        userName: (user.firstName && user.lastName) ? `${user.firstName} ${user.lastName}` : user.email,
        temporaryPassword,
        loginUrl: `${baseUrl}/login`,
      });

      res.status(201).json({ user, message: 'User created and invite email sent' });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  // Edit an employee's name/email
  app.put('/api/users/:id', isAuthenticated, logUserManagementAction('update'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const { firstName, lastName, email } = req.body || {};
      const user = await storage.updateUserProfile(req.params.id, { firstName, lastName, email });
      res.json(user);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  // Admin-triggered password reset: generates a new temp password and emails it
  app.post('/api/users/:id/reset-password', isAuthenticated, logUserManagementAction('update'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const temporaryPassword = Math.random().toString(36).slice(-8);
      await storage.updateUserPassword(user.id, temporaryPassword, true);

      const { emailService } = await import('./services/emailService');
      const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;
      await emailService.sendUserCredentialsEmail({
        to: user.email,
        userName: (user.firstName && user.lastName) ? `${user.firstName} ${user.lastName}` : user.email,
        temporaryPassword,
        loginUrl: `${baseUrl}/login`,
      });

      res.json({ message: 'Password reset and new credentials sent' });
    } catch (error) {
      console.error('Error resetting user password:', error);
      res.status(500).json({ message: 'Failed to reset password' });
    }
  });

  // Activate/deactivate an employee (soft delete - preserves ticket/project history)
  app.patch('/api/users/:id/status', isAuthenticated, logUserManagementAction('update'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const { isActive } = req.body || {};
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'isActive (boolean) is required' });
      }
      const user = await storage.setUserActive(req.params.id, isActive);
      res.json(user);
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({ message: 'Failed to update user status' });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/metrics', isAuthenticated, async (req: any, res) => {
    try {
      let metrics;
      
      // Get user's dashboard role to determine which metrics to fetch
      const dashboardRole = await storage.getUserDashboardRole(req.user.id);
      
      console.log('User dashboard role:', dashboardRole);
      console.log('User role:', req.user.role);
      
      if (dashboardRole.assignedSegment) {
        // Segment leader - get segment-specific metrics
        metrics = await storage.getDashboardMetricsForSegment(dashboardRole.assignedSegment);
      } else if (req.user.role === 'employee') {
        // Employee - get user-specific metrics
        metrics = await storage.getDashboardMetricsForUser(req.user.id);
      } else {
        // Admin, manager, project manager, finance head - get global metrics
        metrics = await storage.getDashboardMetrics();
      }
      
      console.log('Sending metrics to client:', metrics);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get('/api/dashboard/workload', isAuthenticated, async (req: any, res) => {
    try {
      const workload = req.user.role === 'employee'
        ? await storage.getTeamWorkloadForUserTeams(req.user.id)
        : await storage.getTeamWorkload();
      res.json(workload);
    } catch (error) {
      console.error("Error fetching team workload:", error);
      res.status(500).json({ message: "Failed to fetch team workload" });
    }
  });

  // User assignments across all teams/projects
  app.get('/api/users/:id/assignments', isAuthenticated, async (req: any, res) => {
    try {
      // Allow user to view own assignments or admins/managers
      const canView = req.user.id === req.params.id || (await userHasPermission(req.user, 'users.manage'));
      if (!canView) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const data = await storage.getUserAssignments(req.params.id);
      res.json(data);
    } catch (error) {
      console.error('Error fetching user assignments:', error);
      res.status(500).json({ message: 'Failed to fetch user assignments' });
    }
  });

  // Combined overdue billing items endpoint, organized by project
  // (previously also included overdue modules/subtasks - those concepts were removed)
  app.get('/api/dashboard/overdue-combined', isAuthenticated, async (req: any, res) => {
    try {
      const { db } = await import('./db');
      const { billingItems, projects, users } = await import('../shared/schema');
      const { eq, and, sql } = await import('drizzle-orm');

      const now = new Date();

      const overdueBillingItems = await db
        .select({
          id: billingItems.id,
          name: billingItems.name,
          description: billingItems.description,
          feeAmount: billingItems.feeAmount,
          billingStatus: billingItems.billingStatus,
          expectedInvoiceDate: billingItems.expectedInvoiceDate,
          expectedCollectionDate: billingItems.expectedCollectionDate,
          paymentReceivedAt: billingItems.paymentReceivedAt,
          projectId: billingItems.projectId,
          projectDbId: projects.id,
          projectName: projects.name,
          projectClient: projects.client,
          projectContactEmail: projects.contactEmail,
          projectSegmentId: projects.segmentId,
          projectStatus: projects.status,
          userId: users.id,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
        })
        .from(billingItems)
        .leftJoin(projects, eq(billingItems.projectId, projects.id))
        .leftJoin(users, eq(billingItems.createdById, users.id))
        .where(
          and(
            sql`${billingItems.expectedCollectionDate} < ${now}`,
            sql`${billingItems.billingStatus} != 'paid'`
          )
        );

      const transformedBillingItems = overdueBillingItems.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        feeAmount: item.feeAmount,
        billingStatus: item.billingStatus,
        expectedInvoiceDate: item.expectedInvoiceDate,
        expectedCollectionDate: item.expectedCollectionDate,
        paymentReceivedAt: item.paymentReceivedAt,
        projectId: item.projectId,
        type: 'billing_item',
        project: {
          id: item.projectDbId,
          name: item.projectName,
          client: item.projectClient,
          contactEmail: item.projectContactEmail,
          segmentId: item.projectSegmentId,
          status: item.projectStatus,
        },
        createdBy: {
          id: item.userId,
          firstName: item.userFirstName,
          lastName: item.userLastName,
          email: item.userEmail,
        }
      }));

      const projectGroups: { [key: string]: { project: any; billingItems: any[] } } = {};
      transformedBillingItems.forEach(item => {
        const projectId = item.projectId;
        if (!projectGroups[projectId]) {
          projectGroups[projectId] = { project: item.project, billingItems: [] };
        }
        projectGroups[projectId].billingItems.push(item);
      });

      const result = Object.values(projectGroups).map(group => ({
        project: group.project,
        billingItems: group.billingItems,
        totalOverdue: group.billingItems.length
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching combined overdue items:", error);
      res.status(500).json({ message: "Failed to fetch combined overdue items" });
    }
  });

  // Kanban billing items endpoint (previously kanban-tasks/kanban-subtasks for modules/subtasks)
  app.get('/api/dashboard/kanban-billing-items', isAuthenticated, async (req: any, res) => {
    try {
      const items = await storage.getDashboardKanbanBillingItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching kanban billing items:", error);
      res.status(500).json({ message: "Failed to fetch kanban billing items" });
    }
  });

  // Best performing team endpoint
  app.get('/api/dashboard/best-team', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'reports.view'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const bestTeam = await storage.getBestPerformingTeam();
      res.json(bestTeam);
    } catch (error) {
      console.error("Error fetching best team:", error);
      res.status(500).json({ message: "Failed to fetch best team" });
    }
  });

  // Teams count for user
  app.get('/api/dashboard/teams-count', isAuthenticated, async (req: any, res) => {
    try {
      const count = await storage.getTeamsCountForUser(req.user.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching teams count:", error);
      res.status(500).json({ message: "Failed to fetch teams count" });
    }
  });

  // Invoice report endpoint
  app.get('/api/dashboard/invoice-report', isAuthenticated, async (req: any, res) => {
    try {

      process.stdout.write('🔥🔥🔥 ROUTE HANDLER EXECUTED! 🔥🔥🔥\n');
      
      if (!(await userHasPermission(req.user, 'reports.view'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;

      const invoiceData = await storage.getInvoiceReport(year, month);
      res.json(invoiceData);
    } catch (error) {
      console.error("Error fetching invoice report:", error);
      res.status(500).json({ message: "Failed to fetch invoice report" });
    }
  });

  // Monthly targets calculation endpoint
  app.post('/api/dashboard/calculate-monthly-targets', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'reports.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const year = parseInt(req.body.year) || new Date().getFullYear();
      await storage.calculateMonthlyTargets(year);
      res.json({ message: 'Monthly targets calculated successfully' });
    } catch (error) {
      console.error("Error calculating monthly targets:", error);
      res.status(500).json({ message: "Failed to calculate monthly targets" });
    }
  });

  // Monthly progress comparison endpoint
  app.get('/api/dashboard/monthly-progress', isAuthenticated, async (req: any, res) => {
    try {
      const progressData = await storage.getMonthlyProgressComparison();
      res.json(progressData);
    } catch (error) {
      console.error("Error fetching monthly progress:", error);
      res.status(500).json({ message: "Failed to fetch monthly progress" });
    }
  });

  // Completed milestones (billing items) endpoint for modal
  app.get('/api/dashboard/completed-milestones', isAuthenticated, async (req: any, res) => {
    try {
      const allBillingItems = req.user.role === 'employee'
        ? await storage.getBillingItemsForUser(req.user.id)
        : await storage.getBillingItems();

      const completed = allBillingItems.filter(item => item.billingStatus === 'paid');

      const projectTotalCounts: Record<string, number> = {};
      const projectTotalValues: Record<string, number> = {};
      for (const item of allBillingItems) {
        projectTotalCounts[item.projectId] = (projectTotalCounts[item.projectId] || 0) + 1;
        projectTotalValues[item.projectId] = (projectTotalValues[item.projectId] || 0) + Number(item.feeAmount || 0);
      }

      const transformedMilestones = completed.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        feeAmount: item.feeAmount,
        billingStatus: item.billingStatus,
        expectedInvoiceDate: item.expectedInvoiceDate,
        expectedCollectionDate: item.expectedCollectionDate,
        paymentReceivedAt: item.paymentReceivedAt,
        projectId: item.projectId,
        project: {
          id: item.project.id,
          name: item.project.name,
          client: item.project.client,
          contactEmail: item.project.contactEmail,
          segmentId: item.project.segmentId,
          status: item.project.status,
          totalMilestones: projectTotalCounts[item.projectId] || 0,
          totalProjectValue: projectTotalValues[item.projectId] || 0,
        },
      }));

      res.json({
        milestones: transformedMilestones,
        systemTotalMilestones: allBillingItems.length
      });
    } catch (error) {
      console.error("Error fetching completed milestones:", error);
      res.status(500).json({ message: "Failed to fetch completed milestones" });
    }
  });

  // Export routes
  app.post('/api/reports/export', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'reports.view'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { reportType, format = 'excel', filters = {} } = req.body;
      

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const reportNames = {
        projects: 'Project Summary',
        milestones: 'Milestone List', 
        performance: 'Team Performance',
        workload: 'Workload Analysis',
        financial: 'Financial Report',
        complete: 'Complete Report',
        gantt: 'Gantt Chart'
      };
      
      const reportName = reportNames[reportType as keyof typeof reportNames] || 'Report';
      const fileExtension = format === 'pdf' ? 'pdf' : 'xlsx';
      const filename = `AppKings Solutions Limited - ${reportName} - ${timestamp}.${fileExtension}`;

      // Get export data based on report type
      let exportData;
      switch (reportType) {
        case 'projects':
          exportData = {
            projects: await getProjectsExportData(storage, filters),
            milestones: await getMilestonesExportData(storage, filters)
          };
          break;
        case 'milestones':
          exportData = await getMilestonesExportData(storage, filters);
          break;
        case 'performance':
          exportData = await getPerformanceExportData(storage, filters);
          break;
        case 'workload':
          exportData = await getWorkloadExportData(storage, filters);
          break;
        case 'financial':
          exportData = {
            financial: await getFinancialExportData(storage, filters),
            milestones: await getMilestonesExportData(storage, filters)
          };
          break;
        case 'complete':
          exportData = await getCompleteExportData(storage, filters);
          break;
        case 'gantt':
          exportData = await getGanttExportData(storage, filters);
          break;
        default:
          return res.status(400).json({ message: 'Invalid report type' });
      }

      // Handle different formats
      if (format === 'json') {
        // Return JSON data for detailed view
        console.log('Returning JSON data for report type:', reportType, 'Data length:', Array.isArray(exportData) ? exportData.length : 'Not an array');
        
        // For projects report, return structured data with projects and milestones
        if (reportType === 'projects' && typeof exportData === 'object' && exportData.projects && exportData.milestones) {
          res.json(exportData);
        }
        // For financial report, only return the financial array
        else if (reportType === 'financial' && typeof exportData === 'object' && exportData.financial) {
          res.json(exportData.financial);
        }
        // For complete report, return only the projects array (most comprehensive view)
        else if (reportType === 'complete' && typeof exportData === 'object' && exportData.projects) {
          res.json(exportData.projects);
        }
        // Ensure we always return an array for other reports
        else if (Array.isArray(exportData)) {
          res.json(exportData);
        } else if (typeof exportData === 'object' && exportData !== null) {
          // Flatten object data into array
          const jsonData: any[] = [];
          Object.values(exportData).forEach((section: any) => {
            if (Array.isArray(section)) {
              jsonData.push(...section);
            }
          });
          res.json(jsonData);
        } else {
          res.json([]);
        }
      } else if (reportType === 'gantt') {
        // Generate Excel buffer for Gantt Chart only
        const templatePath = path.join(__dirname, 'templates', 'gantt-chart(2).xlsx');
        const excelBuffer = generateExcelBuffer({
          filename,
          data: exportData,
          reportType,
          templatePath,
          templateSheetName: undefined
        });

        // Set response headers for Excel download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', excelBuffer.length);

        // Send the Excel file
        res.send(excelBuffer);
      } else {
        // Generate PDF for all other report types
        const { generatePDFBuffer } = await import('./utils/pdfExport');
        const pdfBuffer = await generatePDFBuffer({
          filename,
          data: exportData,
          reportType
        });

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send the PDF file
        res.send(pdfBuffer);
      }

    } catch (error: any) {
      console.error('Export error:', error);
      console.error('Error details:', {
        message: error?.message || 'Unknown error',
        stack: error?.stack,
        reportType: req.body?.reportType || 'unknown',
        format: req.body?.format || 'unknown'
      });
      res.status(500).json({ 
        message: 'Failed to generate export',
        error: error?.message || 'Unknown error',
        reportType: req.body?.reportType || 'unknown',
        format: req.body?.format || 'unknown'
      });
    }
  });

  // Team routes
  app.get('/api/teams', isAuthenticated, async (req: any, res) => {
    try {
      const segment = req.query.segment as string;
      
      let teams;
      if (req.user.role === 'employee') {
        teams = await storage.getTeamsForUser(req.user.id);
      } else {
        teams = await storage.getTeams();
      }
      
      // Filter teams by segment if specified
      if (segment && ['academic', 'parastals', 'private'].includes(segment)) {
        teams = teams.filter(team => team.segment === segment);
      }
      
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  // Segment leaders route
  app.get('/api/segment-leaders/:segment', isAuthenticated, async (req: any, res) => {
    try {
      const { segment: segmentId } = req.params;
      const validSegments = await storage.getSegments();
      if (!validSegments.some(s => s.id === segmentId)) {
        return res.status(400).json({ message: 'Invalid segment' });
      }

      const leader = await storage.getSegmentLeader(segmentId);
      res.json(leader);
    } catch (error) {
      console.error("Error fetching segment leader:", error);
      res.status(500).json({ message: "Failed to fetch segment leader" });
    }
  });

  // Set (or clear) a single sector's leader, by picking an existing user
  app.put('/api/segment-leaders/:segmentId', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'segments.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { segmentId } = req.params;
      const validSegments = await storage.getSegments();
      if (!validSegments.some(s => s.id === segmentId)) {
        return res.status(400).json({ message: 'Invalid segment' });
      }

      const { leaderId } = req.body || {};

      if (!leaderId) {
        await storage.setSegmentLeader(segmentId, null);
        return res.json({ message: 'Sector leader cleared' });
      }

      const leaderUser = await storage.getUser(leaderId);
      if (!leaderUser) {
        return res.status(400).json({ message: 'Leader user not found' });
      }

      await storage.setSegmentLeader(segmentId, {
        leaderId: leaderUser.id,
        leaderName: leaderUser.firstName && leaderUser.lastName
          ? `${leaderUser.firstName} ${leaderUser.lastName}`
          : leaderUser.email,
        leaderEmail: leaderUser.email,
      });

      res.json({ message: 'Sector leader updated' });
    } catch (error) {
      console.error("Error setting sector leader:", error);
      res.status(500).json({ message: "Failed to set sector leader" });
    }
  });

  // Save segment leaders route
  app.post('/api/segment-leaders', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'segments.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { leaders, financeEmail, accountManagerEmail } = req.body;

      if (!Array.isArray(leaders)) {
        return res.status(400).json({ message: 'leaders must be an array of { segmentId, leaderEmail, leaderName }' });
      }

      const validSegments = await storage.getSegments();
      const validSegmentIds = new Set(validSegments.map(s => s.id));
      for (const leader of leaders) {
        if (!leader.segmentId || !validSegmentIds.has(leader.segmentId)) {
          return res.status(400).json({ message: `Invalid segmentId: ${leader.segmentId}` });
        }
      }

      // Update segment leaders in database
      await storage.updateSegmentLeaders({
        leaders,
        financeEmail,
        accountManagerEmail
      });

      res.json({ message: 'Segment leaders updated successfully' });
    } catch (error) {
      console.error("Error updating segment leaders:", error);
      res.status(500).json({ message: "Failed to update segment leaders" });
    }
  });

  // Get finance and account manager emails route
  app.get('/api/system-config/emails', isAuthenticated, async (req: any, res) => {
    try {
      const emails = await storage.getFinanceAndAccountManagerEmails();
      res.json(emails);
    } catch (error) {
      console.error("Error fetching emails:", error);
      res.status(500).json({ message: "Failed to fetch emails" });
    }
  });

  // Admin Role Management Routes
  // Get all admin roles
  app.get('/api/admin/roles', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const adminRoles = await storage.getAdminRoles();
      res.json(adminRoles);
    } catch (error) {
      console.error("Error fetching admin roles:", error);
      res.status(500).json({ message: "Failed to fetch admin roles" });
    }
  });

  // Get admin roles for a specific user
  app.get('/api/admin/roles/user/:userId', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { userId } = req.params;
      const adminRoles = await storage.getAdminRolesByUser(userId);
      res.json(adminRoles);
    } catch (error) {
      console.error("Error fetching user admin roles:", error);
      res.status(500).json({ message: "Failed to fetch user admin roles" });
    }
  });

  // Assign admin role to user
  app.post('/api/admin/roles', isAuthenticated, logUserManagementAction('create'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { userId, roleType, segment } = req.body;
      
      if (!userId || !roleType) {
        return res.status(400).json({ message: 'User ID and role type are required' });
      }
      
      if (!['segment_leader'].includes(roleType)) {
        return res.status(400).json({ message: 'Invalid role type' });
      }

      if (roleType === 'segment_leader' && !segment) {
        return res.status(400).json({ message: 'Segment is required for segment leader role' });
      }

      if (roleType === 'segment_leader' && !['academic', 'parastals', 'private'].includes(segment)) {
        return res.status(400).json({ message: 'Invalid segment' });
      }

      const adminRole = await storage.assignAdminRole({
        userId,
        roleType,
        segment: roleType === 'segment_leader' ? segment : undefined,
        assignedBy: req.user.id,
      });
      
      res.status(201).json(adminRole);
    } catch (error) {
      console.error("Error assigning admin role:", error);
      if (error instanceof Error && error.message.includes('already has this admin role')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to assign admin role" });
    }
  });

  // Remove admin role from user
  app.delete('/api/admin/roles/:userId/:roleType', isAuthenticated, logUserManagementAction('delete'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { userId, roleType } = req.params;
      const { segment } = req.query;
      
      if (!['segment_leader'].includes(roleType)) {
        return res.status(400).json({ message: 'Invalid role type' });
      }

      await storage.removeAdminRole(userId, roleType as any, segment as string);
      res.json({ message: 'Admin role removed successfully' });
    } catch (error) {
      console.error("Error removing admin role:", error);
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to remove admin role" });
    }
  });

  // Get user's dashboard role (for role-based dashboard)
  app.get('/api/user/dashboard-role', isAuthenticated, async (req: any, res) => {
    try {
      const dashboardRole = await storage.getUserDashboardRole(req.user.id);
      res.json(dashboardRole);
    } catch (error) {
      console.error("Error fetching user dashboard role:", error);
      res.status(500).json({ message: "Failed to fetch user dashboard role" });
    }
  });



  // Get all segment leader data (for dashboard)
  app.get('/api/admin/segment-leader-data', isAuthenticated, async (req: any, res) => {
    try {
      const segmentData = await storage.getSegmentLeaderData();
      res.json(segmentData);
    } catch (error) {
      console.error("Error fetching segment leader data:", error);
      res.status(500).json({ message: "Failed to fetch segment leader data" });
    }
  });

  // Create user with admin credentials (idempotent upsert)
  app.post('/api/admin/users', isAuthenticated, logUserManagementAction('create'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { email, firstName, lastName, role, segment } = req.body;
      
      if (!email || !firstName || !lastName || !role) {
        return res.status(400).json({ message: 'Email, first name, last name, and role are required' });
      }
      
      if (!['segment_leader'].includes(role)) {
        return res.status(400).json({ message: 'Invalid admin role' });
      }
      
      if (role === 'segment_leader' && !segment) {
        return res.status(400).json({ message: 'Segment is required for segment leader role' });
      }
      
      // Upsert user by email
      const existing = await storage.getUserByEmail(String(email).trim().toLowerCase());
      let user: any;
      let temporaryPassword: string | undefined;
      const now = new Date();

      if (existing) {
        // Update names only, no email send
        await db.update(users).set({ firstName, lastName, updatedAt: now } as any).where(eq(users.id, existing.id));
        user = { ...existing, firstName, lastName };
      } else {
        // Create new user and send credentials
      const result = await storage.createUserWithCredentials(
        { email, firstName, lastName, role, segment },
        req.user.id
      );
        user = result.user;
        temporaryPassword = result.temporaryPassword;
      }

      // Ensure admin role assignment (idempotent) and base role admin
      await storage.assignAdminRole({
        userId: user.id,
        roleType: role,
        segment: role === 'segment_leader' ? segment : undefined,
        assignedBy: req.user.id,
      } as any);

      // Only send email if newly created
      if (temporaryPassword) {
      const { notificationService } = await import('./services/notificationService');
      await notificationService.sendAdminRoleAssignedNotification({
          user,
        roleType: role,
        segment,
        assignedBy: req.user,
          temporaryPassword,
        });
        return res.status(201).json({ user, temporaryPassword, message: 'User created and credentials sent' });
      }

      return res.status(200).json({ user, message: 'User updated and role ensured' });
    } catch (error) {
      console.error("Error creating user with credentials:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Resend admin role email with new temporary password
  app.post('/api/admin/users/resend', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const { email, roleType, segment } = req.body || {};
      if (!email || !roleType) {
        return res.status(400).json({ message: 'Email and roleType are required' });
      }
      if (!['segment_leader', 'manager'].includes(roleType)) {
        return res.status(400).json({ message: 'Invalid roleType' });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: 'User not found for resend' });
      }
      // Generate a new temporary password and set mustChangePassword
      const temporaryPassword = Math.random().toString(36).slice(-8);
      await storage.updateUserPassword(user.id, temporaryPassword, true);

      // Re-send admin role assignment notification
      const { notificationService } = await import('./services/notificationService');
      await notificationService.sendAdminRoleAssignedNotification({
        user,
        roleType,
        segment,
        assignedBy: req.user,
        temporaryPassword,
      });
      return res.json({ message: 'Credentials re-sent with a new temporary password' });
    } catch (error) {
      console.error('Error resending admin credentials:', error);
      res.status(500).json({ message: 'Failed to resend credentials' });
    }
  });

  // Notification endpoints
  // Check finance deadlines and send warnings (billing items due for invoicing/collection soon)
  app.post('/api/notifications/finance-deadlines', isAuthenticated, logProjectAction('create'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'reports.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Get billing items due for invoicing/collection soon that aren't paid yet
      const allBillingItems = await storage.getBillingItems();
      const now = new Date();
      const dueBillingItems = allBillingItems.filter((item) => {
        if (item.billingStatus === 'paid') return false;
        const dueDate = item.expectedCollectionDate || item.expectedInvoiceDate;
        if (!dueDate) return false;
        const daysDiff = Math.ceil((new Date(dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= 7; // Due within 7 days
      });

      if (dueBillingItems.length === 0) {
        return res.json({ message: 'No upcoming payment deadlines' });
      }

      res.json({
        message: 'Finance deadline warnings sent successfully',
        milestonesCount: dueBillingItems.length
      });
    } catch (error) {
      console.error("Error sending finance deadline warnings:", error);
      res.status(500).json({ message: "Failed to send warnings" });
    }
  });

  // Password change endpoints
  // Check if user must change password
  app.get('/api/auth/must-change-password', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      res.json({ mustChangePassword: user?.mustChangePassword || false });
    } catch (error) {
      console.error("Error checking password change requirement:", error);
      res.status(500).json({ message: "Failed to check password requirement" });
    }
  });

  // Force password change
  app.post('/api/auth/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long' });
      }
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify current password (check both hashed password and temporary password)
      const { verifyPassword } = await import('./auth');
      const isValidHashedPassword = await verifyPassword(currentPassword, user.password);
      const isValidTemporaryPassword = user.temporaryPassword && user.temporaryPassword === currentPassword;
      const isValidCurrentPassword = isValidHashedPassword || isValidTemporaryPassword;
        
      if (!isValidCurrentPassword) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      
      // Update password (will be hashed in updateUserPassword)
      // Check if this is a forced password change (user must change password)
      const isFirstChange = user.mustChangePassword === true;
      await storage.updateUserPassword(req.user.id, newPassword, isFirstChange);
      
      // Log password change as system event
      const { auditService } = await import('./services/comprehensiveAuditService');
      await auditService.logSystemEvent({
        eventType: 'password_change',
        eventCategory: 'security',
        description: `User ${user.email} changed their password`,
        severity: 'info',
        metadata: {
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          wasTemporaryPassword: isValidTemporaryPassword
        }
      });
      
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.get('/api/teams/:id', isAuthenticated, async (req, res) => {
    try {
      // Handle "none" teamId case
      if (req.params.id === 'none') {
        return res.json({
          team: null,
          members: [],
          projects: [],
          totalTasks: 0
        });
      }
      
      const teamWithWorkload = await storage.getTeamWithWorkload(req.params.id);
      res.json(teamWithWorkload);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.post('/api/teams', isAuthenticated, logTeamAction('create'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'teams.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { members, ...rest } = req.body || {};
      const teamData = insertTeamSchema.parse(rest);
      const team = await storage.createTeam(teamData);

      // Add team members with specific roles
      const { roleAssignments } = req.body;
      
      if (roleAssignments) {
        const { bcDevs, consultants, portalDev, accountManager, projectLeader } = roleAssignments;
        
        if (Array.isArray(bcDevs) && bcDevs.length > 0) {
          for (const userId of bcDevs) {
            await storage.addTeamMember({ teamId: team.id, userId, role: 'BC Developer' });
          }
        }
        
        if (Array.isArray(consultants) && consultants.length > 0) {
          for (const userId of consultants) {
            await storage.addTeamMember({ teamId: team.id, userId, role: 'Functional Consultant' });
          }
        }
        
        if (portalDev) {
          await storage.addTeamMember({ teamId: team.id, userId: portalDev, role: 'Portal Developer' });
        }
        
        if (accountManager) {
          await storage.addTeamMember({ teamId: team.id, userId: accountManager, role: 'Account Manager' });
        }
        
        if (projectLeader && projectLeader !== 'segment_leader') {
          await storage.addTeamMember({ teamId: team.id, userId: projectLeader, role: 'Project Leader' });
        }
      }

      res.status(201).json(team);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid team data", errors: error.errors });
      }
      console.error("Error creating team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.put('/api/teams/:id', isAuthenticated, logTeamAction('update'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'teams.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const teamData = insertTeamSchema.partial().parse(req.body);
      const team = await storage.updateTeam(req.params.id, teamData);
      res.json(team);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid team data", errors: error.errors });
      }
      console.error("Error updating team:", error);
      res.status(500).json({ message: "Failed to update team" });
    }
  });



  // Milestone routes
  // Milestone routes (backed by billing items - see [[project-taskflow-rbac-tickets-rebuild]])
  app.get('/api/milestones', isAuthenticated, async (req: any, res) => {
    try {
      const milestones = req.user.role === 'employee'
        ? await storage.getBillingItemsForUser(req.user.id)
        : await storage.getBillingItems();
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  app.get('/api/milestones/:id', isAuthenticated, async (req: any, res) => {
    try {
      const milestone = await storage.getBillingItem(req.params.id);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      res.json(milestone);
    } catch (error) {
      console.error("Error fetching milestone:", error);
      res.status(500).json({ message: "Failed to fetch milestone" });
    }
  });

  // Project routes
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const { segmentId, status } = req.query;
      let projects = req.user.role === 'employee'
        ? await storage.getProjectsForUser(req.user.id)
        : await storage.getProjects();

      // Apply segment filter if provided
      if (segmentId) {
        const validSegments = await storage.getSegments();
        if (validSegments.some(s => s.id === segmentId)) {
          projects = projects.filter((p: any) => p.segmentId === segmentId);
        }
      }

      // Apply status filter if provided
      if (status && ['planning', 'active', 'on_hold', 'completed', 'cancelled', 'terminated', 'on_support'].includes(status as string)) {
        projects = projects.filter((p: any) => p.status === status);
      }
      
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Batch API endpoint to reduce rate limiting
  app.post('/api/batch', isAuthenticated, async (req: any, res) => {
    try {
      const { queries } = req.body;
      
      if (!Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: 'Invalid batch request' });
      }

      // Limit batch size to prevent abuse
      if (queries.length > 70) {
        return res.status(400).json({ error: 'Batch size too large' });
      }

      const results = await Promise.allSettled(
        queries.map(async (query: { url: string; key: string }) => {
          try {
            // Parse the URL to determine what data to fetch
            const url = query.url;
            
            if (url.includes('/api/projects') && !url.includes('/api/projects/')) {
              // Get all projects
              const urlObj = new URL(url, 'http://localhost');
              const segment = urlObj.searchParams.get('segment');
              const status = urlObj.searchParams.get('status');
              let projects = req.user.role === 'employee'
                ? await storage.getProjectsForUser(req.user.id)
                : await storage.getProjects();
              
              if (segment) projects = projects.filter((p: any) => p.segmentId === segment);
              if (status) projects = projects.filter((p: any) => p.status === status);
              
              return { data: projects };
            } else if (url.match(/\/api\/projects\/[\w-]+$/)) {
              // Get single project by ID
              const match = url.match(/\/api\/projects\/([^\/]+)$/);
              if (match && match[1]) {
                const projectId = match[1];
                try {
                  const project = await storage.getProject(projectId);
                  return { data: project || null };
                } catch (error) {
                  return { error: error instanceof Error ? error.message : 'Failed to load project' };
                }
              } else {
                return { error: 'Invalid project ID' };
              }
            } else if (url.includes('/api/milestones')) {
              // Get all milestones (billing items)
              const milestones = await storage.getBillingItems();
              return { data: milestones };
            } else if (url.includes('/api/dashboard/metrics')) {
              // Get dashboard metrics
              const metrics = await storage.getDashboardMetrics();
              return { data: metrics };
            } else if (url.includes('/api/dashboard/workload')) {
              // Get workload data - fallback to empty array if method doesn't exist
              try {
                const workload = await (storage as any).getWorkloadData();
                return { data: workload || [] };
              } catch {
                return { data: [] };
              }
            } else if (url.includes('/api/dashboard/kanban-subtasks')) {
              // Get kanban subtasks - fallback to empty object if method doesn't exist
              try {
                const subtasks = await (storage as any).getKanbanSubtasks();
                return { data: subtasks || {} };
              } catch {
                return { data: {} };
              }
            } else if (url.includes('/api/tasks')) {
              // Legacy alias - no more standalone tasks concept, return billing items
              const tasks = await storage.getBillingItems();
              return { data: tasks };
            } else if (url.includes('/api/projects') && url.includes('/gantt')) {
              // Get Gantt chart data for a project (billing-item backed)
              const match = url.match(/\/api\/projects\/([^\/]+)\/gantt/);
              if (match && match[1]) {
                const projectId = match[1];
                try {
                const project = await storage.getProject(projectId);
                const billingItemsForProject = await storage.getBillingItemsByProject(projectId);

                const billingProgress = (billingStatus: string | null | undefined): number => {
                  switch (billingStatus) {
                    case 'sent': return 50;
                    case 'processing': return 75;
                    case 'paid': return 100;
                    case 'overdue': return 25;
                    default: return 0;
                  }
                };

                const ganttData = {
                  project: {
                    id: project?.id || projectId,
                    name: project?.name || 'Unknown Project',
                    startDate: project?.startDate || new Date().toISOString(),
                    endDate: project?.endDate || new Date().toISOString()
                  },
                  phases: [] as any[],
                  tasks: billingItemsForProject.map((item) => ({
                    id: item.id,
                    name: item.name,
                    startDate: item.expectedInvoiceDate,
                    dueDate: item.expectedCollectionDate || item.expectedInvoiceDate,
                    status: item.billingStatus === 'paid' ? 'done' : 'in_progress',
                    progress: billingProgress(item.billingStatus),
                    priority: item.overdueFlag ? 'high' : 'medium',
                    assignedUser: undefined,
                    subtasks: [],
                  }))
                };
                return { data: ganttData };
              } catch (error) {
                return { error: error instanceof Error ? error.message : 'Failed to load Gantt data' };
              }
            } else {
              return { error: 'Invalid project ID in gantt query' };
            }
          } else if (url.includes('/api/projects') && url.includes('/milestones')) {
              // Get milestones (billing items) for a project
              const match = url.match(/\/api\/projects\/([^\/]+)\/milestones/);
              if (match && match[1]) {
                const projectId = match[1];
                try {
                  const milestones = await storage.getBillingItemsByProject(projectId);
                  return { data: milestones || [] };
                } catch (error) {
                  return { error: error instanceof Error ? error.message : 'Failed to load milestones' };
                }
              } else {
                return { error: 'Invalid project ID in milestones query' };
              }
            } else {
              return { error: 'Unsupported batch query' };
            }
          } catch (error) {
            return { error: error instanceof Error ? error.message : 'Unknown error' };
          }
        })
      );

      const batchResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return { error: result.reason?.message || 'Request failed' };
        }
      });

      res.json({ results: batchResults });
    } catch (error) {
      console.error('Batch request error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Comprehensive dashboard data endpoint (reduces multiple API calls)
  app.get('/api/dashboard/complete', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'reports.view'))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const [projects, milestones, metrics, workload, subtasks] = await Promise.allSettled([
        storage.getProjects(),
        storage.getBillingItems(),
        storage.getDashboardMetrics(),
        (storage as any).getWorkloadData?.() || Promise.resolve([]),
        (storage as any).getKanbanSubtasks?.() || Promise.resolve({})
      ]);

      const result = {
        projects: projects.status === 'fulfilled' ? projects.value : [],
        milestones: milestones.status === 'fulfilled' ? milestones.value : [],
        metrics: metrics.status === 'fulfilled' ? metrics.value : {},
        workload: workload.status === 'fulfilled' ? workload.value : [],
        subtasks: subtasks.status === 'fulfilled' ? subtasks.value : {},
        errors: [
          projects.status === 'rejected' ? 'Failed to fetch projects' : null,
          milestones.status === 'rejected' ? 'Failed to fetch milestones' : null,
          metrics.status === 'rejected' ? 'Failed to fetch metrics' : null,
          workload.status === 'rejected' ? 'Failed to fetch workload' : null,
          subtasks.status === 'rejected' ? 'Failed to fetch subtasks' : null,
        ].filter(Boolean)
      };

      res.json(result);
    } catch (error) {
      console.error('Dashboard complete data error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  // Get paginated projects
  app.get('/api/projects/paginated', isAuthenticated, async (req: any, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const { segmentId, status } = req.query;

      let result;
      if (req.user.role === 'employee') {
        const userProjects = await storage.getProjectsForUser(req.user.id);
        result = { 
          data: userProjects, 
          pagination: { 
            page: 1, 
            limit: userProjects.length, 
            total: userProjects.length, 
            totalPages: 1 
          } 
        };
      } else {
        result = await storage.getProjectsPaginated(page, limit);
      }
      
      // Apply segment filter if provided
      if (segmentId) {
        const validSegments = await storage.getSegments();
        if (validSegments.some(s => s.id === segmentId)) {
          result.data = result.data.filter((p: any) => p.segmentId === segmentId);
        }
      }

      // Apply status filter if provided
      if (status && ['planning', 'active', 'on_hold', 'completed', 'terminated'].includes(status as string)) {
        result.data = result.data.filter((p: any) => p.status === status);
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching paginated projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Companies (the client/organization a project and its tickets belong to)
  app.get('/api/companies', isAuthenticated, async (_req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post('/api/companies', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'companies.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Company name is required' });
      }
      const company = await storage.createCompany({
        name,
        primaryContactName: req.body.primaryContactName || undefined,
        primaryContactEmail: req.body.primaryContactEmail || undefined,
        primaryContactPhone: req.body.primaryContactPhone || undefined,
        address: req.body.address || undefined,
      });
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.get('/api/companies/:id', isAuthenticated, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.put('/api/companies/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'companies.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const existing = await storage.getCompany(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Company not found" });
      }
      const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
      if (req.body.name !== undefined && !name) {
        return res.status(400).json({ message: 'Company name is required' });
      }
      const payload: any = {
        name,
        primaryContactName: req.body.primaryContactName || undefined,
        primaryContactEmail: req.body.primaryContactEmail || undefined,
        primaryContactPhone: req.body.primaryContactPhone || undefined,
        address: req.body.address || undefined,
      };
      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });
      const company = await storage.updateCompany(req.params.id, payload);
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // Segments (dynamic, admin-managed - replaces the old academic/parastals/private enum)
  app.get('/api/segments', isAuthenticated, async (_req, res) => {
    try {
      const segments = await storage.getSegments();
      res.json(segments);
    } catch (error) {
      console.error("Error fetching segments:", error);
      res.status(500).json({ message: "Failed to fetch segments" });
    }
  });

  app.post('/api/segments', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'segments.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Segment name is required' });
      }
      const segment = await storage.createSegment({
        name,
        description: req.body.description || undefined,
        isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : undefined,
      });
      res.status(201).json(segment);
    } catch (error) {
      console.error("Error creating segment:", error);
      res.status(500).json({ message: "Failed to create segment" });
    }
  });

  app.get('/api/segments/:id', isAuthenticated, async (req, res) => {
    try {
      const segment = await storage.getSegment(req.params.id);
      if (!segment) {
        return res.status(404).json({ message: "Segment not found" });
      }
      res.json(segment);
    } catch (error) {
      console.error("Error fetching segment:", error);
      res.status(500).json({ message: "Failed to fetch segment" });
    }
  });

  app.put('/api/segments/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'segments.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const existing = await storage.getSegment(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Segment not found" });
      }
      const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
      if (req.body.name !== undefined && !name) {
        return res.status(400).json({ message: 'Segment name is required' });
      }
      const payload: any = {
        name,
        description: req.body.description !== undefined ? req.body.description || undefined : undefined,
        isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : undefined,
      };
      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });
      const segment = await storage.updateSegment(req.params.id, payload);
      res.json(segment);
    } catch (error) {
      console.error("Error updating segment:", error);
      res.status(500).json({ message: "Failed to update segment" });
    }
  });

  app.delete('/api/segments/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'segments.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const existing = await storage.getSegment(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Segment not found" });
      }
      await storage.deleteSegment(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting segment:", error);
      res.status(500).json({ message: "Failed to delete segment" });
    }
  });

  app.post('/api/projects', isAuthenticated, logProjectAction('create'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'projects.create'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const hasStart = req.body.startDate !== undefined && req.body.startDate !== null && String(req.body.startDate).trim() !== '';
      const hasEnd = req.body.endDate !== undefined && req.body.endDate !== null && String(req.body.endDate).trim() !== '';
      const start = hasStart ? new Date(req.body.startDate) : undefined;
      const end = hasEnd ? new Date(req.body.endDate) : undefined;
      if ((hasStart && (!start || Number.isNaN(start.getTime()))) || (hasEnd && (!end || Number.isNaN(end.getTime())))) {
        return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['startDate','endDate'], message: 'Invalid dates' }] });
      }
      if (hasStart && hasEnd && start && end && end < start) {
        return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['endDate'], message: 'End date must be after start date' }] });
      }

      const payload: any = {
        name: String(req.body.name || '').trim(),
        companyId: req.body.companyId || undefined,
        segmentId: req.body.segmentId || undefined,
        contactPerson: String(req.body.contactPerson || '').trim(),
        contactPhone: String(req.body.contactPhone || '').trim(),
        contactEmail: req.body.contactEmail ? String(req.body.contactEmail).trim() : undefined,
        startDate: start,
        endDate: end,
        status: req.body.status || undefined,
        budget: req.body.budget === undefined || req.body.budget === null || req.body.budget === ''
          ? undefined
          : String(req.body.budget),
        teamId: req.body.teamId || undefined,
        managerId: req.body.managerId || undefined,
      };

      if (!payload.name || !payload.contactPerson || !payload.contactPhone) {
        return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['name','contactPerson','contactPhone'], message: 'Project title, contact person, and contact phone are required' }] });
      }

      if (!hasStart || !hasEnd) {
        return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['startDate','endDate'], message: 'Start date and end date are required' }] });
      }

      // Validate segmentId against the dynamic, admin-managed segments list
      if (payload.segmentId) {
        const validSegments = await storage.getSegments();
        if (!validSegments.some(s => s.id === payload.segmentId)) {
          return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['segmentId'], message: 'Invalid segment' }] });
        }
      }

      // Determine managerId if not explicitly provided
      if (!payload.managerId) {
        if (payload.teamId) {
          try {
            const teamMembers = await storage.getTeamMembers(payload.teamId);
            const leader = teamMembers.find(m => m.role === 'Project Leader');
            if (leader) {
              payload.managerId = leader.userId;
            }
          } catch (_err) {
            // ignore, fallback will apply
          }
        }
        if (!payload.managerId) {
          payload.managerId = req.user.id;
        }
      }

      const project = await storage.createProject(payload);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put('/api/projects/:id', isAuthenticated, logProjectAction('update'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'projects.edit'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const payload: any = {
        name: req.body.name ? String(req.body.name).trim() : undefined,
        companyId: req.body.companyId || undefined,
        segmentId: req.body.segmentId || undefined,
        contactPerson: req.body.contactPerson ? String(req.body.contactPerson).trim() : undefined,
        contactPhone: req.body.contactPhone ? String(req.body.contactPhone).trim() : undefined,
        contactEmail: req.body.contactEmail ? String(req.body.contactEmail).trim() : undefined,
        budget: req.body.budget ? String(req.body.budget) : undefined,
        managerId: req.body.managerId || undefined,
        teamId: req.body.teamId || undefined,
        status: req.body.status || undefined,
      };

      // Handle dates manually
      if (req.body.startDate) {
        const start = new Date(req.body.startDate);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['startDate'], message: 'Invalid start date' }] });
        }
        payload.startDate = start;
      }
      
      if (req.body.endDate) {
        const end = new Date(req.body.endDate);
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['endDate'], message: 'Invalid end date' }] });
        }
        payload.endDate = end;
      }

      // Validate business rules
      if (payload.startDate && payload.endDate && payload.endDate < payload.startDate) {
        return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['endDate'], message: 'End date must be after start date' }] });
      }

      // Validate segmentId against the dynamic, admin-managed segments list
      if (payload.segmentId) {
        const validSegments = await storage.getSegments();
        if (!validSegments.some(s => s.id === payload.segmentId)) {
          return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['segmentId'], message: 'Invalid segment' }] });
        }
      }

      // Remove undefined values to avoid updating fields with undefined
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });
      
      // Get existing project for comparison
      const existingProject = await storage.getProject(req.params.id);
      
      const project = await storage.updateProject(req.params.id, payload);
      
      // Handle notifications for deadline changes
      if (payload.endDate && existingProject?.endDate && 
          new Date(payload.endDate).getTime() !== new Date(existingProject.endDate).getTime()) {
        
        // Get project team members to notify about deadline changes
        if (project.teamId) {
          const teamMembers = await storage.getTeamMembers(project.teamId);
          
          for (const member of teamMembers) {
            const user = await storage.getUser(member.userId);
            if (user && user.isActive) {
              await notificationService.sendProjectDeadlineNotification({
                project: project,
                user: user
              });
            }
          }
        }
      }
      
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Project termination endpoint
  app.put('/api/projects/:id/terminate', isAuthenticated, logProjectAction('terminate'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'projects.terminate'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const project = await storage.terminateProject(req.params.id);
      
      // Log project termination as system event
      const { auditService } = await import('./services/comprehensiveAuditService');
      await auditService.logSystemEvent({
        eventType: 'project_terminated',
        eventCategory: 'project_management',
        description: `Project ${project.name} has been terminated`,
        severity: 'warn',
        metadata: {
          projectId: project.id,
          projectName: project.name,
          terminatedBy: req.user.id,
          terminatedByEmail: req.user.email,
          ipAddress: req.ip || req.connection.remoteAddress
        }
      });
      
      res.json({ message: "Project terminated successfully", project });
    } catch (error) {
      console.error("Error terminating project:", error);
      res.status(500).json({ message: "Failed to terminate project" });
    }
  });

  // Deliberately close out a project's support/SLA period (distinct from the end date
  // just lapsing - see the "Support Expired - Pending Renewal" vs "Closed" distinction
  // on the Projects page filter).
  app.put('/api/projects/:id/close-support', isAuthenticated, logProjectAction('update'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'projects.edit'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const project = await storage.closeProjectSupport(req.params.id);
      res.json({ message: "Project support closed", project });
    } catch (error) {
      console.error("Error closing project support:", error);
      res.status(500).json({ message: "Failed to close project support" });
    }
  });

  // Project milestones routes (backed by billing items)
  app.get('/api/projects/:id/milestones', isAuthenticated, async (req: any, res) => {
    try {
      const milestones = await storage.getBillingItemsByProject(req.params.id);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching project milestones:", error);
      res.status(500).json({ message: "Failed to fetch project milestones" });
    }
  });

  app.post('/api/projects/:id/milestones', isAuthenticated, logBillingItemAction('create'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'projects.edit'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Clean and validate date fields
      const toDateOrNull = (v: any) => {
        if (v === undefined || v === null || v === '') return null;
        if (v instanceof Date) return v;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      };
      const toNumberOrNull = (v: any) => {
        if (v === undefined || v === null || v === '') return null;
        if (typeof v === 'number') return v;
        const cleaned = String(v).replace(/[,\s]/g, '');
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
      };

      const cleanedData = {
        ...req.body,
        projectId: req.params.id,
        createdById: req.user.id,
        expectedInvoiceDate: toDateOrNull(req.body.expectedInvoiceDate),
        expectedCollectionDate: toDateOrNull(req.body.expectedCollectionDate),
        feeAmount: toNumberOrNull(req.body.feeAmount),
      } as any;

      // Validate dates
      if (cleanedData.expectedInvoiceDate && isNaN((cleanedData.expectedInvoiceDate as Date).getTime())) {
        return res.status(400).json({ message: 'Invalid expected invoice date format' });
      }
      if (cleanedData.expectedCollectionDate && isNaN((cleanedData.expectedCollectionDate as Date).getTime())) {
        return res.status(400).json({ message: 'Invalid expected collection date format' });
      }

      const milestone = await storage.createBillingItem(cleanedData);
      res.status(201).json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(500).json({ message: "Failed to create milestone" });
    }
  });

  app.put('/api/milestones/:id', isAuthenticated, logBillingItemAction('update'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'projects.edit'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Clean and validate date fields
      const cleanedData: any = { ...req.body };
      const toDateOrNull = (v: any) => {
        if (v === undefined || v === null || v === '') return null;
        if (v instanceof Date) return v;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      };

      if (req.body.expectedInvoiceDate !== undefined) {
        cleanedData.expectedInvoiceDate = toDateOrNull(req.body.expectedInvoiceDate);
        if (cleanedData.expectedInvoiceDate && isNaN((cleanedData.expectedInvoiceDate as Date).getTime())) {
          return res.status(400).json({ message: 'Invalid expected invoice date format' });
        }
      }

      if (req.body.expectedCollectionDate !== undefined) {
        cleanedData.expectedCollectionDate = toDateOrNull(req.body.expectedCollectionDate);
        if (cleanedData.expectedCollectionDate && isNaN((cleanedData.expectedCollectionDate as Date).getTime())) {
          return res.status(400).json({ message: 'Invalid expected collection date format' });
        }
      }

      // Normalize numeric fields
      const toNumberOrNull = (v: any) => {
        if (v === undefined || v === null || v === '') return null;
        if (typeof v === 'number') return v;
        const cleaned = String(v).replace(/[,\s]/g, '');
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
      };
      if (req.body.feeAmount !== undefined) {
        cleanedData.feeAmount = toNumberOrNull(req.body.feeAmount);
      }

      const milestone = await storage.updateBillingItem(req.params.id, cleanedData);
      res.json(milestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });

  app.delete('/api/milestones/:id', isAuthenticated, logBillingItemAction('delete'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'projects.edit'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      await storage.deleteBillingItem(req.params.id);
      res.json({ message: 'Milestone deleted successfully' });
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ message: "Failed to delete milestone" });
    }
  });

  // Milestone billing status update (none | to_send | sent | processing | paid | overdue)
  app.put('/api/milestones/:id/billing-status', isAuthenticated, logInvoiceAction('update'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'projects.edit'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const billingStatus = String(req.body.billingStatus || '').toLowerCase();
      const allowed = ['none','to_send','sent','processing','paid','overdue'];
      if (!allowed.includes(billingStatus)) {
        return res.status(400).json({ message: 'Invalid billing status' });
      }
      const milestone = await storage.updateBillingItem(req.params.id, { billingStatus: billingStatus as any });
      res.json(milestone);
    } catch (error) {
      console.error('Error updating milestone billing status:', error);
      res.status(500).json({ message: 'Failed to update billing status' });
    }
  });

  // Contract management routes
  app.get('/api/contracts', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'contracts.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const contracts = await storage.getContracts();
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.get('/api/contracts/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'contracts.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.post('/api/contracts', isAuthenticated, logProjectAction('create'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'contracts.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const contract = await storage.createContract(req.body);
      res.status(201).json(contract);
    } catch (error) {
      console.error("Error creating contract:", error);
      res.status(500).json({ message: "Failed to create contract" });
    }
  });

  app.put('/api/contracts/:id', isAuthenticated, logProjectAction('update'), async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'contracts.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const contract = await storage.updateContract(req.params.id, req.body);
      res.json(contract);
    } catch (error) {
      console.error("Error updating contract:", error);
      res.status(500).json({ message: "Failed to update contract" });
    }
  });


  // Project charter routes
  app.get('/api/projects/:id/charter', isAuthenticated, async (req: any, res) => {
    try {
      const charter = await storage.getProjectCharter(req.params.id);
      res.json(charter || {});
    } catch (error) {
      console.error("Error fetching project charter:", error);
      res.status(500).json({ message: "Failed to fetch project charter" });
    }
  });

  app.post('/api/projects/:id/charter', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'projects.edit'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const charter = await storage.createProjectCharter(req.params.id, req.body);
      res.status(201).json(charter);
    } catch (error) {
      console.error("Error creating project charter:", error);
      res.status(500).json({ message: "Failed to create project charter" });
    }
  });

  app.put('/api/projects/:id/charter', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'projects.edit'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const charter = await storage.updateProjectCharter(req.params.id, req.body);
      res.json(charter);
    } catch (error) {
      console.error("Error updating project charter:", error);
      res.status(500).json({ message: "Failed to update project charter" });
    }
  });

  // Gantt chart data endpoint
  // Gantt chart data for a project - now driven entirely by billing items,
  // since the old phase/module/subtask hierarchy has been removed.
  app.get('/api/projects/:id/gantt', isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const billingItemsForProject = await storage.getBillingItemsByProject(req.params.id);

      const billingProgress = (billingStatus: string | null | undefined): number => {
        switch (billingStatus) {
          case 'sent': return 50;
          case 'processing': return 75;
          case 'paid': return 100;
          case 'overdue': return 25;
          case 'none':
          case 'to_send':
          default: return 0;
        }
      };

      const tasks = billingItemsForProject
        .slice()
        .sort((a, b) => {
          const dateA = a.expectedInvoiceDate ? new Date(a.expectedInvoiceDate).getTime() : 0;
          const dateB = b.expectedInvoiceDate ? new Date(b.expectedInvoiceDate).getTime() : 0;
          if (dateA !== dateB) return dateA - dateB;
          return a.name.localeCompare(b.name);
        })
        .map(item => ({
          id: item.id,
          name: item.name,
          startDate: item.expectedInvoiceDate,
          dueDate: item.expectedCollectionDate || item.expectedInvoiceDate,
          status: item.billingStatus === 'paid' ? 'done' : 'in_progress',
          progress: billingProgress(item.billingStatus),
          assignedUser: undefined,
          priority: item.overdueFlag ? 'high' : 'medium',
          subtasks: [],
          isMilestone: true,
          billingStatus: item.billingStatus || 'none',
        }));

      const ganttData = {
        project: {
          id: project.id,
          name: project.name,
          startDate: project.startDate,
          endDate: project.endDate,
        },
        phases: [] as any[],
        tasks,
      };

      res.json(ganttData);
    } catch (error) {
      console.error("Error fetching Gantt chart data:", error);
      res.status(500).json({ message: "Failed to fetch Gantt chart data" });
    }
  });

  // Google Calendar reminder endpoint for milestones (billing items)
  app.post('/api/tasks/:id/calendar-reminder', isAuthenticated, async (req: any, res) => {
    try {
      const milestoneId = req.params.id;
      const milestone = await storage.getBillingItem(milestoneId);

      if (!milestone) {
        return res.status(404).json({ message: 'Milestone not found' });
      }

      if (!(await userHasPermission(req.user, 'projects.edit'))) {
        return res.status(403).json({ message: 'You do not have permission to set reminders for this milestone' });
      }

      // Get user's calendar settings
      const calendarSettings = await storage.getUserCalendarSettings(req.user.id);

      if (!calendarSettings.isConnected) {
        return res.status(400).json({ message: 'Please connect your Google Calendar first' });
      }

      // Get project details
      const project = await storage.getProject(milestone.projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      const dueDate = milestone.expectedCollectionDate || milestone.expectedInvoiceDate;
      if (!dueDate) {
        return res.status(400).json({ message: 'Milestone has no due date to remind against' });
      }

      // Generate reminder event data
      const reminderData = GoogleCalendarService.generateMilestoneReminderData(
        { ...milestone, dueDate, priority: 'medium' },
        project
      );

      // Create calendar event
      const event = await calendarService.createTaskEvent(reminderData, calendarSettings.calendarName || 'primary');

      res.json({
        message: 'Reminder set successfully',
        eventId: event,
        reminderDate: reminderData.start,
        dueDate,
      });
    } catch (error) {
      console.error('Error setting calendar reminder:', error);
      res.status(500).json({ message: 'Failed to set calendar reminder' });
    }
  });


  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const notifications = await storage.getNotifications(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put('/api/notifications/:id/read', isAuthenticated, logProjectAction('update'), async (req, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put('/api/notifications/read-all', isAuthenticated, logProjectAction('update'), async (req: any, res) => {
    try {
      await storage.markAllNotificationsRead(req.user.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Test endpoint to create sample notifications (remove in production)
  app.post('/api/notifications/test', isAuthenticated, async (req: any, res) => {
    try {
      const sampleNotifications = [
        {
          id: `test-${Date.now()}-1`,
          userId: req.user.id,
          title: 'New Task Assigned',
          message: 'You have been assigned a new task: "Update User Dashboard"',
          type: 'task_assigned',
          relatedId: 'test-task-1',
          isRead: false,
          createdAt: new Date(),
        },
        {
          id: `test-${Date.now()}-2`,
          userId: req.user.id,
          title: 'Task Due Soon',
          message: 'Task "Complete API Documentation" is due in 2 days',
          type: 'task_overdue',
          relatedId: 'test-task-2',
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        }
      ];

      // Insert sample notifications
      for (const notification of sampleNotifications) {
        await storage.createNotification(notification);
      }

      res.json({ message: 'Sample notifications created', count: sampleNotifications.length });
    } catch (error) {
      console.error("Error creating test notifications:", error);
      res.status(500).json({ message: "Failed to create test notifications" });
    }
  });

  // Manual notification check endpoints
  app.post('/api/notifications/check-due-soon', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'system.manage'))) {
        return res.status(403).json({ message: 'Only managers and admins can trigger notification checks' });
      }
      
      const result = await notificationService.manualDueSoonCheck();
      res.json({ 
        message: 'Due soon notification check completed', 
        processed: result.processed, 
        sent: result.sent 
      });
    } catch (error) {
      console.error("Error checking due soon notifications:", error);
      res.status(500).json({ message: "Failed to check due soon notifications" });
    }
  });

  app.post('/api/notifications/check-overdue', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'system.manage'))) {
        return res.status(403).json({ message: 'Only managers and admins can trigger notification checks' });
      }
      
      const result = await notificationService.manualOverdueCheck();
      res.json({ 
        message: 'Overdue notification check completed', 
        processed: result.processed, 
        sent: result.sent 
      });
    } catch (error) {
      console.error("Error checking overdue notifications:", error);
      res.status(500).json({ message: "Failed to check overdue notifications" });
    }
  });

  // User notification preferences routes
  app.get('/api/user/notification-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const preferences = await storage.getUserNotificationPreferences(req.user.id);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  app.put('/api/user/notification-preferences', isAuthenticated, logUserManagementAction('update'), async (req: any, res) => {
    try {
      await storage.updateUserNotificationPreferences(req.user.id, req.body);
      res.json({ message: "Notification preferences updated successfully" });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // User Google Calendar settings routes
  app.get('/api/user/calendar-settings', isAuthenticated, async (req: any, res) => {
    try {
      const settings = await storage.getUserCalendarSettings(req.user.id);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching calendar settings:", error);
      res.status(500).json({ message: "Failed to fetch calendar settings" });
    }
  });

  app.put('/api/user/calendar-settings', isAuthenticated, async (req: any, res) => {
    try {
      await storage.updateUserCalendarSettings(req.user.id, req.body);
      res.json({ message: "Calendar settings updated successfully" });
    } catch (error) {
      console.error("Error updating calendar settings:", error);
      res.status(500).json({ message: "Failed to update calendar settings" });
    }
  });

  // Google OAuth routes
  app.get('/api/auth/google', isAuthenticated, async (req: any, res) => {
    try {
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&` +
        `scope=https://www.googleapis.com/auth/calendar&` +
        `response_type=code&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${req.user.id}`;
      
      res.json({ authUrl: googleAuthUrl });
    } catch (error) {
      console.error("Error generating Google auth URL:", error);
      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  app.get('/api/auth/google/callback', async (req: any, res) => {
    try {
      const { code, state } = req.query;
      const userId = state as string;

      if (!code || !userId) {
        return res.status(400).json({ message: "Missing authorization code or user ID" });
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          code: code as string,
          grant_type: 'authorization_code',
          redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        throw new Error(`Google OAuth error: ${tokens.error_description || tokens.error}`);
      }

      // Fetch the user's primary calendar name
      let calendarName = 'Google Calendar';
      try {
        const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        });
        
        if (calendarResponse.ok) {
          const calendarData = await calendarResponse.json();
          calendarName = calendarData.summary || 'Google Calendar';
        }
      } catch (calendarError) {
        console.warn('Could not fetch calendar name, using default:', calendarError);
      }

      // Update user calendar settings
      await storage.updateUserCalendarSettings(userId, {
        userId,
        isConnected: true,
        syncEnabled: true,
        calendarName: calendarName,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: new Date(Date.now() + (tokens.expires_in * 1000)),
      });

      // Redirect to profile page with success
      res.redirect('/profile?calendar=connected');
    } catch (error) {
      console.error("Error in Google OAuth callback:", error);
      res.redirect('/profile?calendar=error');
    }
  });

  app.post('/api/user/calendar-connect', isAuthenticated, async (req: any, res) => {
    try {
      // This endpoint initiates the OAuth flow
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&` +
        `scope=https://www.googleapis.com/auth/calendar&` +
        `response_type=code&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${req.user.id}`;
      
      res.json({ 
        message: "Calendar connection initiated successfully",
        authUrl: googleAuthUrl
      });
    } catch (error) {
      console.error("Error connecting calendar:", error);
      res.status(500).json({ message: "Failed to connect calendar" });
    }
  });

  app.post('/api/user/calendar-disconnect', isAuthenticated, async (req: any, res) => {
    try {
      await storage.updateUserCalendarSettings(req.user.id, {
        userId: req.user.id,
        isConnected: false,
        syncEnabled: false,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
      });
      
      res.json({ message: "Calendar disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
      res.status(500).json({ message: "Failed to disconnect calendar" });
    }
  });

  // Dashboard Gantt chart data endpoint - for specific project
  app.get('/api/dashboard/gantt/:projectId', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const billingItemsForProject = await storage.getBillingItemsByProject(projectId);

      const billingProgress = (billingStatus: string | null | undefined): number => {
        switch (billingStatus) {
          case 'sent': return 50;
          case 'processing': return 75;
          case 'paid': return 100;
          case 'overdue': return 25;
          case 'none':
          case 'to_send':
          default: return 0;
        }
      };

      // Structure data for Gantt chart (billing-item backed, same shape as project detail page)
      const ganttData = {
        project: {
          id: project.id,
          name: project.name,
          startDate: project.startDate,
          endDate: project.endDate,
        },
        phases: [] as any[],
        tasks: billingItemsForProject.map(item => ({
          id: item.id,
          name: item.name,
          startDate: item.expectedInvoiceDate,
          dueDate: item.expectedCollectionDate || item.expectedInvoiceDate,
          status: item.billingStatus === 'paid' ? 'done' : 'in_progress',
          progress: billingProgress(item.billingStatus),
          assignedUser: undefined,
          priority: item.overdueFlag ? 'high' : 'medium',
          subtasks: [],
          isMilestone: true,
          billingStatus: item.billingStatus || 'none',
        })),
      };

      res.json(ganttData);
    } catch (error) {
      console.error("Error fetching dashboard Gantt data:", error);
      res.status(500).json({ message: "Failed to fetch Gantt chart data" });
    }
  });

  // Executive Dashboard endpoint
  app.get('/api/dashboard/executive', isAuthenticated, async (req: any, res) => {
    try {
      // Only users with executive dashboard access can view this
      if (!(await userHasPermission(req.user, 'executive_dashboard.view'))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const projects = await storage.getProjects();
      const tasks = await storage.getBillingItems();

      // Calculate executive metrics
      const onTrackProjects = projects.filter((p: any) => p.status === 'active' && p.progress >= 80).length;
      const atRiskProjects = projects.filter((p: any) => p.status === 'active' && p.progress < 50).length;
      const onHoldProjects = projects.filter((p: any) => p.status === 'on_hold').length;
      const completedProjects = projects.filter((p: any) => p.status === 'completed').length;
      const onSLAProjects = projects.filter((p: any) => p.status === 'on_support').length;
      const closedSupportProjects = projects.filter((p: any) => p.status === 'completed' && p.progress === 100).length;

      const totalMilestones = tasks.length;
      const completedMilestones = tasks.filter((t: any) => t.billingStatus === 'paid').length;
      const overdueMilestones = tasks.filter((t: any) => {
        if (t.expectedCollectionDate && t.billingStatus !== 'paid') {
          return new Date(t.expectedCollectionDate) < new Date();
        }
        return false;
      }).length;

      // Calculate revenue metrics
      // Expected Revenue: Sum of all milestone fees (regardless of status)
      const expectedRevenue = tasks.reduce((sum: number, t: any) => sum + parseFloat(t.feeAmount || '0'), 0);

      // Total Revenue: Sum of milestones with invoice sent (billingStatus === 'sent')
      const totalRevenue = tasks.filter((t: any) => t.billingStatus === 'sent')
        .reduce((sum: number, t: any) => sum + parseFloat(t.feeAmount || '0'), 0);

      // Collected Revenue: Sum of milestones with payment received (billingStatus === 'paid')
      const collectedRevenue = tasks.filter((t: any) => t.billingStatus === 'paid')
        .reduce((sum: number, t: any) => sum + parseFloat(t.feeAmount || '0'), 0);

      // Pending Revenue: Invoice sent but not yet paid
      const pendingRevenue = totalRevenue - collectedRevenue;

      // Calculate segment performance (dynamic, admin-managed segments)
      const segmentPerformance: any = {};
      const allSegments = await storage.getSegments();
      allSegments.forEach(seg => {
        const segmentTasks = tasks.filter((t: any) => {
          const project = projects.find((p: any) => p.id === t.projectId);
          return project && project.segmentId === seg.id;
        });

        const completion = segmentTasks.length > 0
          ? Math.round((segmentTasks.filter((t: any) => t.billingStatus === 'paid').length / segmentTasks.length) * 100)
          : 0;
        const revenue = segmentTasks.reduce((sum: number, t: any) => sum + parseFloat(t.feeAmount || '0'), 0);

        segmentPerformance[seg.id] = { name: seg.name, completion, revenue };
      });

      const executiveData = {
        onTrackProjects,
        atRiskProjects,
        onHoldProjects,
        completedProjects,
        onSLAProjects,
        closedSupportProjects,
        totalMilestones,
        completedMilestones,
        overdueMilestones,
        expectedRevenue,
        totalRevenue,
        collectedRevenue,
        pendingRevenue,
        teamPerformance: segmentPerformance
      };

      res.json(executiveData);
    } catch (error) {
      console.error("Error fetching executive dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch executive dashboard data" });
    }
  });

  // Automated invoice status update middleware
  // TODO: Update this function to work with milestones instead of tasks
  // Billing automation is now handled by milestones, not individual tasks
  const updateInvoiceStatusesAutomatically = async () => {
    try {
      // This function needs to be updated to work with milestones
      // For now, it's disabled until milestone billing is implemented
      console.log('Billing automation temporarily disabled - needs milestone implementation');
    } catch (error) {
      console.error("Error in automatic invoice status update:", error);
    }
  };

  // Apply automation to relevant endpoints
  app.use('/api/tasks', async (req, res, next) => {
    // Run automation before processing task requests
    await updateInvoiceStatusesAutomatically();
    next();
  });

  app.use('/api/projects', async (req, res, next) => {
    // Run automation before processing project requests
    await updateInvoiceStatusesAutomatically();
    next();
  });

  app.use('/api/dashboard', async (req, res, next) => {
    // Run automation before processing dashboard requests
    await updateInvoiceStatusesAutomatically();
    next();
  });
  
  // Run comprehensive automation system on various endpoints
  const runAutomationChecks = async () => {
    try {
      await storage.checkContractExpirations();
      console.log('Automation checks completed successfully');
    } catch (error) {
      console.error('Error in automation checks:', error);
    }
  };

  // Run automation on dashboard requests
  app.use('/api/dashboard', async (req, res, next) => {
    await runAutomationChecks();
    next();
  });

  // Run automation on project requests
  app.use('/api/projects', async (req, res, next) => {
    await runAutomationChecks();
    next();
  });

  // Manual automation trigger endpoints
  // Contract expiration check automation endpoint
  app.post('/api/automation/check-contract-expirations', async (req, res) => {
    try {
      if (!(await userHasPermission((req as any).user, 'system.manage'))) {
        return res.status(403).json({ message: 'Only managers and admins can trigger contract expiration checks' });
      }
      
      await storage.checkContractExpirations();
      res.json({ message: 'Contract expiration check completed successfully' });
    } catch (error) {
      console.error('Error checking contract expirations:', error);
      res.status(500).json({ message: 'Failed to check contract expirations' });
    }
  });

  // Comprehensive automation endpoint - runs all automation checks
  app.post('/api/automation/run-all-checks', async (req, res) => {
    try {
      if (!(await userHasPermission((req as any).user, 'system.manage'))) {
        return res.status(403).json({ message: 'Only managers and admins can trigger automation checks' });
      }
      
      const results = {
        contractExpirations: { success: false, message: '' },
        invoiceStatuses: { success: false, message: '' }
      };

      // Run contract expiration checks
      try {
        await storage.checkContractExpirations();
        results.contractExpirations = { success: true, message: 'Contract expiration checks completed' };
      } catch (error) {
        results.contractExpirations = { success: false, message: `Contract expiration check failed: ${error}` };
      }

      // Run invoice status updates
      try {
        await updateInvoiceStatusesAutomatically();
        results.invoiceStatuses = { success: true, message: 'Invoice status updates completed' };
      } catch (error) {
        results.invoiceStatuses = { success: false, message: `Invoice status update failed: ${error}` };
      }

      const allSuccessful = Object.values(results).every(result => result.success);
      
      res.json({ 
        message: allSuccessful ? 'All automation checks completed successfully' : 'Some automation checks failed',
        results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error running automation checks:', error);
      res.status(500).json({ message: 'Failed to run automation checks' });
    }
  });

  app.post('/api/automation/trigger-project-update/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      await storage.updateProjectStatusBasedOnBillingItems(projectId);
      res.json({ message: 'Project automation triggered successfully' });
    } catch (error) {
      console.error('Error triggering project automation:', error);
      res.status(500).json({ message: 'Failed to trigger project automation' });
    }
  });

  // Hierarchy: list managers under a head role
  app.get('/api/admin/roles/:headRoleId/managers', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const { headRoleId } = req.params;
      const managers = await storage.listManagersForHead(headRoleId);
      res.json(managers);
    } catch (error) {
      console.error('Error listing managers:', error);
      res.status(500).json({ message: 'Failed to list managers' });
    }
  });

  // Hierarchy: add managers under a head role (create users if absent)
  app.post('/api/admin/roles/:headRoleId/managers', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const { headRoleId } = req.params;
      const { managers } = req.body || {};
      if (!Array.isArray(managers)) {
        return res.status(400).json({ message: 'managers must be an array' });
      }

      const createdOrFound: any[] = [];
      for (const m of managers) {
        if (!m?.email) continue;
        const email = String(m.email).trim().toLowerCase();
        const firstName = (m.firstName || email.split('@')[0]).toString();
        const lastName = (m.lastName || '').toString();
        let user = await storage.getUserByEmail(email);
        let tempForEmail: string | undefined;
        if (!user) {
          // Create with temp password (using existing helper), then set base role to manager
          const { user: newUser, temporaryPassword } = await storage.createUserWithCredentials({
            email,
            firstName,
            lastName,
            role: 'manager' as any, // Create as manager, not project_manager
          } as any, req.user.id);
          user = newUser as any;
          tempForEmail = temporaryPassword;
        } else {
          // Existing user: generate a fresh temporary password and force change
          const temporaryPassword = Math.random().toString(36).slice(-8);
          await storage.updateUserPassword(user.id, temporaryPassword, true);
          tempForEmail = temporaryPassword;
          // Ensure base role at least manager unless already admin
          await db.update(users).set({ role: (user.role === 'admin' ? 'admin' : 'manager') as any }).where(eq(users.id, user.id));
        }
        // Auto-send credentials email to manager
        try {
          const { notificationService } = await import('./services/notificationService');
          await notificationService.sendAdminRoleAssignedNotification({
            user,
            roleType: 'manager' as any,
            assignedBy: req.user,
            temporaryPassword: tempForEmail,
          });
        } catch (e) {
          console.error('Failed to send manager credentials email:', e);
        }
        if (user && user.id) {
          createdOrFound.push({ id: user.id });
        }
      }

      await storage.addManagersToHead(headRoleId, createdOrFound, req.user.id);
      res.json({ message: 'Managers linked and credentials sent', count: createdOrFound.length });
    } catch (error) {
      console.error('Error adding managers:', error);
      res.status(500).json({ message: 'Failed to add managers' });
    }
  });

  // Hierarchy: remove a manager from a head
  app.delete('/api/admin/roles/:headRoleId/managers/:userId', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const { headRoleId, userId } = req.params;
      await storage.removeManagerFromHead(headRoleId, userId);
      res.json({ message: 'Manager removed' });
    } catch (error) {
      console.error('Error removing manager:', error);
      res.status(500).json({ message: 'Failed to remove manager' });
    }
  });

  // Resend credentials for a manager (under a head)
  app.post('/api/admin/roles/managers/resend', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'users.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const { headRoleId, email } = req.body || {};
      if (!headRoleId || !email) {
        return res.status(400).json({ message: 'headRoleId and email are required' });
      }
      const user = await storage.getUserByEmail(String(email).trim().toLowerCase());
      if (!user) return res.status(404).json({ message: 'User not found' });
      const temporaryPassword = Math.random().toString(36).slice(-8);
      await storage.updateUserPassword(user.id, temporaryPassword, true);
      const { notificationService } = await import('./services/notificationService');
      await notificationService.sendAdminRoleAssignedNotification({
        user,
        roleType: 'manager' as any,
        assignedBy: req.user,
        temporaryPassword,
      });
      res.json({ message: 'Manager credentials re-sent with a new temporary password' });
    } catch (error) {
      console.error('Error resending manager credentials:', error);
      res.status(500).json({ message: 'Failed to resend credentials' });
    }
  });

  // ==================== COMPREHENSIVE AUDIT LOGS API ====================
  
  // Get all logs with filtering and pagination
  app.get('/api/admin/logs', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'system_logs.view'))) {
        return res.status(403).json({ message: 'Forbidden - Admin access required' });
      }
      
      const {
        logType = 'all',
        startDate,
        endDate,
        userId,
        severity,
        actionType,
        resourceType,
        search,
        page = 1,
        limit = 50
      } = req.query;
      
      const { auditService } = await import('./services/comprehensiveAuditService');
      const logs = await auditService.getLogs({
        logType,
        startDate,
        endDate,
        userId,
        severity,
        actionType,
        resourceType,
        search,
        page: parseInt(page),
        limit: parseInt(limit)
      });
      
      res.json(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ message: 'Failed to fetch logs' });
    }
  });

  // Get log statistics
  app.get('/api/admin/logs/statistics', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'system_logs.view'))) {
        return res.status(403).json({ message: 'Forbidden - Admin access required' });
      }
      
      const { startDate, endDate, userId } = req.query;
      
      const { auditService } = await import('./services/comprehensiveAuditService');
      const stats = await auditService.getLogStatistics({
        startDate,
        endDate,
        userId
      });
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching log statistics:', error);
      res.status(500).json({ message: 'Failed to fetch log statistics' });
    }
  });

  // Export logs
  app.get('/api/admin/logs/export', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'system_logs.view'))) {
        return res.status(403).json({ message: 'Forbidden - Admin access required' });
      }
      
      const { auditService } = await import('./services/comprehensiveAuditService');
      const { generateExcelBuffer } = await import('./utils/excelExport');
      
      const logs = await auditService.exportLogs(req.query);
      
      // Convert logs to Excel format
      const excelData = logs.map((log: any) => ({
        'Timestamp': new Date(log.createdAt).toLocaleString(),
        'Log Type': log.logType || 'activity',
        'Action Type': log.actionType || log.method || log.eventType || 'N/A',
        'Resource Type': log.resourceType || log.endpoint || 'N/A',
        'Resource Name': log.resourceName || 'N/A',
        'User ID': log.userId || 'N/A',
        'IP Address': log.ipAddress || 'N/A',
        'Status Code': log.statusCode || 'N/A',
        'Success': log.success !== undefined ? log.success : (log.statusCode < 400),
        'Error Message': log.errorMessage || 'N/A',
        'Description': log.description || 'N/A',
        'Severity': log.severity || 'info',
        'Response Time (ms)': log.responseTimeMs || 'N/A',
        'Session ID': log.sessionId || 'N/A'
      }));
      
      const buffer = generateExcelBuffer({
        data: excelData,
        reportType: 'logs',
        filename: 'system-logs'
      });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=system-logs-${new Date().toISOString().split('T')[0]}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error('Error exporting logs:', error);
      res.status(500).json({ message: 'Failed to export logs' });
    }
  });

  // Get real-time log stream (WebSocket endpoint)
  app.get('/api/admin/logs/stream', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await userHasPermission(req.user, 'system_logs.view'))) {
        return res.status(403).json({ message: 'Forbidden - Admin access required' });
      }
      
      // Set up Server-Sent Events for real-time log streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Log stream connected' })}\n\n`);
      
      // Keep connection alive
      const keepAlive = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() })}\n\n`);
      }, 30000);
      
      // Clean up on connection close
      req.on('close', () => {
        clearInterval(keepAlive);
        res.end();
      });
      
    } catch (error) {
      console.error('Error setting up log stream:', error);
      res.status(500).json({ message: 'Failed to setup log stream' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Export data helper functions
async function getProjectsExportData(storage: any, filters: any) {
  const projects = await storage.getProjects();
  
  return projects.map((project: any) => ({
    'Project Name': project.name,
    'Client': project.client || 'N/A',
    'Status': project.status,
    'Progress (%)': project.progress,
    'Start Date': project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A',
    'End Date': project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A',
    'Budget (KSh)': parseFloat(project.budget || 0).toLocaleString(),
    'Paid Amount (KSh)': (project.paidAmount || 0).toLocaleString(),
    'Outstanding (KSh)': (parseFloat(project.budget || 0) - (project.paidAmount || 0)).toLocaleString(),
    'Total Billing Items': project.billingItemCount || 0,
    'Paid Billing Items': project.paidBillingItemCount || 0,
    'Completion Rate (%)': project.billingItemCount > 0 ? Math.round((project.paidBillingItemCount / project.billingItemCount) * 100) : 0,
    'Manager': project.manager?.firstName || project.manager?.email || 'N/A',
    'Team': project.team?.name || 'N/A',
    'Created Date': new Date(project.createdAt).toLocaleDateString()
  }));
}

async function getMilestonesExportData(storage: any, filters: any) {
  const projects = await storage.getProjects();
  const allMilestones: any[] = [];

  for (const project of projects) {
    const milestones = await storage.getBillingItemsByProject(project.id);

    for (const milestone of milestones) {
      const dueDate = milestone.expectedCollectionDate || milestone.expectedInvoiceDate;
      allMilestones.push({
        'Project Name': project.name || 'N/A',
        'Milestone Name': milestone.name,
        'Client': project.client || 'N/A',
        '_projectName': project.name,
        'Manager': project.manager?.firstName && project.manager?.lastName
          ? `${project.manager.firstName} ${project.manager.lastName}`
          : project.manager?.email || 'Not assigned',
        'Due Date': dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A',
        'Fee Amount (KSh)': milestone.feeAmount ? parseFloat(milestone.feeAmount).toLocaleString() : '0',
        'Billing Status': milestone.billingStatus || 'none',
        'Overdue': dueDate ? (new Date(dueDate) < new Date() && milestone.billingStatus !== 'paid' ? 'Yes' : 'No') : 'No',
        'Days Overdue': dueDate ? Math.max(0, Math.ceil((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0,
        'Created Date': new Date(milestone.createdAt).toLocaleDateString()
      });
    }
  }

  return allMilestones;
}

async function getPerformanceExportData(storage: any, filters: any) {
  const workload = await storage.getTeamWorkload();
  
  return workload.map((member: any) => ({
    'Team Member': member.user.firstName && member.user.lastName 
      ? `${member.user.firstName} ${member.user.lastName}`
      : member.user.email,
    'Email': member.user.email,
    'Role': member.user.role,
    'Total Tasks': member.totalTasks,
    'Completed Tasks': member.completedTasks,
    'Completion Rate (%)': member.workloadPercentage,
    'Pending Tasks': member.totalTasks - member.completedTasks,
    'Performance Level': member.workloadPercentage >= 90 ? 'Excellent' : 
                        member.workloadPercentage >= 75 ? 'Good' : 
                        member.workloadPercentage >= 50 ? 'Average' : 'Below Average',
    'Last Active': new Date(member.user.lastLogin || member.user.createdAt).toLocaleDateString()
  }));
}

async function getWorkloadExportData(storage: any, filters: any) {
  const workload = await storage.getTeamWorkload();
  
  return workload.map((member: any) => ({
    'Team Member': member.user.firstName && member.user.lastName 
      ? `${member.user.firstName} ${member.user.lastName}`
      : member.user.email,
    'Email': member.user.email,
    'Role': member.user.role,
    'Total Subtasks': member.totalTasks,
    'Completed Subtasks': member.completedTasks,
    'Pending Subtasks': member.totalTasks - member.completedTasks,
    'Completion Rate (%)': member.workloadPercentage,
    'Workload Status': member.workloadPercentage >= 80 ? 'High' : 
                        member.workloadPercentage >= 50 ? 'Medium' : 'Low',
    'Last Active': new Date(member.user.lastLogin || member.user.createdAt).toLocaleDateString()
  }));
}

async function getFinancialExportData(storage: any, filters: any) {
  const projects = await storage.getProjects();
  const financialData = [];
  
  for (const project of projects) {
    const projectMilestones = await storage.getBillingItemsByProject(project.id);

    const totalFees = projectMilestones.reduce((sum: number, milestone: any) => sum + parseFloat(milestone.feeAmount || 0), 0);
    const paidFees = projectMilestones.filter((milestone: any) => milestone.billingStatus === 'paid').reduce((sum: number, milestone: any) => sum + parseFloat(milestone.feeAmount || 0), 0);
    const pendingFees = projectMilestones.filter((milestone: any) => ['to_send', 'sent'].includes(milestone.billingStatus)).reduce((sum: number, milestone: any) => sum + parseFloat(milestone.feeAmount || 0), 0);
    
    financialData.push({
      'Project Name': project.name,
      'Client': project.client || 'N/A',
      'Project Status': project.status,
      'Total Project Value (KSh)': totalFees.toLocaleString(),
      'Paid Amount (KSh)': paidFees.toLocaleString(),
      'Pending Payment (KSh)': pendingFees.toLocaleString(),
      'Outstanding (KSh)': (totalFees - paidFees).toLocaleString(),
      'Payment Completion (%)': totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 0,
      'Milestones Count': projectMilestones.length,
      'Paid Milestones': projectMilestones.filter((milestone: any) => milestone.billingStatus === 'paid').length,
      'Invoices to Send': projectMilestones.filter((milestone: any) => milestone.billingStatus === 'to_send').length,
      'Invoices Sent': projectMilestones.filter((milestone: any) => milestone.billingStatus === 'sent').length,
      'Project Start': project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A',
      'Project End': project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'
    });
  }
  
  return financialData;
}

async function getCompleteExportData(storage: any, filters: any) {
  return {
    projects: await getProjectsExportData(storage, filters),
    milestones: await getMilestonesExportData(storage, filters),
    performance: await getPerformanceExportData(storage, filters),
    workload: await getWorkloadExportData(storage, filters),
    financial: await getFinancialExportData(storage, filters)
  };
}

async function getGanttExportData(storage: any, filters: any) {
  try {
    // Filter projects by projectId if provided in filters
    let projects;
    if (filters.projectId) {
      const project = await storage.getProject(filters.projectId);
      projects = project ? [project] : [];
    } else {
      projects = await storage.getProjects();
    }
    
    const ganttData: any[] = [];
    
    for (const project of projects) {
      try {
        // Get project billing items (milestones) - replaces the old module/subtask hierarchy
        const billingItemsForProject = await storage.getBillingItemsByProject(project.id);

        // Add project header row (this will be the main project)
        ganttData.push({
          'Type': 'PROJECT',
          'Name': project.name,
          'Start Date': project.startDate ? new Date(project.startDate) : 'N/A',
          'End Date': project.endDate ? new Date(project.endDate) : 'N/A',
          'Duration (Days)': project.startDate && project.endDate ?
            Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
          'Status': project.status,
          'Progress (%)': project.progress || 0,
          'Manager': project.manager?.firstName || project.manager?.email || 'N/A',
          'Client': project.client || 'N/A',
          'Budget (KSh)': parseFloat(project.budget || 0).toLocaleString()
        });

        // Process billing items (milestones)
        for (const item of billingItemsForProject) {
          const dueDate = item.expectedCollectionDate || item.expectedInvoiceDate;
          ganttData.push({
            'Type': 'MILESTONE',
            'Name': item.name,
            'Start Date': item.expectedInvoiceDate ? new Date(item.expectedInvoiceDate) : 'N/A',
            'End Date': dueDate ? new Date(dueDate) : 'N/A',
            'Duration (Days)': item.expectedInvoiceDate && dueDate ?
              Math.ceil((new Date(dueDate).getTime() - new Date(item.expectedInvoiceDate).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
            'Status': item.billingStatus,
            'Progress (%)': item.billingStatus === 'paid' ? 100 : 0,
            'Manager': '',
            'Client': '',
            'Budget (KSh)': item.feeAmount ? parseFloat(item.feeAmount).toLocaleString() : '0'
          });
        }

        // Add spacing row between projects
        ganttData.push({
          'Type': '',
          'Name': '',
          'Start Date': '',
          'End Date': '',
          'Duration (Days)': '',
          'Status': '',
          'Progress (%)': '',
          'Manager': '',
          'Client': '',
          'Budget (KSh)': ''
        });
      } catch (error) {
        console.error(`Error processing project ${project.id}:`, error);
        // Continue with next project
      }
    }
    
    return ganttData;
  } catch (error) {
    console.error('Error in getGanttExportData:', error);
    return [];
  }
}
