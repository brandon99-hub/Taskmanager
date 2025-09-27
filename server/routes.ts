import type { Express } from "express";
import { createServer, type Server } from "http";
import * as bcrypt from "bcryptjs";
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
import path from "path";
import { notificationService } from "./services/notificationService";
import { calendarService, GoogleCalendarService } from "./services/calendarService";
import { calculateWeightBasedProgress, calculateSubtaskWeightBasedProgress } from "../client/src/lib/utils";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "../shared/schema";
import { registerMarketingRoutes } from "./routes/marketing";

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

// Helper function to check if user has admin privileges
async function hasAdminPrivileges(user: any): Promise<boolean> {
  if (['admin', 'manager'].includes(user.role)) {
    return true;
  }
  
  try {
    const dashboardRole = await storage.getUserDashboardRole(user.id);
    return dashboardRole.isProjectManager || 
           dashboardRole.isFinanceHead || 
           !!dashboardRole.assignedSegment;
  } catch (error) {
    console.error('Error checking admin privileges:', error);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    // Run initial automation checks on server startup
    console.log('Running initial automation checks...');
    try {
      await storage.checkModuleDeadlines();
      await storage.checkContractExpirations();
      console.log('Initial automation checks completed successfully');
    } catch (error) {
      console.error('Error in initial automation checks:', error);
    }

    // Set up periodic automation checks (every 6 hours)
    const automationInterval = setInterval(async () => {
      try {
        console.log('Running periodic automation checks...');
        await storage.checkModuleDeadlines();
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

  // Users listing (for selecting team members)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
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
      const canView = req.user.id === req.params.id || (await hasAdminPrivileges(req.user));
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

  // Overdue breakdown endpoint for employees
  app.get('/api/dashboard/overdue-breakdown', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'employee') {
        return res.status(403).json({ message: 'This endpoint is only for employees' });
      }
      
      const breakdown = await storage.getOverdueBreakdownForUser(req.user.id);
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching overdue breakdown:", error);
      res.status(500).json({ message: "Failed to fetch overdue breakdown" });
    }
  });

  // Combined overdue items endpoint for admins (milestones + subtasks organized by project)
  app.get('/api/dashboard/overdue-combined', isAuthenticated, async (req: any, res) => {
    try {
      const { db } = await import('./db');
      const { milestones, subtasks, modules, projects, users } = await import('../shared/schema');
      const { eq, and, sql } = await import('drizzle-orm');

      const now = new Date();
      
      // Get overdue milestones
      const overdueMilestones = await db
        .select({
          id: milestones.id,
          name: milestones.name,
          description: milestones.description,
          feeAmount: milestones.feeAmount,
          billingStatus: milestones.billingStatus,
          expectedInvoiceDate: milestones.expectedInvoiceDate,
          expectedCollectionDate: milestones.expectedCollectionDate,
          startDate: milestones.startDate,
          endDate: milestones.endDate,
          paymentReceivedAt: milestones.paymentReceivedAt,
          priority: milestones.priority,
          projectId: milestones.projectId,
          // Project details
          projectDbId: projects.id,
          projectName: projects.name,
          projectClient: projects.client,
          projectContactEmail: projects.contactEmail,
          projectSegment: projects.segment,
          projectStatus: projects.status,
          // User details
          userId: users.id,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
        })
        .from(milestones)
        .leftJoin(projects, eq(milestones.projectId, projects.id))
        .leftJoin(users, eq(milestones.createdById, users.id))
        .where(
          and(
            sql`${milestones.endDate} < ${now}`,
            sql`${milestones.billingStatus} != 'paid'`
          )
        );

      // Get overdue subtasks linked to modules
      const overdueModuleSubtasks = await db
        .select({
          id: subtasks.id,
          name: subtasks.name,
          description: subtasks.description,
          status: subtasks.status,
          priority: subtasks.priority,
          dueDate: subtasks.dueDate,
          estimatedHours: subtasks.estimatedHours,
          actualHours: subtasks.actualHours,
          createdAt: subtasks.createdAt,
          updatedAt: subtasks.updatedAt,
          moduleId: modules.id,
          moduleName: modules.name,
          moduleDescription: modules.description,
          projectId: projects.id,
          projectName: projects.name,
          projectClient: projects.client,
          projectContactEmail: projects.contactEmail,
          projectSegment: projects.segment,
          projectStatus: projects.status,
          userId: users.id,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
        })
        .from(subtasks)
        .leftJoin(modules, eq(subtasks.moduleId, modules.id))
        .leftJoin(projects, eq(modules.projectId, projects.id))
        .leftJoin(users, eq(subtasks.assignedUserId, users.id))
        .where(
          and(
            sql`${subtasks.dueDate} < ${now}`,
            sql`${subtasks.status} NOT IN ('completed', 'cancelled')`,
            sql`${subtasks.moduleId} IS NOT NULL`
          )
        );

      // Get overdue subtasks linked to milestones
      const overdueMilestoneSubtasks = await db
        .select({
          id: subtasks.id,
          name: subtasks.name,
          description: subtasks.description,
          status: subtasks.status,
          priority: subtasks.priority,
          dueDate: subtasks.dueDate,
          estimatedHours: subtasks.estimatedHours,
          actualHours: subtasks.actualHours,
          createdAt: subtasks.createdAt,
          updatedAt: subtasks.updatedAt,
          moduleId: milestones.id, // Link to milestone instead
          moduleName: milestones.name,
          moduleDescription: milestones.description,
          projectId: projects.id,
          projectName: projects.name,
          projectClient: projects.client,
          projectContactEmail: projects.contactEmail,
          projectSegment: projects.segment,
          projectStatus: projects.status,
          userId: users.id,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
        })
        .from(subtasks)
        .leftJoin(milestones, eq(subtasks.milestoneId, milestones.id))
        .leftJoin(projects, eq(milestones.projectId, projects.id))
        .leftJoin(users, eq(subtasks.assignedUserId, users.id))
        .where(
          and(
            sql`${subtasks.dueDate} < ${now}`,
            sql`${subtasks.status} NOT IN ('completed', 'cancelled')`,
            sql`${subtasks.milestoneId} IS NOT NULL`
          )
        );

      // Combine all overdue subtasks and sort by due date
      const allOverdueSubtasks = [...overdueModuleSubtasks, ...overdueMilestoneSubtasks]
        .filter(item => item.dueDate)
        .sort((a, b) => {
          const dateA = new Date(a.dueDate || 0);
          const dateB = new Date(b.dueDate || 0);
          return dateA.getTime() - dateB.getTime();
        });

      // Transform milestones
      const transformedMilestones = overdueMilestones.map(milestone => ({
        id: milestone.id,
        name: milestone.name,
        description: milestone.description,
        feeAmount: milestone.feeAmount,
        billingStatus: milestone.billingStatus,
        expectedInvoiceDate: milestone.expectedInvoiceDate,
        expectedCollectionDate: milestone.expectedCollectionDate,
        startDate: milestone.startDate,
        endDate: milestone.endDate,
        paymentReceivedAt: milestone.paymentReceivedAt,
        priority: milestone.priority,
        projectId: milestone.projectId,
        type: 'milestone',
        project: {
          id: milestone.projectDbId,
          name: milestone.projectName,
          client: milestone.projectClient,
          contactEmail: milestone.projectContactEmail,
          segment: milestone.projectSegment,
          status: milestone.projectStatus,
        },
        createdBy: {
          id: milestone.userId,
          firstName: milestone.userFirstName,
          lastName: milestone.userLastName,
          email: milestone.userEmail,
        }
      }));

      // Transform subtasks
      const transformedSubtasks = allOverdueSubtasks.map(subtask => ({
        id: subtask.id,
        name: subtask.name,
        description: subtask.description,
        status: subtask.status,
        priority: subtask.priority,
        dueDate: subtask.dueDate,
        estimatedHours: subtask.estimatedHours,
        actualHours: subtask.actualHours,
        createdAt: subtask.createdAt,
        updatedAt: subtask.updatedAt,
        type: 'subtask',
        moduleId: subtask.moduleId,
        module: {
          id: subtask.moduleId,
          name: subtask.moduleName,
          description: subtask.moduleDescription,
        },
        project: {
          id: subtask.projectId,
          name: subtask.projectName,
          client: subtask.projectClient,
          contactEmail: subtask.projectContactEmail,
          segment: subtask.projectSegment,
          status: subtask.projectStatus,
        },
        assignedUser: {
          id: subtask.userId,
          firstName: subtask.userFirstName,
          lastName: subtask.userLastName,
          email: subtask.userEmail,
        }
      }));

      // Group by project
      const projectGroups: { [key: string]: { project: any; milestones: any[]; subtasks: any[] } } = {};
      
      // Add milestones to project groups
      transformedMilestones.forEach(milestone => {
        const projectId = milestone.projectId;
        if (!projectGroups[projectId]) {
          projectGroups[projectId] = {
            project: milestone.project,
            milestones: [],
            subtasks: []
          };
        }
        projectGroups[projectId].milestones.push(milestone);
      });

      // Add subtasks to project groups
      transformedSubtasks.forEach(subtask => {
        const projectId = subtask.project?.id;
        if (projectId && !projectGroups[projectId]) {
          projectGroups[projectId] = {
            project: subtask.project,
            milestones: [],
            subtasks: []
          };
        }
        if (projectId) {
          projectGroups[projectId].subtasks.push(subtask);
        }
      });

      // Convert to array format
      const result = Object.values(projectGroups).map(group => ({
        project: group.project,
        milestones: group.milestones,
        subtasks: group.subtasks,
        totalOverdue: group.milestones.length + group.subtasks.length
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching combined overdue items:", error);
      res.status(500).json({ message: "Failed to fetch combined overdue items" });
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

  // New kanban subtasks endpoint
  app.get('/api/dashboard/kanban-subtasks', isAuthenticated, async (req: any, res) => {
    try {
      const subtasks = req.user.role === 'employee'
        ? await storage.getDashboardKanbanSubtasksForUser(req.user.id)
        : await storage.getDashboardKanbanSubtasks();
      res.json(subtasks);
    } catch (error) {
      console.error("Error fetching kanban subtasks:", error);
      res.status(500).json({ message: "Failed to fetch kanban subtasks" });
    }
  });

  // Critical billing milestones for dashboard kanban
  app.get('/api/dashboard/kanban-milestones', isAuthenticated, async (req: any, res) => {
    try {
      // Optional filters
      const projectId = req.query.projectId as string | undefined;
      const segment = req.query.segment as ('academic'|'parastals'|'private') | undefined;

      const all = await storage.getMilestones();

      // Filter by project/segment if provided
      const filtered = all.filter((m: any) => {
        if (projectId && m.project?.id !== projectId) return false;
        if (segment && m.project?.segment !== segment) return false;
        return true;
      });

      const today = new Date();
      const withinDays = (d?: Date | string | null, n = 7) => {
        if (!d) return false;
        const dt = new Date(d as any);
        const diff = (dt.getTime() - today.getTime()) / (1000*60*60*24);
        return diff >= 0 && diff <= n;
      };
      const olderThanDays = (d?: Date | string | null, n = 5) => {
        if (!d) return false;
        const dt = new Date(d as any);
        const diff = (today.getTime() - dt.getTime()) / (1000*60*60*24);
        return diff > n;
      };

      const overdue = filtered.filter((m: any) => m.billingStatus !== 'paid' && (m.expectedCollectionDate && new Date(m.expectedCollectionDate) < today));
      const highPriority = filtered.filter((m: any) => (m.priority === 'high' || m.priority === 'critical') && withinDays(m.endDate, 7) && m.billingStatus !== 'paid');
      const review = filtered.filter((m: any) => ['to_send','sent','processing'].includes(m.billingStatus || 'none') && (olderThanDays(m.expectedInvoiceDate, 5) || olderThanDays(m.endDate, 5)));
      const recentlyDone = filtered.filter((m: any) => m.billingStatus === 'paid' && (m.paymentReceivedAt ? olderThanDays(m.paymentReceivedAt, -7) : withinDays(m.endDate, 7)));

      res.json({ overdue, highPriority, review, recentlyDone });
    } catch (error) {
      console.error("Error fetching kanban milestones:", error);
      res.status(500).json({ message: "Failed to fetch kanban milestones" });
    }
  });

  // Best performing team endpoint
  app.get('/api/dashboard/best-team', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      const { db } = await import('./db');
      const { milestones, projects, users } = await import('../shared/schema');
      const { eq, and, inArray, sql } = await import('drizzle-orm');

      // Get completed milestones (billingStatus = 'paid') with project and user details
      const completedMilestones = await db
        .select({
          id: milestones.id,
          name: milestones.name,
          description: milestones.description,
          feeAmount: milestones.feeAmount,
          billingStatus: milestones.billingStatus,
          expectedInvoiceDate: milestones.expectedInvoiceDate,
          expectedCollectionDate: milestones.expectedCollectionDate,
          startDate: milestones.startDate,
          endDate: milestones.endDate,
          paymentReceivedAt: milestones.paymentReceivedAt,
          priority: milestones.priority,
          projectId: milestones.projectId,
          // Project details
          projectDbId: projects.id,
          projectName: projects.name,
          projectClient: projects.client,
          projectContactEmail: projects.contactEmail,
          projectSegment: projects.segment,
          projectStatus: projects.status,
          // User details
          userId: users.id,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
        })
        .from(milestones)
        .leftJoin(projects, eq(milestones.projectId, projects.id))
        .leftJoin(users, eq(milestones.createdById, users.id))
        .where(eq(milestones.billingStatus, 'paid'));

      console.log('Found', completedMilestones.length, 'completed milestones in database');
      
      // Get total milestone count and total project value for each project
      const projectIds = completedMilestones.map(m => m.projectId).filter((id, index, arr) => arr.indexOf(id) === index);
      
      const projectTotalCounts: Record<string, number> = {};
      const projectTotalValues: Record<string, number> = {};
      
      if (projectIds.length > 0) {
        const projectTotals = await db
          .select({
            projectId: milestones.projectId,
            totalCount: sql<number>`count(*)`,
            totalValue: sql<number>`COALESCE(SUM(${milestones.feeAmount}), 0)`
          })
          .from(milestones)
          .where(inArray(milestones.projectId, projectIds))
          .groupBy(milestones.projectId);
        
        projectTotals.forEach(item => {
          projectTotalCounts[item.projectId] = Number(item.totalCount);
          projectTotalValues[item.projectId] = Number(item.totalValue);
        });
      }
      
      // Get total milestones across all projects in the system
      const systemTotalMilestones = await db
        .select({
          totalCount: sql<number>`count(*)`
        })
        .from(milestones);
      
      const systemTotal = Number(systemTotalMilestones[0]?.totalCount || 0);
      
      // Transform the flat result into the expected nested structure
      const transformedMilestones = completedMilestones.map(milestone => ({
        id: milestone.id,
        name: milestone.name,
        description: milestone.description,
        feeAmount: milestone.feeAmount,
        billingStatus: milestone.billingStatus,
        expectedInvoiceDate: milestone.expectedInvoiceDate,
        expectedCollectionDate: milestone.expectedCollectionDate,
        startDate: milestone.startDate,
        endDate: milestone.endDate,
        paymentReceivedAt: milestone.paymentReceivedAt,
        priority: milestone.priority,
        projectId: milestone.projectId,
        project: {
          id: milestone.projectDbId,
          name: milestone.projectName,
          client: milestone.projectClient,
          contactEmail: milestone.projectContactEmail,
          segment: milestone.projectSegment,
          status: milestone.projectStatus,
          totalMilestones: projectTotalCounts[milestone.projectId] || 0,
          totalProjectValue: projectTotalValues[milestone.projectId] || 0,
        },
        createdBy: {
          id: milestone.userId,
          firstName: milestone.userFirstName,
          lastName: milestone.userLastName,
          email: milestone.userEmail,
        }
      }));

      res.json({
        milestones: transformedMilestones,
        systemTotalMilestones: systemTotal
      });
    } catch (error) {
      console.error("Error fetching completed milestones:", error);
      res.status(500).json({ message: "Failed to fetch completed milestones" });
    }
  });

  // Completed modules endpoint for project managers
  app.get('/api/dashboard/completed-modules', isAuthenticated, async (req: any, res) => {
    try {
      const completedTasks = req.user.role === 'employee'
        ? await storage.getTasksByUser(req.user.id)
        : await storage.getTasks();
      
      // Filter for completed tasks with project and user details
      const completed = completedTasks.filter((task: any) => task.status === 'done');
      res.json(completed);
    } catch (error) {
      console.error("Error fetching completed modules:", error);
      res.status(500).json({ message: "Failed to fetch completed modules" });
    }
  });

  // Completed subtasks endpoint for employees
  app.get('/api/dashboard/completed-subtasks', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'employee') {
        return res.status(403).json({ message: 'This endpoint is only for employees' });
      }
      
      const breakdown = await storage.getCompletedBreakdownForUser(req.user.id);
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching completed subtasks:", error);
      res.status(500).json({ message: "Failed to fetch completed subtasks" });
    }
  });

  // Overdue modules endpoint for project managers
  app.get('/api/dashboard/overdue-modules', isAuthenticated, async (req: any, res) => {
    try {
      const overdueTasks = req.user.role === 'employee'
        ? await storage.getOverdueTasksForUser(req.user.id)
        : await storage.getOverdueTasks();
      
      res.json(overdueTasks);
    } catch (error) {
      console.error("Error fetching overdue modules:", error);
      res.status(500).json({ message: "Failed to fetch overdue modules" });
    }
  });

  // Project Performance Dashboard endpoint for Project Managers
  app.get('/api/dashboard/project-performance', isAuthenticated, async (req: any, res) => {
    try {
      // Check if user has project manager permissions
      const dashboardRole = await storage.getUserDashboardRole(req.user.id);
      if (!dashboardRole.isProjectManager && !['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      
      const performanceData = await storage.getProjectPerformanceData(year, month);
      res.json(performanceData);
    } catch (error) {
      console.error("Error fetching project performance data:", error);
      res.status(500).json({ message: "Failed to fetch project performance data" });
    }
  });

  // Risk Management & Quality Control endpoint for Project Managers
  app.get('/api/dashboard/risk-quality', isAuthenticated, async (req: any, res) => {
    try {
      // Check if user has project manager permissions
      const dashboardRole = await storage.getUserDashboardRole(req.user.id);
      if (!dashboardRole.isProjectManager && !['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      
      const riskQualityData = await storage.getRiskQualityData(year, month);
      res.json(riskQualityData);
    } catch (error) {
      console.error("Error fetching risk quality data:", error);
      res.status(500).json({ message: "Failed to fetch risk quality data" });
    }
  });

  // Export routes
  app.post('/api/reports/export', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
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

      // Handle different formats
      if (format === 'json') {
        // Return JSON data for detailed view
        console.log('Returning JSON data for report type:', reportType, 'Data length:', Array.isArray(exportData) ? exportData.length : 'Not an array');
        
        // Ensure we always return an array for the frontend
        let jsonData;
        if (Array.isArray(exportData)) {
          jsonData = exportData;
        } else if (typeof exportData === 'object' && exportData !== null) {
          // Flatten object data into array
          jsonData = [];
          Object.values(exportData).forEach((section: any) => {
            if (Array.isArray(section)) {
              jsonData.push(...section);
            }
          });
        } else {
          jsonData = [];
        }
        
        res.json(jsonData);
      } else {
        // Generate Excel buffer (use template for gantt if available)
        const isGantt = reportType === 'gantt';
        const templatePath = isGantt ? path.join(__dirname, 'templates', 'gantt-chart(2).xlsx') : undefined;
        const excelBuffer = generateExcelBuffer({
          filename,
          data: exportData,
          reportType,
          templatePath,
          templateSheetName: undefined
        });

        // Set response headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', excelBuffer.length);

        // Send the Excel file
        res.send(excelBuffer);
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
      if (!(await hasAdminPrivileges(req.user))) {
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

  // Admin Role Management Routes
  // Get all admin roles
  app.get('/api/admin/roles', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
  app.post('/api/admin/roles', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { userId, roleType, segment } = req.body;
      
      if (!userId || !roleType) {
        return res.status(400).json({ message: 'User ID and role type are required' });
      }
      
      if (!['project_manager', 'finance_head', 'segment_leader'].includes(roleType)) {
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
  app.delete('/api/admin/roles/:userId/:roleType', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { userId, roleType } = req.params;
      const { segment } = req.query;
      
      if (!['project_manager', 'finance_head', 'segment_leader'].includes(roleType)) {
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
  app.post('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { email, firstName, lastName, role, segment } = req.body;
      
      if (!email || !firstName || !lastName || !role) {
        return res.status(400).json({ message: 'Email, first name, last name, and role are required' });
      }
      
      if (!['project_manager', 'finance_head', 'segment_leader'].includes(role)) {
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
      if (!(await hasAdminPrivileges(req.user))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const { email, roleType, segment } = req.body || {};
      if (!email || !roleType) {
        return res.status(400).json({ message: 'Email and roleType are required' });
      }
      if (!['project_manager', 'finance_head', 'segment_leader', 'manager'].includes(roleType)) {
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
  // Send subtask assignment notification
  app.post('/api/notifications/subtask-assignment', isAuthenticated, async (req: any, res) => {
    try {
      const { subtaskId, assigneeId } = req.body;
      
      if (!subtaskId || !assigneeId) {
        return res.status(400).json({ message: 'Subtask ID and assignee ID are required' });
      }
      
      // Get subtask, module, project, and user details
      const subtask = await storage.getSubtask(subtaskId);
      const assignee = await storage.getUser(assigneeId);
      
      if (!subtask || !assignee) {
        return res.status(404).json({ message: 'Subtask or assignee not found' });
      }
      
      const module = await storage.getModule(subtask.moduleId);
      const project = module ? await storage.getProject(module.projectId) : null;
      
      if (!module || !project) {
        return res.status(404).json({ message: 'Module or project not found' });
      }
      
      // Send notification
      const { notificationService } = await import('./services/notificationService');
      await notificationService.sendSubtaskAssignmentNotification({
        subtask,
        module,
        project,
        assignee,
        assignedBy: req.user
      });
      
      res.json({ message: 'Subtask assignment notification sent successfully' });
    } catch (error) {
      console.error("Error sending subtask assignment notification:", error);
      res.status(500).json({ message: "Failed to send notification" });
    }
  });

  // Check finance deadlines and send warnings
  app.post('/api/notifications/finance-deadlines', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager', 'finance_head'].includes(req.user.role) && !req.user.isFinanceHead) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Get overdue or due soon milestones
      const milestones = await storage.getMilestones();
      const dueMilestones = milestones.filter((m: any) => {
        if (m.status !== 'completed') return false;
        if (m.billingStatus === 'paid') return false;
        
        const dueDate = new Date(m.dueDate);
        const now = new Date();
        const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        return daysDiff <= 7; // Due within 7 days
      });
      
      if (dueMilestones.length === 0) {
        return res.json({ message: 'No upcoming payment deadlines' });
      }
      
      // Get finance head
      const financeHeads = await storage.getAdminRoles();
      const financeHead = financeHeads.find((r: any) => r.roleType === 'finance_head' && r.isActive);
      
      if (financeHead) {
        const { notificationService } = await import('./services/notificationService');
        await notificationService.sendFinanceDeadlineWarning({
          milestones: dueMilestones,
          financeHead: financeHead.user
        });
      }
      
      res.json({ 
        message: 'Finance deadline warnings sent successfully',
        milestonesCount: dueMilestones.length
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
      await storage.updateUserPassword(req.user.id, newPassword, user.mustChangePassword || false);
      
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

  app.post('/api/teams', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
  app.get('/api/milestones', isAuthenticated, async (req: any, res) => {
    try {
      const milestones = await storage.getMilestones();
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  app.get('/api/milestones/:id', isAuthenticated, async (req: any, res) => {
    try {
      const milestone = await storage.getMilestone(req.params.id);
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
              
              if (segment) projects = projects.filter((p: any) => p.segment === segment);
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
              // Get all milestones
              const milestones = await storage.getMilestones();
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
              // Get all tasks/modules
              const tasks = await storage.getTasks();
              return { data: tasks };
            } else if (url.includes('/api/projects') && url.includes('/gantt')) {
              // Get Gantt chart data for a project
              const match = url.match(/\/api\/projects\/([^\/]+)\/gantt/);
              if (match && match[1]) {
                const projectId = match[1];
                try {
                const project = await storage.getProject(projectId);
                const modules = await storage.getModulesByProject(projectId);
                const milestones = await storage.getMilestonesByProject(projectId);
                
                // Format data for GanttChart component
                let phases: any[] = [];
                try {
                  phases = await storage.getProjectPhases(projectId);
                } catch (error) {
                  console.log('Phases not found for Gantt chart');
                }
                
                const ganttData = {
                  project: {
                    id: project?.id || projectId,
                    name: project?.name || 'Unknown Project',
                    startDate: project?.startDate || new Date().toISOString(),
                    endDate: project?.endDate || new Date().toISOString()
                  },
                  phases: phases.map((phase: any) => ({
                    id: phase.id,
                    phaseNumber: phase.phaseNumber,
                    name: phase.phaseName || phase.name,
                    startDate: phase.startDate,
                    endDate: phase.endDate,
                    status: phase.status || 'not_started',
                    progress: phase.progress || 0
                  })),
                  tasks: modules?.map((module: any) => ({
                    id: module.id,
                    name: module.name,
                    startDate: module.startDate,
                    dueDate: module.dueDate,
                    status: module.status || 'not_started',
                    progress: module.progressPercent || 0,
                    priority: module.priority || 'medium',
                    phaseNumber: module.phaseNumber,
                    assignedUser: module.assignedUser ? {
                      firstName: module.assignedUser.firstName,
                      lastName: module.assignedUser.lastName,
                      email: module.assignedUser.email
                    } : undefined,
                    subtasks: module.subtasks?.map((subtask: any) => ({
                      id: subtask.id,
                      name: subtask.name,
                      startDate: subtask.startDate,
                      dueDate: subtask.dueDate,
                      status: subtask.status,
                      assignedUser: subtask.assignedUser ? {
                        firstName: subtask.assignedUser.firstName,
                        lastName: subtask.assignedUser.lastName,
                        email: subtask.assignedUser.email
                      } : undefined
                    })) || []
                  })) || []
                };
                return { data: ganttData };
              } catch (error) {
                return { error: error instanceof Error ? error.message : 'Failed to load Gantt data' };
              }
            } else {
              return { error: 'Invalid project ID in gantt query' };
            }
          } else if (url.includes('/api/projects') && url.includes('/modules')) {
              // Get modules for a project  
              const match = url.match(/\/api\/projects\/([^\/]+)\/modules/);
              if (match && match[1]) {
                const projectId = match[1];
                try {
                  const modules = await storage.getModulesByProject(projectId);
                  return { data: modules || [] };
                } catch (error) {
                  return { error: error instanceof Error ? error.message : 'Failed to load modules' };
                }
              } else {
                return { error: 'Invalid project ID in modules query' };
              }
          } else if (url.includes('/api/projects') && url.includes('/milestones')) {
              // Get milestones for a project
              const match = url.match(/\/api\/projects\/([^\/]+)\/milestones/);
              if (match && match[1]) {
                const projectId = match[1];
                try {
                  const milestones = await storage.getMilestonesByProject(projectId);
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
      // Only allow admin and manager roles
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const [projects, milestones, metrics, workload, subtasks] = await Promise.allSettled([
        storage.getProjects(),
        storage.getMilestones(),
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
      const { segment, status } = req.query;
      
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
      if (segment && ['academic', 'parastals', 'private'].includes(segment as string)) {
        result.data = result.data.filter((p: any) => p.segment === segment);
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

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
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
        managerId: req.body.managerId || undefined,
      };

      if (!payload.client || !payload.contactPerson || !payload.contactPhone) {
        return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['client','contactPerson','contactPhone'], message: 'Client name, contact person, and contact phone are required' }] });
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

  app.put('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      // Check if phases already exist
      const existingPhases = await storage.getProjectPhases(req.params.id);
      if (existingPhases.length > 0) {
        // Phases already exist, return them with 200 OK
        res.status(200).json(existingPhases);
      } else {
        // Create new phases
        const phases = await storage.createProjectPhases(req.params.id);
        res.status(201).json(phases);
      }
    } catch (error) {
      console.error("Error handling project phases:", error);
      res.status(500).json({ message: "Failed to handle project phases" });
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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

  // Contract management routes
  app.get('/api/contracts', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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

  app.post('/api/contracts', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const contract = await storage.createContract(req.body);
      res.status(201).json(contract);
    } catch (error) {
      console.error("Error creating contract:", error);
      res.status(500).json({ message: "Failed to create contract" });
    }
  });

  app.put('/api/contracts/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const contract = await storage.updateContract(req.params.id, req.body);
      res.json(contract);
    } catch (error) {
      console.error("Error updating contract:", error);
      res.status(500).json({ message: "Failed to update contract" });
    }
  });

  app.post('/api/phases/:id/deliverables', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
        // Allow client to specify phaseNumber/phaseName; do not infer
        phaseNumber: typeof req.body.phaseNumber === 'number' ? req.body.phaseNumber : req.body.phaseNumber ? Number(req.body.phaseNumber) : null,
        phaseName: req.body.phaseName || null,
        startDate: toDateOrNull(req.body.startDate),
        endDate: toDateOrNull(req.body.endDate),
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Clean and validate date fields
      const cleanedData: any = { ...req.body };

      // Normalize module status: treat QA as client_review
      if (typeof cleanedData.status === 'string' && cleanedData.status.toLowerCase() === 'qa') {
        cleanedData.status = 'client_review';
      }
      
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
      if (!(await hasAdminPrivileges(req.user))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Clean and validate date fields
      const cleanedData: any = { ...req.body };
      // Allow explicit phaseNumber/phaseName from client
      if (cleanedData.phaseNumber !== undefined) {
        const n = Number(cleanedData.phaseNumber);
        cleanedData.phaseNumber = Number.isFinite(n) ? n : null;
      }
      if (cleanedData.phaseName !== undefined && cleanedData.phaseName !== null && cleanedData.phaseName !== '') {
        cleanedData.phaseName = String(cleanedData.phaseName);
      }
      // Normalize timestamp fields to Date for drizzle
      const toDateOrNull = (v: any) => {
        if (v === undefined || v === null || v === '') return null;
        if (v instanceof Date) return v;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      };
      if (req.body.startDate !== undefined) {
        cleanedData.startDate = toDateOrNull(req.body.startDate);
      }
      if (req.body.endDate !== undefined) {
        cleanedData.endDate = toDateOrNull(req.body.endDate);
      }
      
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
      
      const milestone = await storage.updateMilestone(req.params.id, cleanedData);
      res.json(milestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });

  app.delete('/api/milestones/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      await storage.deleteMilestone(req.params.id);
      res.json({ message: 'Milestone deleted successfully' });
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ message: "Failed to delete milestone" });
    }
  });

  // Milestone billing status update (none | to_send | sent | paid)
  app.put('/api/milestones/:id/billing-status', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const billingStatus = String(req.body.billingStatus || '').toLowerCase();
      const allowed = ['none','to_send','sent','processing','paid','overdue'];
      if (!allowed.includes(billingStatus)) {
        return res.status(400).json({ message: 'Invalid billing status' });
      }
      const milestone = await storage.updateMilestone(req.params.id, { billingStatus: billingStatus as any });
      res.json(milestone);
    } catch (error) {
      console.error('Error updating milestone billing status:', error);
      res.status(500).json({ message: 'Failed to update billing status' });
    }
  });



  app.put('/api/deliverables/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      let tasks: any[] = await storage.getTasksByProject(req.params.id) as any[];

      // Use getModulesByProject to get all milestones including Phase 3 with proper phase logic
      try {
        const projectModules = await storage.getModulesByProject(req.params.id);
        
        // Flatten the milestone data for Gantt chart
        const flattenedTasks: any[] = [];
        
        projectModules.forEach((milestone: any) => {
          if (milestone.isMilestone) {
            // For Phase 3 milestones, include the milestone itself and its modules
            if (milestone.phaseNumber === 3 && milestone.modules && milestone.modules.length > 0) {
              // Add the milestone as a parent task
              const milestoneTask = {
                id: milestone.id,
                name: milestone.name,
                startDate: milestone.startDate,
                dueDate: milestone.dueDate,
                status: 'not_started', // Milestone status
                progressPercent: 0,
                assignedUser: null,
                priority: milestone.priority || 'medium',
                phaseNumber: milestone.phaseNumber,
                phaseName: milestone.phaseName,
                subtasks: [],
                isMilestone: true,
                billingStatus: milestone.billingStatus || 'none',
                originalBillingStatus: milestone.billingStatus || 'none',
                isParent: true, // Mark as parent for Phase 3
              };
              flattenedTasks.push(milestoneTask);
              
              // Add modules under this milestone as child tasks
              milestone.modules.forEach((module: any) => {
                const moduleTask = {
                  id: module.id,
                  name: module.name,
                  startDate: module.startDate,
                  dueDate: module.dueDate,
                  status: module.status || 'not_started',
                  progressPercent: module.progressPercent || 0,
                  assignedUser: module.assignedUser,
                  priority: module.priority || 'medium',
                  phaseNumber: milestone.phaseNumber, // Inherit from parent milestone
                  phaseName: milestone.phaseName,
                  subtasks: module.subtasks || [],
                  isMilestone: false,
                  billingStatus: null,
                  originalBillingStatus: null,
                  parentMilestoneId: milestone.id, // Link to parent milestone
                  isChild: true, // Mark as child for Phase 3
                };
                flattenedTasks.push(moduleTask);
              });
            } else {
              // For non-Phase 3 milestones, add them as regular tasks
              const milestoneTask = {
                id: milestone.id,
                name: milestone.name,
                startDate: milestone.startDate,
                dueDate: milestone.dueDate,
                status: 'not_started',
                progressPercent: 0,
                assignedUser: null,
                priority: milestone.priority || 'medium',
                phaseNumber: milestone.phaseNumber,
                phaseName: milestone.phaseName,
                subtasks: milestone.subtasks || [],
                isMilestone: true,
                billingStatus: milestone.billingStatus || 'none',
                originalBillingStatus: milestone.billingStatus || 'none',
              };
              flattenedTasks.push(milestoneTask);
            }
          }
        });
        
        tasks = [...tasks, ...flattenedTasks];
      } catch (e) {
        console.warn('Gantt: failed to include milestones as tasks:', (e as any)?.message || e);
      }

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

      // Sort tasks by phase number (1-6), then by start date within each phase
      tasks.sort((a, b) => {
        // First sort by phase number
        const phaseA = a.phaseNumber || 999; // Put items without phase at the end
        const phaseB = b.phaseNumber || 999;
        
        if (phaseA !== phaseB) {
          return phaseA - phaseB;
        }
        
        // Within the same phase, sort by start date
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        
        // If dates are the same, sort by name for consistency
        return a.name.localeCompare(b.name);
      });

      // Calculate progress for each task based on subtasks and billing status
      const tasksWithCalculatedProgress = tasks.map(task => {
        let calculatedProgress = task.progressPercent;
        
        // If task has subtasks, calculate progress based on subtask status
        if (task.subtasks && task.subtasks.length > 0) {
          calculatedProgress = calculateSubtaskWeightBasedProgress(task.subtasks);
        }
        
        // For milestones, also consider billing status for progress calculation
        if (task.isMilestone && task.billingStatus) {
          let billingProgress = 0;
          switch (task.billingStatus) {
            case 'none':
            case 'to_send':
              billingProgress = 0;
              break;
            case 'sent':
              billingProgress = 50;
              break;
            case 'paid':
              billingProgress = 100;
              break;
            case 'overdue':
              billingProgress = 25;
              break;
            case 'processing':
              billingProgress = 75;
              break;
          }
          
          // Use the higher of subtask progress or billing progress
          calculatedProgress = Math.max(calculatedProgress, billingProgress);
        }
        
        return { ...task, progress: calculatedProgress };
      });

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
        tasks: tasksWithCalculatedProgress.map(task => ({
          id: task.id,
          name: task.name,
          startDate: task.startDate,
          dueDate: task.dueDate,
          status: task.status,
          progress: task.progress,
          assignedUser: task.assignedUser,
          priority: task.priority,
          phaseNumber: task.phaseNumber,
          phaseName: task.phaseName,
          subtasks: task.subtasks || [],
          isMilestone: (task as any).isMilestone || false,
          billingStatus: (task as any).billingStatus || null,
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
      if (task.assignedUserId !== req.user.id && !(await hasAdminPrivileges(req.user))) {
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

      // Default assignment: if both Dev and FC are unassigned, assign to project manager
      try {
        const devUnassigned = !cleaned.assignedDevId || cleaned.assignedDevId === 'unassigned';
        const fcUnassigned = !cleaned.assignedConsultantId || cleaned.assignedConsultantId === 'unassigned';
        if (devUnassigned && fcUnassigned) {
          if (cleaned.moduleId) {
            const mod = await storage.getModule(cleaned.moduleId);
            if (mod) {
              const proj = await storage.getProject(mod.projectId);
              if (proj?.managerId) {
                cleaned.assignedDevId = proj.managerId;
                cleaned.assignedConsultantId = proj.managerId;
              }
            }
          } else if (cleaned.milestoneId) {
            const ms = await storage.getMilestone(cleaned.milestoneId);
            if (ms) {
              const proj = await storage.getProject(ms.projectId);
              if (proj?.managerId) {
                cleaned.assignedDevId = proj.managerId;
                cleaned.assignedConsultantId = proj.managerId;
              }
            }
          }
        }
      } catch (_err) {
        // if lookup fails, continue without defaulting
      }

      // Validation path: allow either moduleId (Phase 3) OR milestoneId (other phases)
      let parentModule: any = null;
      let parentMilestone: any = null;
      let project: any = null;

      if (cleaned.moduleId) {
        parentModule = await storage.getModule(cleaned.moduleId);
        if (!parentModule) return res.status(400).json({ message: 'Module not found' });
        if (cleaned.startDate && parentModule.startDate && cleaned.startDate < parentModule.startDate) {
          return res.status(400).json({ message: 'Subtask start cannot be before module start' });
        }
        if (cleaned.dueDate && parentModule.dueDate && cleaned.dueDate > parentModule.dueDate) {
          return res.status(400).json({ message: 'Subtask due date cannot be after module due date' });
        }
        project = await storage.getProject(parentModule.projectId);
      } else if (cleaned.milestoneId) {
        parentMilestone = await storage.getMilestone(cleaned.milestoneId);
        if (!parentMilestone) return res.status(400).json({ message: 'Milestone not found' });
        project = await storage.getProject(parentMilestone.projectId);
      } else {
        return res.status(400).json({ message: 'Either moduleId or milestoneId is required' });
      }

      const subtask = await storage.createSubtask(cleaned);
      
      // Send notification if subtask is assigned to someone (assignee)
      if (subtask.assignedUserId) {
        try {
          const assignedUser = await storage.getUser(subtask.assignedUserId);
          if (assignedUser && project) {
            await notificationService.sendTaskAssignedNotification({
              task: { ...subtask, name: subtask.name, id: subtask.id },
              project,
              user: assignedUser,
              assignedBy: req.user
            });
          }
        } catch (notificationError) {
          console.error("Error sending subtask assignment notification:", notificationError);
        }
      }
      
      // Send notification for developer and consultant roles
      try {
        // If module path exists, use it; otherwise synthesize a module-like context from milestone
        let notifyModule = parentModule;
        if (!notifyModule && parentMilestone) {
          notifyModule = { id: parentMilestone.id, name: parentMilestone.name };
        }
        if (notifyModule && project) {
          await notificationService.sendSubtaskSpecializedRoleNotification({
            subtask,
            module: notifyModule,
            project,
            assignedBy: req.user
          });
        }
      } catch (notificationError) {
        console.error("Error sending specialized role notification:", notificationError);
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

      // Role-based status change restrictions - CHECK FIRST before workflow validation
      if (payload.status !== undefined && req.user.role === 'employee') {
        // Check if employee is assigned to this subtask
        const isAssignedToSubtask = 
          currentSubtask.assignedUserId === req.user.id ||
          currentSubtask.assignedDevId === req.user.id ||
          currentSubtask.assignedConsultantId === req.user.id;
        
        if (!isAssignedToSubtask) {
          return res.status(403).json({ 
            message: 'You can only modify subtasks assigned to you' 
          });
        }
      }

      // Enhanced workflow enforcement
      if (payload.status !== undefined) {
        const currentStatus = currentSubtask.status;
        const newStatus = payload.status;
        
        // Enforce workflow: in_progress → fc_review → qa → client_review → completed
        const allowedTransitions: Record<string, string[]> = {
          'not_started': ['in_progress'],
          'in_progress': ['fc_review', 'completed', 'on_hold', 'cancelled'],
          'fc_review': ['in_progress', 'qa', 'completed', 'on_hold', 'cancelled'], // FC can send back, move to QA, or mark complete
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
        
        // Additional role-based restrictions for status changes
        if (req.user.role === 'employee') {
          // Employees can only set status to fc_review, not to qa, client_review, or completed
          if (['qa', 'client_review', 'finished'].includes(newStatus)) {
            return res.status(403).json({ 
              message: 'Employees cannot set status to QA, Client Review, or Completed. Submit for FC review instead.' 
            });
          }
          
          // FCs can mark subtasks as completed, but Devs cannot
          if (newStatus === 'completed') {
            if (currentSubtask.assignedConsultantId === req.user.id) {
              // FC can mark as completed
              // Allow this to proceed
            } else {
              // Dev cannot mark as completed
              return res.status(403).json({ 
                message: 'Developers cannot mark subtasks as completed. Submit for FC review instead.' 
              });
            }
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
      
      // Check if developer or consultant assignments changed and send notification
      if ((payload.assignedDevId !== undefined && 
           payload.assignedDevId !== currentSubtask.assignedDevId) ||
          (payload.assignedConsultantId !== undefined && 
           payload.assignedConsultantId !== currentSubtask.assignedConsultantId)) {
        
        // Get the module/project details
        const module = await storage.getModule(currentSubtask.moduleId);
        const project = module ? await storage.getProject(module.projectId) : null;
        
        if (module && project) {
          // Send notification for specialized roles
          await notificationService.sendSubtaskSpecializedRoleNotification({
            subtask,
            module,
            project,
            assignedBy: req.user
          });
        }
      }
      
      // Send FC review notification when status changes to fc_review
      if (payload.status === 'fc_review' && currentSubtask.status !== 'fc_review') {
        try {
          // Get the module/project details
          const module = await storage.getModule(currentSubtask.moduleId);
          const project = module ? await storage.getProject(module.projectId) : null;
          
          if (module && project) {
            // Send specialized role notification for FC review
            await notificationService.sendSubtaskSpecializedRoleNotification({
              subtask: { ...subtask, name: subtask.name, id: subtask.id },
              module,
              project,
              assignedBy: req.user
            });
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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

  // Dashboard Gantt chart data endpoint - for specific project
  app.get('/api/dashboard/gantt/:projectId', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const phases = await storage.getProjectPhases(projectId);
      let tasks: any[] = await storage.getTasksByProject(projectId) as any[];

      // Also include non-Phase-3 milestones as task-like entries
      try {
        const projectMilestones = await storage.getMilestonesByProject(projectId);
        const milestoneTasks = (projectMilestones || [])
          .filter((m: any) => m && (m as any).phaseNumber !== 3)
          .map((m: any) => ({
            id: m.id,
            name: m.name,
            startDate: m.startDate,
            dueDate: m.endDate,
            status: m.status || 'not_started',
            progressPercent: 0,
            assignedUser: null,
            priority: m.priority || 'medium',
            phaseNumber: m.phaseNumber,
            phaseName: m.phaseName,
            subtasks: (m as any).subtasks || [],
            isMilestone: true,
            billingStatus: m.billingStatus || 'none',
          }));
        tasks = [...tasks, ...milestoneTasks];
      } catch (e) {
        console.warn('Dashboard Gantt: failed to include milestones as tasks:', (e as any)?.message || e);
      }

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

      // Calculate progress for each task based on subtasks and billing status
      const tasksWithCalculatedProgress = tasks.map(task => {
        let calculatedProgress = task.progressPercent;
        
        // If task has subtasks, calculate progress based on subtask status
        if (task.subtasks && task.subtasks.length > 0) {
          calculatedProgress = calculateSubtaskWeightBasedProgress(task.subtasks);
        }
        
        // For milestones, also consider billing status for progress calculation
        if ((task as any).isMilestone && (task as any).billingStatus) {
          let billingProgress = 0;
          switch ((task as any).billingStatus) {
            case 'none':
            case 'to_send':
              billingProgress = 0;
              break;
            case 'sent':
              billingProgress = 50;
              break;
            case 'paid':
              billingProgress = 100;
              break;
            case 'overdue':
              billingProgress = 25;
              break;
            case 'processing':
              billingProgress = 75;
              break;
          }
          
          // Use the higher of subtask progress or billing progress
          calculatedProgress = Math.max(calculatedProgress, billingProgress);
        }
        
        return {
          ...task,
          progress: calculatedProgress
        };
      });

      // Structure data for Gantt chart (same as project detail page)
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
        tasks: tasksWithCalculatedProgress.map(task => ({
          id: task.id,
          name: task.name,
          startDate: task.startDate,
          dueDate: task.dueDate,
          status: task.status,
          progress: task.progress,
          assignedUser: task.assignedUser,
          priority: task.priority,
          phaseNumber: task.phaseNumber,
          phaseName: task.phaseName,
          subtasks: task.subtasks || [],
          isMilestone: (task as any).isMilestone || false,
          billingStatus: (task as any).billingStatus || null,
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
      // Only admin and manager can access executive dashboard
      if (!(await hasAdminPrivileges(req.user))) {
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
  
  // Run comprehensive automation system on various endpoints
  const runAutomationChecks = async () => {
    try {
      await storage.checkModuleDeadlines();
      await storage.checkContractExpirations();
      console.log('Automation checks completed successfully');
    } catch (error) {
      console.error('Error in automation checks:', error);
    }
  };

  // Run automation on subtask requests
  app.use('/api/subtasks', async (req, res, next) => {
    await runAutomationChecks();
    next();
  });

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
      if (!(await hasAdminPrivileges((req as any).user))) {
        return res.status(403).json({ message: 'Only managers and admins can trigger deadline checks' });
      }
      
      await storage.checkModuleDeadlines();
      res.json({ message: 'Module deadline check completed successfully' });
    } catch (error) {
      console.error('Error checking module deadlines:', error);
      res.status(500).json({ message: 'Failed to check module deadlines' });
    }
  });

  // Contract expiration check automation endpoint
  app.post('/api/automation/check-contract-expirations', async (req, res) => {
    try {
      if (!(await hasAdminPrivileges((req as any).user))) {
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
      if (!(await hasAdminPrivileges((req as any).user))) {
        return res.status(403).json({ message: 'Only managers and admins can trigger automation checks' });
      }
      
      const results = {
        moduleDeadlines: { success: false, message: '' },
        contractExpirations: { success: false, message: '' },
        invoiceStatuses: { success: false, message: '' }
      };

      // Run module deadline checks
      try {
        await storage.checkModuleDeadlines();
        results.moduleDeadlines = { success: true, message: 'Module deadline checks completed' };
      } catch (error) {
        results.moduleDeadlines = { success: false, message: `Module deadline check failed: ${error}` };
      }

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

  // Hierarchy: list managers under a head role
  app.get('/api/admin/roles/:headRoleId/managers', isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
      if (!(await hasAdminPrivileges(req.user))) {
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
        // Get project modules with subtasks
        const modules = await storage.getModulesByProject(project.id);
    
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
        
        // Process modules (these are like "Finance Module" in your screenshot)
        for (const module of modules) {
          // Add module header row
          ganttData.push({
            'Type': 'MODULE',
            'Name': module.name,
            'Start Date': module.startDate ? new Date(module.startDate) : 'N/A',
            'End Date': module.dueDate ? new Date(module.dueDate) : 'N/A',
            'Duration (Days)': module.startDate && module.dueDate ? 
              Math.ceil((new Date(module.dueDate).getTime() - new Date(module.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
            'Status': module.status,
            'Progress (%)': module.progressPercent || 0,
            'Manager': module.assignedUser?.firstName || module.assignedUser?.email || 'Unassigned',
            'Client': '',
            'Budget (KSh)': module.feeAmount ? parseFloat(module.feeAmount).toLocaleString() : '0'
          });
          
          // Add subtasks for this module (these are like "Chart of Accounts & General Ledger Integrations" in your screenshot)
          if (module.subtasks && module.subtasks.length > 0) {
            for (const subtask of module.subtasks) {
              // Get developer and consultant information
              let developerName = 'N/A';
              let consultantName = 'N/A';
              
              if (subtask.assignedDevId) {
                try {
                  const developer = await storage.getUser(subtask.assignedDevId);
                  if (developer) {
                    developerName = developer.firstName || developer.email || 'N/A';
                  }
                } catch (error) {
                  console.error(`Error fetching developer for subtask ${subtask.id}:`, error);
                }
              }
              
              if (subtask.assignedConsultantId) {
                try {
                  const consultant = await storage.getUser(subtask.assignedConsultantId);
                  if (consultant) {
                    consultantName = consultant.firstName || consultant.email || 'N/A';
                  }
                } catch (error) {
                  console.error(`Error fetching consultant for subtask ${subtask.id}:`, error);
                }
              }
              
              ganttData.push({
                'Type': 'SUBTASK',
                'Name': subtask.name,
                'Start Date': subtask.startDate ? new Date(subtask.startDate) : 'N/A',
                'End Date': subtask.dueDate ? new Date(subtask.dueDate) : 'N/A',
                'Duration (Days)': subtask.startDate && subtask.dueDate ? 
                  Math.ceil((new Date(subtask.dueDate).getTime() - new Date(subtask.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
                'Status': subtask.status,
                'Progress (%)': subtask.progressPercent || 0,
                'Manager': subtask.assignedUser?.firstName || subtask.assignedUser?.email || 'Unassigned',
                'Developer': developerName,
                'Consultant': consultantName,
                'Client': '',
                'Budget (KSh)': subtask.feeAmount ? parseFloat(subtask.feeAmount).toLocaleString() : '0'
              });
            }
          }
          
          // Add spacing row between modules
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
