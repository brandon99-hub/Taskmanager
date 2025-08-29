import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import {
  insertProjectSchema,
  insertModuleSchema,
  insertTeamSchema,
  insertTeamMemberSchema,
  insertNotificationSchema,
} from "../shared/schema";
import { z } from "zod";
import { generateExcelBuffer } from "./utils/excelExport";
import { notificationService } from "./services/notificationService";
import { calendarService, GoogleCalendarService } from "./services/calendarService";

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
    // Auth middleware
    await setupAuth(app);
  } catch (error) {
    throw error;
  }

  // Auth routes are now handled in setupAuth

  // Users listing (for selecting team members)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const role = (req.query.role as string) || undefined;
      const q = (req.query.q as string) || undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const users = await storage.getUsers({ role, q, limit, offset });
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const metrics = req.user.role === 'employee'
        ? await storage.getDashboardMetricsForUser(req.user.id)
        : await storage.getDashboardMetrics();
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

  app.get('/api/dashboard/upcoming-tasks', isAuthenticated, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const tasks = req.user.role === 'employee'
        ? await storage.getUpcomingTasksForUser(req.user.id, days)
        : await storage.getUpcomingTasks(days);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching upcoming tasks:", error);
      res.status(500).json({ message: "Failed to fetch upcoming tasks" });
    }
  });

  app.get('/api/dashboard/overdue-tasks', isAuthenticated, async (req: any, res) => {
    try {
      const tasks = req.user.role === 'employee'
        ? await storage.getOverdueTasksForUser(req.user.id)
        : await storage.getOverdueTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching overdue tasks:", error);
      res.status(500).json({ message: "Failed to fetch overdue tasks" });
    }
  });

  // New enhanced kanban tasks endpoint
  app.get('/api/dashboard/kanban-tasks', isAuthenticated, async (req: any, res) => {
    try {
      const tasks = req.user.role === 'employee'
        ? await storage.getDashboardKanbanTasksForUser(req.user.id)
        : await storage.getDashboardKanbanTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching kanban tasks:", error);
      res.status(500).json({ message: "Failed to fetch kanban tasks" });
    }
  });

  // Best performing team endpoint
  app.get('/api/dashboard/best-team', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
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
      
      if (!['admin', 'manager'].includes(req.user.role)) {
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
      if (!['admin', 'manager'].includes(req.user.role)) {
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

  // Completed milestones endpoint for modal
  app.get('/api/dashboard/completed-milestones', isAuthenticated, async (req: any, res) => {
    try {
      const completedTasks = req.user.role === 'employee'
        ? await storage.getTasksByUser(req.user.id)
        : await storage.getTasks();
      
      // Filter for completed tasks with project and user details
      const completed = completedTasks.filter((task: any) => task.status === 'done');
      res.json(completed);
    } catch (error) {
      console.error("Error fetching completed milestones:", error);
      res.status(500).json({ message: "Failed to fetch completed milestones" });
    }
  });

  // Export routes
  app.post('/api/reports/export', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
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
        complete: 'Complete Report'
      };
      
      const reportName = reportNames[reportType as keyof typeof reportNames] || 'Report';
      const filename = `AppKings Solutions Limited - ${reportName} - ${timestamp}.xlsx`;

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

      // Generate Excel buffer
      const excelBuffer = generateExcelBuffer({
        filename,
        data: exportData,
        reportType
      });

      // Set response headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      // Send the Excel file
      res.send(excelBuffer);

    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ message: 'Failed to generate export' });
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
      const { segment } = req.params;
      if (!['academic', 'parastals', 'private'].includes(segment)) {
        return res.status(400).json({ message: 'Invalid segment' });
      }
      
      const leader = await storage.getSegmentLeader(segment as "academic" | "parastals" | "private");
      res.json(leader);
    } catch (error) {
      console.error("Error fetching segment leader:", error);
      res.status(500).json({ message: "Failed to fetch segment leader" });
    }
  });

  // Save segment leaders route
  app.post('/api/segment-leaders', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { academic, parastals, private: privateSegment, financeEmail, accountManagerEmail } = req.body;
      
      // Update segment leaders in database
      await storage.updateSegmentLeaders({
        academic,
        parastals,
        private: privateSegment,
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

  app.post('/api/teams', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
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

  app.put('/api/teams/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
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



  // Project routes
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const { segment, status } = req.query;
      let projects = req.user.role === 'employee'
        ? await storage.getProjectsForUser(req.user.id)
        : await storage.getProjects();
      
      // Apply segment filter if provided
      if (segment && ['academic', 'parastals', 'private'].includes(segment as string)) {
        projects = projects.filter((p: any) => p.segment === segment);
      }
      
      // Apply status filter if provided
      if (status && ['planning', 'active', 'on_hold', 'completed', 'terminated'].includes(status as string)) {
        projects = projects.filter((p: any) => p.status === status);
      }
      
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
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

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const start = new Date(req.body.startDate);
      const end = new Date(req.body.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['startDate','endDate'], message: 'Invalid dates' }] });
      }
      if (end < start) {
        return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['endDate'], message: 'End date must be after start date' }] });
      }

      const payload: any = {
        name: String(req.body.client || '').trim(), // Set project name to client name
        client: String(req.body.client || '').trim(),
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
        managerId: req.user.id,
      };

      if (!payload.client || !payload.contactPerson || !payload.contactPhone) {
        return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['client','contactPerson','contactPhone'], message: 'Client name, contact person, and contact phone are required' }] });
      }

      const project = await storage.createProject(payload);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const payload: any = {
        name: req.body.client ? String(req.body.client).trim() : undefined, // Update project name when client changes
        client: req.body.client ? String(req.body.client).trim() : undefined,
        contactPerson: req.body.contactPerson ? String(req.body.contactPerson).trim() : undefined,
        contactPhone: req.body.contactPhone ? String(req.body.contactPhone).trim() : undefined,
        contactEmail: req.body.contactEmail ? String(req.body.contactEmail).trim() : undefined,
        budget: req.body.budget ? String(req.body.budget) : undefined,
        managerId: req.body.managerId || undefined,
        teamId: req.body.teamId || undefined,
        status: req.body.status || undefined,
        segment: req.body.segment || undefined,
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

      // Validate segment
      if (payload.segment && !['academic', 'parastals', 'private'].includes(payload.segment)) {
        return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['segment'], message: 'Segment must be academic, parastals, or private' }] });
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
  app.put('/api/projects/:id/terminate', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const project = await storage.terminateProject(req.params.id);
      res.json({ message: "Project terminated successfully", project });
    } catch (error) {
      console.error("Error terminating project:", error);
      res.status(500).json({ message: "Failed to terminate project" });
    }
  });

  // Phase management routes
  app.get('/api/projects/:id/phases', isAuthenticated, async (req: any, res) => {
    try {
      const phases = await storage.getProjectPhases(req.params.id);
      res.json(phases);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project phases" });
    }
  });

  app.post('/api/projects/:id/phases', isAuthenticated, async (req: any, res) => {
    try {
      // Allow all authenticated users to create phases (they're just metadata)
      const phases = await storage.createProjectPhases(req.params.id);
      res.status(201).json(phases);
    } catch (error) {
      console.error("Error creating project phases:", error);
      res.status(500).json({ message: "Failed to create project phases" });
    }
  });

  app.get('/api/phases/:id', isAuthenticated, async (req: any, res) => {
    try {
      const phase = await storage.getProjectPhase(req.params.id);
      if (!phase) {
        return res.status(404).json({ message: "Phase not found" });
      }
      res.json(phase);
    } catch (error) {
      console.error("Error fetching phase:", error);
      res.status(500).json({ message: "Failed to fetch phase" });
    }
  });

  app.put('/api/phases/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const phase = await storage.updateProjectPhase(req.params.id, req.body);
      res.json(phase);
    } catch (error) {
      console.error("Error updating phase:", error);
      res.status(500).json({ message: "Failed to update phase" });
    }
  });

  app.put('/api/phases/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const { completionReport } = req.body;
      if (!completionReport) {
        return res.status(400).json({ message: "Completion report is required" });
      }
      const phase = await storage.completeProjectPhase(req.params.id, completionReport);
      res.json(phase);
    } catch (error) {
      console.error("Error completing phase:", error);
      res.status(500).json({ message: "Failed to complete phase" });
    }
  });

  // Phase deliverables routes
  app.get('/api/phases/:id/deliverables', isAuthenticated, async (req: any, res) => {
    try {
      const deliverables = await storage.getPhaseDeliverables(req.params.id);
      res.json(deliverables);
    } catch (error) {
      console.error("Error fetching phase deliverables:", error);
      res.status(500).json({ message: "Failed to fetch phase deliverables" });
    }
  });

  app.post('/api/phases/:id/deliverables', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const deliverable = await storage.addPhaseDeliverable(req.params.id, req.body);
      res.status(201).json(deliverable);
    } catch (error) {
      console.error("Error adding phase deliverable:", error);
      res.status(500).json({ message: "Failed to add phase deliverable" });
    }
  });

  app.put('/api/deliverables/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const deliverable = await storage.updatePhaseDeliverable(req.params.id, req.body);
      res.json(deliverable);
    } catch (error) {
      console.error("Error updating phase deliverable:", error);
      res.status(500).json({ message: "Failed to update phase deliverable" });
    }
  });

  // Project milestones routes
  app.get('/api/projects/:id/milestones', isAuthenticated, async (req: any, res) => {
    try {
      const milestones = await storage.getMilestonesByProject(req.params.id);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching project milestones:", error);
      res.status(500).json({ message: "Failed to fetch project milestones" });
    }
  });

  app.post('/api/projects/:id/milestones', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Clean and validate date fields
      const cleanedData = {
        ...req.body,
        projectId: req.params.id,
        createdById: req.user.id,
        expectedInvoiceDate: req.body.expectedInvoiceDate ? new Date(req.body.expectedInvoiceDate) : null,
        expectedCollectionDate: req.body.expectedCollectionDate ? new Date(req.body.expectedCollectionDate) : null,
      };
      
      // Validate dates
      if (cleanedData.expectedInvoiceDate && isNaN(cleanedData.expectedInvoiceDate.getTime())) {
        return res.status(400).json({ message: 'Invalid expected invoice date format' });
      }
      if (cleanedData.expectedCollectionDate && isNaN(cleanedData.expectedCollectionDate.getTime())) {
        return res.status(400).json({ message: 'Invalid expected collection date format' });
      }
      
      const milestone = await storage.createMilestone(cleanedData);
      res.status(201).json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(500).json({ message: "Failed to create milestone" });
    }
  });

  // Project modules routes
  app.get('/api/modules', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ message: 'Project ID is required' });
      }
      const modules = await storage.getModulesByProject(projectId);
      
      // Populate assignedUser for each module
      const populatedModules = await Promise.all(modules.map(async (module: any) => {
        if (module.assignedUserId) {
          try {
            const assignedUser = await storage.getUser(module.assignedUserId);
            if (assignedUser) {
              module.assignedUser = {
                id: assignedUser.id,
                firstName: assignedUser.firstName,
                lastName: assignedUser.lastName,
                email: assignedUser.email
              };
            }
          } catch (error) {
            console.error(`Error fetching assigned user for module ${module.id}:`, error);
          }
        }
        
        // Populate assignedDev and assignedConsultant for subtasks
        if (module.subtasks && module.subtasks.length > 0) {
          module.subtasks = await Promise.all(module.subtasks.map(async (subtask: any) => {
            if (subtask.assignedDevId) {
              try {
                const assignedDev = await storage.getUser(subtask.assignedDevId);
                if (assignedDev) {
                  subtask.assignedDev = {
                    id: assignedDev.id,
                    firstName: assignedDev.firstName,
                    lastName: assignedDev.lastName,
                    email: assignedDev.email
                  };
                }
              } catch (error) {
                console.error(`Error fetching assigned dev for subtask ${subtask.id}:`, error);
              }
            }
            
            if (subtask.assignedConsultantId) {
              try {
                const assignedConsultant = await storage.getUser(subtask.assignedConsultantId);
                if (assignedConsultant) {
                  subtask.assignedConsultant = {
                    id: assignedConsultant.id,
                    firstName: assignedConsultant.firstName,
                    lastName: assignedConsultant.lastName,
                    email: assignedConsultant.email
                  };
                }
              } catch (error) {
                console.error(`Error fetching assigned consultant for subtask ${subtask.id}:`, error);
              }
            }
            
            return subtask;
          }));
        }
        
        return module;
      }));
      
      res.json(populatedModules);
    } catch (error) {
      console.error("Error fetching project modules:", error);
      res.status(500).json({ message: "Failed to fetch project modules" });
    }
  });

  // Project-specific modules endpoint
  app.get('/api/projects/:id/modules', isAuthenticated, async (req: any, res) => {
    try {
      const modules = await storage.getModulesByProject(req.params.id);
      
      // Populate assignedUser for each module
      const populatedModules = await Promise.all(modules.map(async (module: any) => {
        if (module.assignedUserId) {
          try {
            const assignedUser = await storage.getUser(module.assignedUserId);
            if (assignedUser) {
              module.assignedUser = {
                id: assignedUser.id,
                firstName: assignedUser.firstName,
                lastName: assignedUser.lastName,
                email: assignedUser.email
              };
            }
          } catch (error) {
            console.error(`Error fetching assigned user for module ${module.id}:`, error);
          }
        }
        
        // Populate assignedDev and assignedConsultant for subtasks
        if (module.subtasks && module.subtasks.length > 0) {
          module.subtasks = await Promise.all(module.subtasks.map(async (subtask: any) => {
            if (subtask.assignedDevId) {
              try {
                const assignedDev = await storage.getUser(subtask.assignedDevId);
                if (assignedDev) {
                  subtask.assignedDev = {
                    id: assignedDev.id,
                    firstName: assignedDev.firstName,
                    lastName: assignedDev.lastName,
                    email: assignedDev.email
                  };
                }
              } catch (error) {
                console.error(`Error fetching assigned dev for subtask ${subtask.id}:`, error);
              }
            }
            
            if (subtask.assignedConsultantId) {
              try {
                const assignedConsultant = await storage.getUser(subtask.assignedConsultantId);
                if (assignedConsultant) {
                  subtask.assignedConsultant = {
                    id: assignedConsultant.id,
                    firstName: assignedConsultant.firstName,
                    lastName: assignedConsultant.lastName,
                    email: assignedConsultant.email
                  };
                }
              } catch (error) {
                console.error(`Error fetching assigned consultant for subtask ${subtask.id}:`, error);
              }
            }
            
            return subtask;
          }));
        }
        
        return module;
      }));
      
      res.json(populatedModules);
    } catch (error) {
      console.error("Error fetching project modules:", error);
      res.status(500).json({ message: "Failed to fetch project modules" });
    }
  });

  app.post('/api/modules', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Clean and validate date fields
      const cleanedData = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : null,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      };
      
      // Validate dates
      if (cleanedData.startDate && isNaN(cleanedData.startDate.getTime())) {
        return res.status(400).json({ message: 'Invalid start date format' });
      }
      if (cleanedData.dueDate && isNaN(cleanedData.dueDate.getTime())) {
        return res.status(400).json({ message: 'Invalid due date format' });
      }
      
      const module = await storage.createModule(cleanedData);
      res.status(201).json(module);
    } catch (error) {
      console.error("Error creating module:", error);
      res.status(500).json({ message: "Failed to create module" });
    }
  });

  app.put('/api/modules/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Clean and validate date fields
      const cleanedData: any = { ...req.body };
      
      if (req.body.startDate !== undefined) {
        cleanedData.startDate = req.body.startDate ? new Date(req.body.startDate) : null;
        if (cleanedData.startDate && isNaN(cleanedData.startDate.getTime())) {
          return res.status(400).json({ message: 'Invalid start date format' });
        }
      }
      
      if (req.body.dueDate !== undefined) {
        cleanedData.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
        if (cleanedData.dueDate && isNaN(cleanedData.dueDate.getTime())) {
          return res.status(400).json({ message: 'Invalid due date format' });
        }
      }
      
      const module = await storage.updateModule(req.params.id, cleanedData);
      res.json(module);
    } catch (error) {
      console.error("Error updating module:", error);
      res.status(500).json({ message: "Failed to update module" });
    }
  });

  // Individual milestone routes
  app.put('/api/milestones/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Clean and validate date fields
      const cleanedData: any = { ...req.body };
      
      if (req.body.expectedInvoiceDate !== undefined) {
        cleanedData.expectedInvoiceDate = req.body.expectedInvoiceDate ? new Date(req.body.expectedInvoiceDate) : null;
        if (cleanedData.expectedInvoiceDate && isNaN(cleanedData.expectedInvoiceDate.getTime())) {
          return res.status(400).json({ message: 'Invalid expected invoice date format' });
        }
      }
      
      if (req.body.expectedCollectionDate !== undefined) {
        cleanedData.expectedCollectionDate = req.body.expectedCollectionDate ? new Date(req.body.expectedCollectionDate) : null;
        if (cleanedData.expectedCollectionDate && isNaN(cleanedData.expectedCollectionDate.getTime())) {
          return res.status(400).json({ message: 'Invalid expected collection date format' });
        }
      }
      
      const milestone = await storage.updateMilestone(req.params.id, cleanedData);
      res.json(milestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });



  app.put('/api/deliverables/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const deliverable = await storage.completePhaseDeliverable(req.params.id);
      res.json(deliverable);
    } catch (error) {
      console.error("Error completing phase deliverable:", error);
      res.status(500).json({ message: "Failed to complete phase deliverable" });
    }
  });

  // Phase reports routes
  app.get('/api/phases/:id/reports', isAuthenticated, async (req: any, res) => {
    try {
      const reports = await storage.getPhaseReports(req.params.id);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching phase reports:", error);
      res.status(500).json({ message: "Failed to fetch phase reports" });
    }
  });

  app.post('/api/phases/:id/reports', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const report = await storage.createPhaseReport(req.params.id, {
        ...req.body,
        createdBy: req.user.id,
      });
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating phase report:", error);
      res.status(500).json({ message: "Failed to create phase report" });
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
      if (!['admin', 'manager'].includes(req.user.role)) {
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
      if (!['admin', 'manager'].includes(req.user.role)) {
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
  app.get('/api/projects/:id/gantt', isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const phases = await storage.getProjectPhases(req.params.id);
      let tasks = await storage.getTasksByProject(req.params.id);

      // Auto-assign phases to modules if they don't have phases
      if (phases.length > 0 && tasks.length > 0) {
        tasks = tasks.map((task, index) => {
          if (!task.phaseNumber) {
            // Assign to phases in order (1 module per phase, then cycle)
            const phaseIndex = index % phases.length;
            const phase = phases[phaseIndex];
            return {
              ...task,
              phaseNumber: phase.phaseNumber,
              phaseName: phase.phaseName
            };
          }
          return task;
        });
      }

      // Structure data for Gantt chart
      const ganttData = {
        project: {
          id: project.id,
          name: project.name,
          startDate: project.startDate,
          endDate: project.endDate,
        },
        phases: phases.map(phase => ({
          id: phase.id,
          name: phase.phaseName,
          phaseNumber: phase.phaseNumber,
          startDate: phase.startDate,
          endDate: phase.endDate,
          status: phase.status,
          progress: phase.progress,
          deliverables: phase.deliverables,
        })),
        tasks: tasks.map(task => ({
          id: task.id,
          name: task.name,
          startDate: task.startDate,
          dueDate: task.dueDate,
          status: task.status,
          progress: task.progressPercent,
          assignedUser: task.assignedUser,
          priority: task.priority,
          phaseNumber: task.phaseNumber,
          phaseName: task.phaseName,
          subtasks: task.subtasks || [],
        })),
      };

      res.json(ganttData);
    } catch (error) {
      console.error("Error fetching Gantt chart data:", error);
      res.status(500).json({ message: "Failed to fetch Gantt chart data" });
    }
  });

  // Task routes
  app.get('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      let tasks = await storage.getTasks();
      if (req.user.role === 'employee') {
        tasks = tasks.filter(t => t.assignedUserId === req.user.id);
      }
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.get('/api/projects/:id/tasks', isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getTasksByProject(req.params.id);
      
      // Include subtasks for each milestone
      const tasksWithSubtasks = await Promise.all(
        tasks.map(async (task) => {
          const subtasks = await storage.getSubtasksByMilestone(task.id);
          return { ...task, subtasks };
        })
      );
      
      res.json(tasksWithSubtasks);
    } catch (error) {
      console.error("Error fetching project tasks:", error);
      res.status(500).json({ message: "Failed to fetch project tasks" });
    }
  });



  app.post('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const cleaned = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        createdById: req.user.id,
      };



      // Default progress for status if not provided
      if (cleaned.status && cleaned.progressPercent == null) {
        const statusMap: Record<string, number> = { todo: 0, in_progress: 50, review: 75, done: 100 };
        cleaned.progressPercent = statusMap[cleaned.status] ?? 0;
      }


      if (!cleaned.dueDate) {
        return res.status(400).json({ message: 'Invalid task data', errors: [{ path: ['dueDate'], message: 'Task deadline (dueDate) is required' }] });
      }

      const parentProject = await storage.getProject(cleaned.projectId);
      if (!parentProject) {
        return res.status(400).json({ message: 'Invalid task data', errors: [{ path: ['projectId'], message: 'Project not found' }] });
      }
      if (cleaned.startDate && parentProject.startDate && cleaned.startDate < parentProject.startDate) {
        return res.status(400).json({ message: 'Invalid task data', errors: [{ path: ['startDate'], message: 'Task start cannot be before project start' }] });
      }
      if (parentProject.endDate && cleaned.dueDate > parentProject.endDate) {
        return res.status(400).json({ message: 'Invalid task data', errors: [{ path: ['dueDate'], message: 'Task due cannot be after project end' }] });
      }

      const taskData = insertModuleSchema.parse(cleaned);

      if (taskData.assignedUserId) {
        const project = await storage.getProject(taskData.projectId);
        if (project?.team?.id) {
          const isMember = await storage.isUserInTeam(project.team.id, taskData.assignedUserId);
        }
      }

      const task = await storage.createTask(taskData);

      // Create notification for assigned user using notification service (respects preferences)
      if (taskData.assignedUserId && taskData.assignedUserId !== (req as any).user.id) {
        const assignedUser = await storage.getUser(taskData.assignedUserId);
        const project = await storage.getProject(taskData.projectId);
        
        if (assignedUser && project) {
          await notificationService.sendTaskAssignedNotification({
            task: task,
            project: project,
            user: assignedUser,
            assignedBy: req.user
          });
        }
      }

      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid task data", errors: error.errors });
      }
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
      // Build payload manually to avoid Zod type conversion issues
      const payload: any = {};
      
      // Handle basic fields
      if (req.body.name !== undefined) payload.name = String(req.body.name).trim();
      if (req.body.description !== undefined) payload.description = req.body.description ? String(req.body.description).trim() : null;
      if (req.body.status !== undefined) payload.status = req.body.status;
      if (req.body.priority !== undefined) payload.priority = req.body.priority;
      if (req.body.assignedUserId !== undefined) payload.assignedUserId = req.body.assignedUserId;
      if (req.body.assignedTeamId !== undefined) payload.assignedTeamId = req.body.assignedTeamId;
      if (req.body.progressPercent !== undefined) payload.progressPercent = Number(req.body.progressPercent);

      
      // Handle dates
      if (req.body.startDate !== undefined) {
        if (req.body.startDate) {
          payload.startDate = new Date(req.body.startDate);
        } else {
          payload.startDate = null;
        }
      }
      if (req.body.dueDate !== undefined) {
        if (req.body.dueDate) {
          payload.dueDate = new Date(req.body.dueDate);
        } else {
          payload.dueDate = null;
        }
      }



      // Employees cannot set done
      try {
        const reqAny = req as any;
        if (reqAny.user?.role === 'employee' && payload.status === 'done') {
          return res.status(403).json({ message: 'Employees cannot complete milestones. Submit for review.' });
        }
      } catch {}

      // Default progress mapping if status supplied without explicit progress
      if (payload.status && payload.progressPercent == null) {
        const statusMap: Record<string, number> = { todo: 0, in_progress: 50, client_review: 75, done: 100 }; // Removed 'review', using 'client_review'
        payload.progressPercent = statusMap[payload.status] ?? 0;
      }
      
      // Manager/Admin sets done -> mark billing to_send ONLY if not already paid or sent
      try {
        const reqAny = req as any;
        if (reqAny.user?.role !== 'employee' && payload.status === 'done') {
          // Only set billing status to 'to_send' if it's not already 'paid' or 'sent'
          // This preserves existing billing status and prevents overwriting paid invoices
          if (!payload.billingStatus || (payload.billingStatus !== 'paid' && payload.billingStatus !== 'sent')) {
            payload.billingStatus = 'to_send';
          }
        }
      } catch {}
      
      // Validate dates against project timeline
      if (payload.dueDate || payload.startDate) {
        const existing = await storage.getTask(req.params.id);
        if (existing?.project) {
          if (payload.startDate && existing.project.startDate && payload.startDate < existing.project.startDate) {
            return res.status(400).json({ 
              message: 'Invalid task data', 
              errors: [{ 
                path: ['startDate'], 
                message: `Task start date (${payload.startDate.toISOString().split('T')[0]}) cannot be before project start date (${existing.project.startDate.toISOString().split('T')[0]})` 
              }] 
            });
          }
          if (payload.dueDate && existing.project.endDate && payload.dueDate > existing.project.endDate) {
            return res.status(400).json({ 
              message: 'Invalid task data', 
              errors: [{ 
                path: ['dueDate'], 
                message: `Task due date (${payload.dueDate.toISOString().split('T')[0]}) cannot be after project end date (${existing.project.endDate.toISOString().split('T')[0]})` 
              }] 
            });
          }
        }
      }
      
      // Validate assigned user is team member
      if (payload.assignedUserId) {
        const existing = await storage.getTask(req.params.id);
        if (existing?.project?.teamId) {
          const isMember = await storage.isUserInTeam(existing.project.teamId, payload.assignedUserId);
          if (!isMember) {
            const assignedUser = await storage.getUser(payload.assignedUserId);
            const project = await storage.getProject(existing.projectId);
            return res.status(400).json({ 
              message: "Assigned user must be a member of the project's team",
              details: {
                assignedUser: assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : payload.assignedUserId,
                projectTeam: project?.team?.name || 'Unknown team'
              }
            });
          }
        }
      }
      
      // Get existing task for status comparison
      const existing = await storage.getTask(req.params.id);
      
      const task = await storage.updateTask(req.params.id, payload);
      
      // Handle notifications for task reassignment
      if (payload.assignedUserId && payload.assignedUserId !== existing?.assignedUserId) {
        const project = await storage.getProject(task.projectId);
        const assignedUser = await storage.getUser(payload.assignedUserId);
        
        if (project && assignedUser) {
          console.log(`Task ${task.id} reassigned to user ${assignedUser.email}, sending notification...`);
          await notificationService.sendTaskAssignedNotification({
            task: task,
            project: project,
            user: assignedUser,
            assignedBy: req.user
          });
        }
      }
      
      // Handle notifications for status changes
      if (payload.status && payload.status !== existing?.status) {
        const project = await storage.getProject(task.projectId);
        const assignedUser = task.assignedUserId ? await storage.getUser(task.assignedUserId) : null;
        
        if (project && assignedUser) {
          // Notify when task is moved to client review
          if (payload.status === 'client_review' && existing?.status !== 'client_review') { // Changed from 'review' to 'client_review'
            await notificationService.sendTaskAssignedNotification({
              task: task,
              project: project,
              user: assignedUser,
              assignedBy: req.user
            });
          }
          
          // Notify when task is completed
          if (payload.status === 'done' && existing?.status !== 'done') {
            await notificationService.sendTaskAssignedNotification({
              task: task,
              project: project,
              user: assignedUser,
              assignedBy: req.user
            });
          }
        }
      }
      
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid task data", errors: error.errors });
      }
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Managers/Admins: set billingStatus (none|to_send|sent|paid)
  // Billing status is now handled by milestones, not individual tasks
  // This endpoint is deprecated and will be removed
  app.put('/api/tasks/:id/billing-status', isAuthenticated, async (req: any, res) => {
    res.status(410).json({ 
      message: 'Billing status is now handled by milestones. Use /api/milestones/:id/billing-status instead.' 
    });
  });

  // Google Calendar reminder endpoint for milestones
  app.post('/api/tasks/:id/calendar-reminder', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = req.params.id;
      const task = await storage.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ message: 'Milestone not found' });
      }

      // Check if user is assigned to this task or has permission
      if (task.assignedUserId !== req.user.id && !['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'You can only set reminders for your own milestones' });
      }

      // Get user's calendar settings
      const calendarSettings = await storage.getUserCalendarSettings(req.user.id);
      
      if (!calendarSettings.isConnected) {
        return res.status(400).json({ message: 'Please connect your Google Calendar first' });
      }

      // Get project details
      const project = await storage.getProject(task.projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Generate reminder event data
      const reminderData = GoogleCalendarService.generateMilestoneReminderData(task, project);
      
      // Create calendar event
      const event = await calendarService.createTaskEvent(reminderData, calendarSettings.calendarName || 'primary');
      
      res.json({ 
        message: 'Reminder set successfully', 
        eventId: event,
        reminderDate: reminderData.start,
        dueDate: task.dueDate
      });
    } catch (error) {
      console.error('Error setting calendar reminder:', error);
      res.status(500).json({ message: 'Failed to set calendar reminder' });
    }
  });

  // Subtask routes
  app.get('/api/tasks/:id/subtasks', isAuthenticated, async (req, res) => {
    try {
      const subtasks = await storage.getSubtasksByMilestone(req.params.id);
      res.json(subtasks);
    } catch (error) {
      console.error("Error fetching subtasks:", error);
      res.status(500).json({ message: "Failed to fetch subtasks" });
    }
  });

  app.post('/api/subtasks', isAuthenticated, async (req: any, res) => {
    try {
      const cleaned = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : null,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        createdById: req.user.id,
      };

      // Validate dates
      if (cleaned.startDate && isNaN(cleaned.startDate.getTime())) {
        return res.status(400).json({ message: 'Invalid start date format' });
      }
      if (cleaned.dueDate && isNaN(cleaned.dueDate.getTime())) {
        return res.status(400).json({ message: 'Invalid due date format' });
      }

      // Validate module exists (subtasks belong to modules, not milestones)
      const module = await storage.getModule(cleaned.moduleId);
      if (!module) {
        return res.status(400).json({ message: 'Module not found' });
      }

      // Validate dates against module timeline
      if (cleaned.startDate && module.startDate && cleaned.startDate < module.startDate) {
        return res.status(400).json({ message: 'Subtask start cannot be before module start' });
      }
      if (cleaned.dueDate && module.dueDate && cleaned.dueDate > module.dueDate) {
        return res.status(400).json({ message: 'Subtask due date cannot be after module due date' });
      }

      // Validate FC consultant assignment (optional for now to debug the issue)
      // if (!cleaned.assignedConsultantId) {
      //   return res.status(400).json({ message: 'FC consultant assignment is required' });
      // }

      const subtask = await storage.createSubtask(cleaned);
      
      // Send notification if subtask is assigned to someone
      if (subtask.assignedUserId) {
        try {
          // Get the assigned user details
          const assignedUser = await storage.getUser(subtask.assignedUserId);
          if (assignedUser) {
            // Get the module/project details
            const module = await storage.getModule(cleaned.moduleId);
            const project = module ? await storage.getProject(module.projectId) : null;
            
            if (module && project) {
              // Send notification
              await notificationService.sendTaskAssignedNotification({
                task: { ...subtask, name: subtask.name, id: subtask.id },
                project: project,
                user: assignedUser,
                assignedBy: req.user
              });
            }
          }
        } catch (notificationError) {
          // Don't fail the subtask creation if notification fails
          console.error("Error sending subtask assignment notification:", notificationError);
        }
      }
      
      res.status(201).json(subtask);
    } catch (error) {
      console.error("Error creating subtask:", error);
      res.status(500).json({ message: "Failed to create subtask" });
    }
  });

  app.put('/api/subtasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const payload: any = {};
      
      // Get current subtask to check for assignment changes
      // First, get the subtask by ID directly
      const currentSubtask = await storage.getSubtask(req.params.id);
      if (!currentSubtask) {
        return res.status(404).json({ message: "Subtask not found" });
      }
      
      // Handle basic fields
      if (req.body.name !== undefined) payload.name = String(req.body.name).trim();
      if (req.body.description !== undefined) payload.description = req.body.description ? String(req.body.description).trim() : null;
      if (req.body.status !== undefined) payload.status = req.body.status;
      if (req.body.priority !== undefined) payload.priority = req.body.priority;
      if (req.body.assignedUserId !== undefined) payload.assignedUserId = req.body.assignedUserId;
      if (req.body.assignedDevId !== undefined) payload.assignedDevId = req.body.assignedDevId;
      if (req.body.assignedConsultantId !== undefined) payload.assignedConsultantId = req.body.assignedConsultantId;
      if (req.body.progressPercent !== undefined) payload.progressPercent = Number(req.body.progressPercent);
      if (req.body.estimatedHours !== undefined) payload.estimatedHours = Number(req.body.estimatedHours);
      if (req.body.estimatedDays !== undefined) payload.estimatedDays = Number(req.body.estimatedDays);
      if (req.body.actualHours !== undefined) payload.actualHours = Number(req.body.actualHours);
      if (req.body.actualDays !== undefined) payload.actualDays = Number(req.body.actualDays);
      
      // Handle dates
      if (req.body.startDate !== undefined) {
        payload.startDate = req.body.startDate ? new Date(req.body.startDate) : null;
        if (payload.startDate && isNaN(payload.startDate.getTime())) {
          return res.status(400).json({ message: 'Invalid start date format' });
        }
      }
      if (req.body.dueDate !== undefined) {
        payload.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
        if (payload.dueDate && isNaN(payload.dueDate.getTime())) {
          return res.status(400).json({ message: 'Invalid due date format' });
        }
      }

      // Enhanced workflow enforcement
      if (payload.status !== undefined) {
        const currentStatus = currentSubtask.status;
        const newStatus = payload.status;
        
        // Enforce workflow: in_progress → fc_review → qa → client_review → completed
        const allowedTransitions: Record<string, string[]> = {
          'not_started': ['in_progress'],
          'in_progress': ['fc_review', 'on_hold', 'cancelled'],
          'fc_review': ['in_progress', 'qa', 'on_hold', 'cancelled'], // FC can send back or move to QA
          'qa': ['client_review', 'in_progress', 'on_hold', 'cancelled'], // Can go back to dev or to client
          'client_review': ['completed', 'in_progress', 'on_hold', 'cancelled'], // Can be completed or sent back
          'completed': ['client_review'], // Can be reopened for review
          'on_hold': ['in_progress', 'cancelled'],
          'cancelled': ['in_progress'], // Can be reactivated
          'todo': ['in_progress'], // Legacy support
          'ongoing': ['fc_review', 'on_hold', 'cancelled'], // Legacy support
        };
        
        if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
          return res.status(400).json({ 
            message: `Invalid status transition from ${currentStatus} to ${newStatus}`,
            allowedTransitions: allowedTransitions[currentStatus] || []
          });
        }
        
        // Role-based status change restrictions
        if (req.user.role === 'employee') {
          // Employees can only set status to fc_review, not to qa, client_review, or finished
          if (['qa', 'client_review', 'finished'].includes(newStatus)) {
            return res.status(403).json({ 
              message: 'Employees cannot set status to QA, Client Review, or Completed. Submit for FC review instead.' 
            });
          }
        }
        
        // Auto-complete subtask when status is completed
        if (newStatus === 'completed' && !payload.completedAt) {
          payload.completedAt = new Date();
          payload.progressPercent = 100;
        }
        
        // Reset completion data if status changes from completed
        if (currentStatus === 'completed' && newStatus !== 'completed') {
          payload.completedAt = null;
          payload.progressPercent = 0;
        }
      }

      const subtask = await storage.updateSubtask(req.params.id, payload);
      
      // Check if assignment changed and send notification
      if (payload.assignedUserId !== undefined && 
          payload.assignedUserId !== currentSubtask.assignedUserId && 
          payload.assignedUserId) {
        
        // Get the assigned user details
        const assignedUser = await storage.getUser(payload.assignedUserId);
        if (assignedUser) {
          // Get the module/project details
          const module = await storage.getModule(currentSubtask.moduleId);
          const project = module ? await storage.getProject(module.projectId) : null;
          
          if (module && project) {
            // Send notification
            await notificationService.sendTaskAssignedNotification({
              task: { ...subtask, name: subtask.name, id: subtask.id },
              project: project,
              user: assignedUser,
              assignedBy: req.user
            });
          }
        }
      }
      
      // Send FC review notification when status changes to fc_review
      if (payload.status === 'fc_review' && currentSubtask.status !== 'fc_review') {
        try {
          // Get the FC consultant details
          const fcConsultant = await storage.getUser(currentSubtask.assignedConsultantId);
          if (fcConsultant) {
            // Get the module/project details
            const module = await storage.getModule(currentSubtask.moduleId);
            const project = module ? await storage.getProject(module.projectId) : null;
            
            if (module && project) {
              // Send FC review notification
              await notificationService.sendTaskAssignedNotification({
                task: { ...subtask, name: subtask.name, id: subtask.id },
                project: project,
              user: fcConsultant,
              assignedBy: req.user
              });
            }
          }
        } catch (notificationError) {
          // Don't fail the subtask update if notification fails
          console.error("Error sending FC review notification:", notificationError);
        }
      }
      
      res.json(subtask);
    } catch (error) {
      console.error("Error updating subtask:", error);
      res.status(500).json({ message: "Failed to update subtask" });
    }
  });

  app.delete('/api/subtasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      await storage.deleteSubtask(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting subtask:", error);
      res.status(500).json({ message: "Failed to delete subtask" });
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

  app.put('/api/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put('/api/notifications/read-all', isAuthenticated, async (req: any, res) => {
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
      if (!['admin', 'manager'].includes(req.user.role)) {
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
      if (!['admin', 'manager'].includes(req.user.role)) {
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

  app.put('/api/user/notification-preferences', isAuthenticated, async (req: any, res) => {
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

  // Executive Dashboard endpoint
  app.get('/api/dashboard/executive', isAuthenticated, async (req: any, res) => {
    try {
      // Only admin and manager can access executive dashboard
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const projects = await storage.getProjects();
      const tasks = await storage.getTasks();

      // Calculate executive metrics
      const onTrackProjects = projects.filter((p: any) => p.status === 'active' && p.progress >= 80).length;
      const atRiskProjects = projects.filter((p: any) => p.status === 'active' && p.progress < 50).length;
      const onHoldProjects = projects.filter((p: any) => p.status === 'on_hold').length;
      const completedProjects = projects.filter((p: any) => p.status === 'completed').length;
      const onSLAProjects = projects.filter((p: any) => p.status === 'on_support').length;
      const closedSupportProjects = projects.filter((p: any) => p.status === 'completed' && p.progress === 100).length;

      const totalMilestones = tasks.length;
      const completedMilestones = tasks.filter((t: any) => t.status === 'done').length;
      const overdueMilestones = tasks.filter((t: any) => {
        if (t.dueDate && t.status !== 'done') {
          return new Date(t.dueDate) < new Date();
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

      // Calculate segment performance
      const segmentPerformance: any = {};
      ['academic', 'parastals', 'private'].forEach(segment => {
        const segmentProjects = projects.filter((p: any) => p.segment === segment);
        const segmentTasks = tasks.filter((t: any) => {
          const project = projects.find((p: any) => p.id === t.projectId);
          return project && project.segment === segment;
        });
        
        const completion = segmentTasks.length > 0 
          ? Math.round((segmentTasks.filter((t: any) => t.status === 'done').length / segmentTasks.length) * 100)
          : 0;
        const revenue = segmentTasks.reduce((sum: number, t: any) => sum + parseFloat(t.feeAmount || '0'), 0);
        
        segmentPerformance[segment] = { completion, revenue };
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
  
  // Run risk management automation daily (check module deadlines)
  app.use('/api/subtasks', async (req, res, next) => {
    // Run risk management check before processing subtask requests
    try {
      await storage.checkModuleDeadlines();
    } catch (error) {
      console.error('Error in risk management automation:', error);
    }
    next();
  });

  // Manual automation trigger endpoints
  app.post('/api/automation/trigger-milestone-update/:milestoneId', async (req, res) => {
    try {
      const { milestoneId } = req.params;
              await storage.updateModuleStatusFromSubtasks(milestoneId);
      res.json({ message: 'Milestone automation triggered successfully' });
    } catch (error) {
      console.error('Error triggering milestone automation:', error);
      res.status(500).json({ message: 'Failed to trigger milestone automation' });
    }
  });
  
  // Risk management automation endpoint
  app.post('/api/automation/check-module-deadlines', async (req, res) => {
    try {
      if (!['admin', 'manager'].includes((req as any).user?.role)) {
        return res.status(403).json({ message: 'Only managers and admins can trigger deadline checks' });
      }
      
      await storage.checkModuleDeadlines();
      res.json({ message: 'Module deadline check completed successfully' });
    } catch (error) {
      console.error('Error checking module deadlines:', error);
      res.status(500).json({ message: 'Failed to check module deadlines' });
    }
  });

  app.post('/api/automation/trigger-phase-update/:phaseId', async (req, res) => {
    try {
      const { phaseId } = req.params;
      await storage.updatePhaseStatusFromMilestones(phaseId);
      res.json({ message: 'Phase automation triggered successfully' });
    } catch (error) {
      console.error('Error triggering phase automation:', error);
      res.status(500).json({ message: 'Failed to trigger phase automation' });
    }
  });

  app.post('/api/automation/trigger-project-update/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      await storage.updateProjectStatusBasedOnMilestones(projectId);
      res.json({ message: 'Project automation triggered successfully' });
    } catch (error) {
      console.error('Error triggering project automation:', error);
      res.status(500).json({ message: 'Failed to trigger project automation' });
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
    'Total Milestones': project.milestoneCount || 0,
    'Completed Milestones': project.completedMilestoneCount || 0,
    'Completion Rate (%)': project.milestoneCount > 0 ? Math.round((project.completedMilestoneCount / project.milestoneCount) * 100) : 0,
    'Manager': project.manager?.firstName || project.manager?.email || 'N/A',
    'Team': project.team?.name || 'N/A',
    'Created Date': new Date(project.createdAt).toLocaleDateString()
  }));
}

async function getMilestonesExportData(storage: any, filters: any) {
  const tasks = await storage.getTasks();
  
  return tasks.map((task: any) => ({
    'Milestone Name': task.name,
    'Project': task.project?.name || 'N/A',
    'Status': task.status,
    'Priority': task.priority,
    'Start Date': task.startDate ? new Date(task.startDate).toLocaleDateString() : 'N/A',
    'Due Date': task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A',
    'Assigned User': task.assignedUser?.firstName || task.assignedUser?.email || 'Unassigned',
    'Fee Amount (KSh)': task.feeAmount ? parseFloat(task.feeAmount).toLocaleString() : '0',
    'Billing Status': task.billingStatus || 'none',
    'Progress (%)': task.progressPercent || 0,
    'Overdue': task.dueDate ? new Date(task.dueDate) < new Date() && task.status !== 'done' : false,
    'Days Overdue': task.dueDate ? Math.max(0, Math.ceil((new Date().getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0,
    'Created Date': new Date(task.createdAt).toLocaleDateString(),
    'Description': task.description || 'N/A'
  }));
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
  const teams = await storage.getTeams();
  const workload = await storage.getTeamWorkload();
  
  // Group workload by teams
  const teamWorkload = teams.map((team: any) => {
    const teamMembers = workload.filter((member: any) => {
      // This would need actual team membership data
      return true; // Placeholder - implement team filtering
    });
    
    const totalTasks = teamMembers.reduce((sum: number, member: any) => sum + member.totalTasks, 0);
    const completedTasks = teamMembers.reduce((sum: number, member: any) => sum + member.completedTasks, 0);
    
    return {
      'Team Name': team.name,
      'Team Description': team.description || 'N/A',
      'Members Count': teamMembers.length,
      'Total Tasks': totalTasks,
      'Completed Tasks': completedTasks,
      'Team Completion Rate (%)': totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      'Average Workload (%)': teamMembers.length > 0 ? Math.round(teamMembers.reduce((sum: number, member: any) => sum + member.workloadPercentage, 0) / teamMembers.length) : 0,
      'Created Date': new Date(team.createdAt).toLocaleDateString()
    };
  });
  
  return teamWorkload;
}

async function getFinancialExportData(storage: any, filters: any) {
  const projects = await storage.getProjects();
  const tasks = await storage.getTasks();
  
  const financialData = projects.map((project: any) => {
    const projectTasks = tasks.filter((task: any) => task.projectId === project.id);
    const totalFees = projectTasks.reduce((sum: number, task: any) => sum + parseFloat(task.feeAmount || 0), 0);
    const paidFees = projectTasks.filter((task: any) => task.billingStatus === 'paid').reduce((sum: number, task: any) => sum + parseFloat(task.feeAmount || 0), 0);
    const pendingFees = projectTasks.filter((task: any) => ['to_send', 'sent'].includes(task.billingStatus)).reduce((sum: number, task: any) => sum + parseFloat(task.feeAmount || 0), 0);
    
    return {
      'Project Name': project.name,
      'Client': project.client || 'N/A',
      'Project Status': project.status,
      'Total Project Value (KSh)': totalFees.toLocaleString(),
      'Paid Amount (KSh)': paidFees.toLocaleString(),
      'Pending Payment (KSh)': pendingFees.toLocaleString(),
      'Outstanding (KSh)': (totalFees - paidFees).toLocaleString(),
      'Payment Completion (%)': totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 0,
      'Milestones Count': projectTasks.length,
      'Paid Milestones': projectTasks.filter((task: any) => task.billingStatus === 'paid').length,
      'Invoices to Send': projectTasks.filter((task: any) => task.billingStatus === 'to_send').length,
      'Invoices Sent': projectTasks.filter((task: any) => task.billingStatus === 'sent').length,
      'Project Start': project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A',
      'Project End': project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'
    };
  });
  
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
    // Get project phases and milestones
    const phases = await storage.getProjectPhases(project.id);
    const milestones = await storage.getTasksByProject(project.id);
    
    // Add project header row
    ganttData.push({
      'Type': 'PROJECT',
      'Name': project.name,
      'Start Date': project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A',
      'End Date': project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A',
      'Duration (Days)': project.startDate && project.endDate ? 
        Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
      'Status': project.status,
      'Progress (%)': project.progress || 0,
      'Manager': project.manager?.firstName || project.manager?.email || 'N/A',
      'Client': project.client || 'N/A',
      'Budget (KSh)': parseFloat(project.budget || 0).toLocaleString()
    });
    
    // Group milestones by phase if phases exist
    if (phases.length > 0) {
      phases.forEach((phase: any) => {
        // Add phase header
        ganttData.push({
          'Type': 'PHASE',
          'Name': `  │─ Phase ${phase.phaseNumber}: ${phase.phaseName}`,
          'Start Date': phase.startDate ? new Date(phase.startDate).toLocaleDateString() : 'N/A',
          'End Date': phase.endDate ? new Date(phase.endDate).toLocaleDateString() : 'N/A',
          'Duration (Days)': phase.startDate && phase.endDate ? 
            Math.ceil((new Date(phase.endDate).getTime() - new Date(phase.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
          'Status': phase.status || 'pending',
          'Progress (%)': phase.progress || 0,
          'Manager': '',
          'Client': '',
          'Budget (KSh)': ''
        });
        
        // Add milestones for this phase
        const phaseMilestones = milestones.filter((m: any) => m.phaseNumber === phase.phaseNumber);
        phaseMilestones.forEach((milestone: any) => {
          ganttData.push({
            'Type': 'MILESTONE',
            'Name': `    └─ ${milestone.name}`,
            'Start Date': milestone.startDate ? new Date(milestone.startDate).toLocaleDateString() : 'N/A',
            'End Date': milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString() : 'N/A',
            'Duration (Days)': milestone.startDate && milestone.dueDate ? 
              Math.ceil((new Date(milestone.dueDate).getTime() - new Date(milestone.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
            'Status': milestone.status,
            'Progress (%)': milestone.progressPercent || 0,
            'Manager': milestone.assignedUser?.firstName || milestone.assignedUser?.email || 'Unassigned',
            'Client': '',
            'Budget (KSh)': milestone.feeAmount ? parseFloat(milestone.feeAmount).toLocaleString() : '0'
          });
        });
      });
    } else {
      // Add milestones directly under project if no phases
      milestones.forEach((milestone: any) => {
        ganttData.push({
          'Type': 'MILESTONE',
          'Name': `  └─ ${milestone.name}`,
          'Start Date': milestone.startDate ? new Date(milestone.startDate).toLocaleDateString() : 'N/A',
          'End Date': milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString() : 'N/A',
          'Duration (Days)': milestone.startDate && milestone.dueDate ? 
            Math.ceil((new Date(milestone.dueDate).getTime() - new Date(milestone.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
          'Status': milestone.status,
          'Progress (%)': milestone.progressPercent || 0,
          'Manager': milestone.assignedUser?.firstName || milestone.assignedUser?.email || 'Unassigned',
          'Client': '',
          'Budget (KSh)': milestone.feeAmount ? parseFloat(milestone.feeAmount).toLocaleString() : '0'
        });
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
  }
  
  return ganttData;
}
