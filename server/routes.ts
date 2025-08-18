import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import {
  insertProjectSchema,
  insertTaskSchema,
  insertTeamSchema,
  insertTeamMemberSchema,
  insertNotificationSchema,
} from "@shared/schema";
import { z } from "zod";
import { generateExcelBuffer } from "./utils/excelExport";
import { notificationService } from "./services/notificationService";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes are now handled in setupAuth

  // Users listing (for selecting team members)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const role = (req.query.role as string) || undefined;
      const q = (req.query.q as string) || undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
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

  // Export routes
  app.post('/api/reports/export', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { reportType, format = 'excel', filters = {} } = req.body;
      console.log('Export request:', { reportType, format, filters });

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
      const teams = req.user.role === 'employee'
        ? await storage.getTeamsForUser(req.user.id)
        : await storage.getTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.get('/api/teams/:id', isAuthenticated, async (req, res) => {
    try {
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

      if (Array.isArray(members) && members.length > 0) {
        const uniqueMembers = Array.from(new Set(members as string[]));
        for (const userId of uniqueMembers) {
          await storage.addTeamMember({ teamId: team.id, userId, role: 'member' });
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

  app.delete('/api/teams/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      await storage.deleteTeam(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Project routes
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const projects = req.user.role === 'employee'
        ? await storage.getProjectsForUser(req.user.id)
        : await storage.getProjects();
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
        name: String(req.body.name || '').trim(),
        description: String(req.body.description || '').trim(),
        client: req.body.client ? String(req.body.client).trim() : undefined,
        startDate: start,
        endDate: end,
        status: req.body.status || undefined,
        budget: req.body.budget === undefined || req.body.budget === null || req.body.budget === ''
          ? undefined
          : String(req.body.budget),
        teamId: req.body.teamId || undefined,
        managerId: req.user.id,
      };

      if (!payload.name || !payload.description) {
        return res.status(400).json({ message: 'Invalid project data', errors: [{ path: ['name','description'], message: 'Name and description are required' }] });
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
        name: req.body.name ? String(req.body.name).trim() : undefined,
        description: req.body.description ? String(req.body.description).trim() : undefined,
        client: req.body.client ? String(req.body.client).trim() : undefined,
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

  app.delete('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
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
      res.json(tasks);
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

      // Fee is required for milestones
      if (cleaned.feeAmount == null) {
        if (req.body.fee != null) cleaned.feeAmount = String(req.body.fee);
      }
      if (cleaned.feeAmount == null || String(cleaned.feeAmount).trim() === '' || isNaN(Number(cleaned.feeAmount))) {
        return res.status(400).json({ message: 'Invalid task data', errors: [{ path: ['feeAmount'], message: 'Milestone fee is required' }] });
      }

      // Default progress for status if not provided
      if (cleaned.status && cleaned.progressPercent == null) {
        const statusMap: Record<string, number> = { todo: 0, in_progress: 50, review: 75, done: 100 };
        cleaned.progressPercent = statusMap[cleaned.status] ?? 0;
      }
      // Manager/Admin can create as done -> mark to_send
      if (cleaned.status === 'done' && (req as any).user.role !== 'employee') {
        cleaned.billingStatus = 'to_send';
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

      const taskData = insertTaskSchema.parse(cleaned);

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
      if (req.body.billingStatus !== undefined) payload.billingStatus = req.body.billingStatus;
      
      // Handle feeAmount - convert to string if it's a number
      if (req.body.feeAmount !== undefined) {
        payload.feeAmount = String(req.body.feeAmount);
      }
      
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
        const statusMap: Record<string, number> = { todo: 0, in_progress: 50, review: 75, done: 100 };
        payload.progressPercent = statusMap[payload.status] ?? 0;
      }
      
      // Manager/Admin sets done -> mark billing to_send
      try {
        const reqAny = req as any;
        if (reqAny.user?.role !== 'employee' && payload.status === 'done') {
          payload.billingStatus = 'to_send';
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
          // Notify when task is moved to review
          if (payload.status === 'review' && existing?.status !== 'review') {
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
  app.put('/api/tasks/:id/billing-status', isAuthenticated, async (req: any, res) => {
    try {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const allowed = new Set(['none', 'to_send', 'sent', 'paid']);
      const { billingStatus } = req.body || {};
      if (!allowed.has(billingStatus)) {
        return res.status(400).json({ message: 'Invalid billing status' });
      }
      const task = await storage.updateTask(req.params.id, { billingStatus });
      res.json(task);
    } catch (error) {
      console.error('Error updating billing status:', error);
      res.status(500).json({ message: 'Failed to update billing status' });
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
