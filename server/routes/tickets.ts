import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { insertTicketSchema, insertServiceCategorySchema } from "../../shared/schema";
import { z } from "zod";
import { requirePermission, userHasPermission } from "../utils/permissions";
import { notificationService } from "../services/notificationService";

const assignTicketSchema = z.object({
  assignedToUserId: z.string().nullable().optional(),
  assignedTeamId: z.string().nullable().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  rootCause: z.string().optional(),
  resolutionNotes: z.string().optional(),
});

const escalateTicketSchema = z.object({
  escalatedToUserId: z.string().min(1, "escalatedToUserId is required"),
  reason: z.string().min(1, "A reason for escalation is required"),
});

const addCommentSchema = z.object({
  comment: z.string().min(1, "Comment cannot be empty"),
});

export function registerTicketRoutes(app: Express) {
  // Public endpoint: List active projects for public ticket creation (no auth required)
  app.get('/api/public/projects', async (_req, res) => {
    try {
      const allProjects = await storage.getProjects();
      const publicList = (Array.isArray(allProjects) ? allProjects : [])
        .filter((p: any) => p.status !== 'inactive' && p.status !== 'support_closed')
        .map((p: any) => ({
          id: p.id,
          name: p.name || p.client,
          companyName: p.company?.name || p.client,
          companyId: p.companyId,
        }));
      res.json(publicList);
    } catch (error) {
      console.error('Error fetching public projects:', error);
      res.status(500).json({ message: 'Failed to fetch projects' });
    }
  });

  // Public endpoint: Submit support ticket from landing page / public form
  app.post('/api/public/tickets', async (req, res) => {
    try {
      const {
        projectId,
        type,
        subject,
        description,
        contactName,
        contactEmail,
        contactPhone,
        screenshots,
      } = req.body;

      if (!projectId) {
        return res.status(400).json({ message: 'Please select a project' });
      }
      if (!subject || !subject.trim()) {
        return res.status(400).json({ message: 'Issue title/subject is required' });
      }
      if (!description || !description.trim()) {
        return res.status(400).json({ message: 'Issue description is required' });
      }
      if (!['complaint', 'suggestion', 'enquiry', 'compliment'].includes(type)) {
        return res.status(400).json({ message: 'Invalid ticket type' });
      }
      if (!contactEmail || !contactEmail.trim()) {
        return res.status(400).json({ message: 'Contact email is required' });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Assign to a system creator ID
      let defaultUserId = project.managerId;
      if (!defaultUserId) {
        const users = await storage.getUsers();
        defaultUserId = users[0]?.id;
      }

      if (!defaultUserId) {
        return res.status(500).json({ message: 'System configuration error: No user available to log ticket' });
      }

      // Append screenshot markdown to description if provided
      let enrichedDescription = description.trim();
      if (Array.isArray(screenshots) && screenshots.length > 0) {
        enrichedDescription += '\n\n---\n### Attached Screenshots:';
        screenshots.forEach((img: string, idx: number) => {
          enrichedDescription += `\n\n![Screenshot ${idx + 1}](${img})`;
        });
      }

      const ticketCount = await storage.getTicketCount();
      const ticketNumber = `TKT-${String(ticketCount + 1).padStart(5, '0')}`;

      const newTicket = await storage.createTicket({
        ticketNumber,
        projectId,
        companyId: project.companyId || (await storage.getCompanies())[0]?.id,
        type,
        subject: subject.trim(),
        description: enrichedDescription,
        status: 'open',
        priority: 'medium',
        contactName: contactName ? contactName.trim() : undefined,
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone ? contactPhone.trim() : undefined,
        createdByUserId: defaultUserId,
        assignedToUserId: project.managerId || null,
        assignedTeamId: project.teamId || null,
        categoryId: null,
      } as any);

      res.status(201).json({
        success: true,
        ticketNumber: newTicket.ticketNumber,
        id: newTicket.id,
        message: 'Your ticket has been submitted successfully.',
      });
    } catch (error) {
      console.error('Error submitting public ticket:', error);
      res.status(500).json({ message: 'Failed to submit ticket' });
    }
  });

  // Service categories (admin manages these; anyone authenticated can list them for the create-ticket form)
  app.get('/api/service-categories', isAuthenticated, async (req, res) => {
    try {
      let categories = await storage.getServiceCategories();
      const type = req.query.type as string | undefined;
      if (type === 'complaint' || type === 'enquiry') {
        categories = categories.filter((c) => c.type === type);
      }
      res.json(categories);
    } catch (error) {
      console.error('Error fetching service categories:', error);
      res.status(500).json({ message: 'Failed to fetch service categories' });
    }
  });

  app.post('/api/service-categories', isAuthenticated, requirePermission('service_categories.manage'), async (req, res) => {
    try {
      const data = insertServiceCategorySchema.parse(req.body);
      const category = await storage.createServiceCategory(data);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid category data', errors: error.errors });
      }
      console.error('Error creating service category:', error);
      res.status(500).json({ message: 'Failed to create service category' });
    }
  });

  app.put('/api/service-categories/:id', isAuthenticated, requirePermission('service_categories.manage'), async (req, res) => {
    try {
      const data = insertServiceCategorySchema.partial().parse(req.body);
      const category = await storage.updateServiceCategory(req.params.id, data);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid category data', errors: error.errors });
      }
      console.error('Error updating service category:', error);
      res.status(500).json({ message: 'Failed to update service category' });
    }
  });

  app.delete('/api/service-categories/:id', isAuthenticated, requirePermission('service_categories.manage'), async (req, res) => {
    try {
      await storage.deleteServiceCategory(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting service category:', error);
      res.status(400).json({ message: 'Failed to delete service category (it may still be used by existing tickets)' });
    }
  });

  // Tickets
  app.get('/api/tickets', isAuthenticated, async (req: any, res) => {
    try {
      const view = (req.query.view as string) || 'mine';

      if (view === 'all') {
        if (!(await userHasPermission(req.user, 'tickets.view_all'))) {
          return res.status(403).json({ message: 'Forbidden' });
        }
      }

      let tickets: any[];
      if (view === 'assigned') {
        tickets = await storage.getTickets({ assignedToUserId: req.user.id });
      } else if (view === 'all') {
        tickets = await storage.getTickets({});
      } else if (view === 'feedback') {
        // Compliments/suggestions never carry workflow state or assignment, so they're
        // shown to every authenticated user regardless of tickets.view_all - low-stakes
        // feedback, not sensitive case data.
        tickets = await storage.getTickets({ types: ['compliment', 'suggestion'] });
      } else {
        tickets = await storage.getTickets({ createdByUserId: req.user.id });
      }
      res.json(tickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      res.status(500).json({ message: 'Failed to fetch tickets' });
    }
  });

  app.get('/api/tickets/:id', isAuthenticated, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }
      const comments = await storage.getTicketComments(req.params.id);
      res.json({ ...ticket, comments });
    } catch (error) {
      console.error('Error fetching ticket:', error);
      res.status(500).json({ message: 'Failed to fetch ticket' });
    }
  });

  app.post('/api/tickets', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertTicketSchema.parse(req.body);
      const project = await storage.getProject(data.projectId);
      if (!project) {
        return res.status(400).json({ message: 'Project not found' });
      }

      const needsCategory = data.type === 'complaint' || data.type === 'enquiry';
      if (needsCategory) {
        if (!data.categoryId) {
          return res.status(400).json({ message: 'Category is required for complaint/enquiry tickets' });
        }
        const category = await storage.getServiceCategory(data.categoryId);
        if (!category) {
          return res.status(400).json({ message: 'Category not found' });
        }
        if (category.type !== data.type) {
          return res.status(400).json({ message: `Category type (${category.type}) does not match ticket type (${data.type})` });
        }
      } else {
        // Compliment/suggestion tickets never go through category/assignment workflow,
        // regardless of what the client sent.
        data.categoryId = null as any;
        (data as any).assignedToUserId = null;
        (data as any).assignedTeamId = null;
      }

      const ticketCount = await storage.getTicketCount();
      const ticketNumber = `TKT-${String(ticketCount + 1).padStart(5, '0')}`;

      const ticket = await storage.createTicket({
        ...data,
        companyId: data.companyId || project.companyId || undefined,
        createdByUserId: req.user.id,
        ticketNumber,
      } as any);

      if (ticket.assignedToUserId) {
        const assignee = await storage.getUser(ticket.assignedToUserId);
        if (assignee) {
          await notificationService.sendTicketAssignedNotification(ticket, assignee);
        }
      }

      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid ticket data', errors: error.errors });
      }
      console.error('Error creating ticket:', error);
      res.status(500).json({ message: 'Failed to create ticket' });
    }
  });

  app.put('/api/tickets/:id/assign', isAuthenticated, requirePermission('tickets.manage'), async (req, res) => {
    try {
      const { assignedToUserId, assignedTeamId } = assignTicketSchema.parse(req.body);
      const ticket = await storage.assignTicket(req.params.id, assignedToUserId ?? null, assignedTeamId ?? null);

      if (assignedToUserId) {
        const assignee = await storage.getUser(assignedToUserId);
        if (assignee) {
          await notificationService.sendTicketAssignedNotification(ticket, assignee);
        }
      }

      await storage.addTicketComment({
        ticketId: ticket.id,
        userId: (req as any).user.id,
        comment: assignedToUserId ? 'Ticket assigned' : 'Ticket unassigned',
      });

      res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request', errors: error.errors });
      }
      console.error('Error assigning ticket:', error);
      res.status(500).json({ message: 'Failed to assign ticket' });
    }
  });

  app.post('/api/tickets/:id/escalate', isAuthenticated, async (req: any, res) => {
    try {
      const existing = await storage.getTicket(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: 'Ticket not found' });
      }
      const isAssignee = existing.assignedToUserId === req.user.id;
      if (!isAssignee && !(await userHasPermission(req.user, 'tickets.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { escalatedToUserId, reason } = escalateTicketSchema.parse(req.body);
      const escalatedFromUserId = existing.assignedToUserId || req.user.id;

      const ticket = await storage.recordTicketEscalation(req.params.id, {
        escalatedToUserId,
        escalatedFromUserId,
        reason,
      });

      const escalatedByUser = await storage.getUser(req.user.id);
      const newAssignee = await storage.getUser(escalatedToUserId);

      await storage.addTicketComment({
        ticketId: ticket.id,
        userId: req.user.id,
        comment: `Escalated to ${newAssignee ? `${newAssignee.firstName || ''} ${newAssignee.lastName || ''}`.trim() || newAssignee.email : 'another user'}: ${reason}`,
      });

      if (newAssignee) {
        await notificationService.sendTicketEscalatedNotification(ticket, newAssignee, escalatedByUser, reason);
      }

      res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request', errors: error.errors });
      }
      console.error('Error escalating ticket:', error);
      res.status(500).json({ message: 'Failed to escalate ticket' });
    }
  });

  app.put('/api/tickets/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const existing = await storage.getTicket(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: 'Ticket not found' });
      }
      const isOwnerOrAssignee = existing.createdByUserId === req.user.id || existing.assignedToUserId === req.user.id;
      if (!isOwnerOrAssignee && !(await userHasPermission(req.user, 'tickets.manage'))) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { status, rootCause, resolutionNotes } = updateStatusSchema.parse(req.body);

      const isNewlyResolved = status === 'resolved' && existing.status !== 'resolved' && existing.status !== 'closed';
      if (isNewlyResolved && (!rootCause?.trim() || !resolutionNotes?.trim())) {
        return res.status(400).json({ message: 'Root cause and resolution notes are required to resolve a ticket' });
      }

      const ticket = await storage.updateTicketStatus(
        req.params.id,
        status,
        isNewlyResolved ? { rootCause: rootCause!.trim(), resolutionNotes: resolutionNotes!.trim() } : undefined
      );

      await storage.addTicketComment({
        ticketId: ticket.id,
        userId: req.user.id,
        comment: `Status changed to ${status.replace('_', ' ')}`,
      });

      if (isNewlyResolved) {
        const requester = await storage.getUser(ticket.createdByUserId);
        if (requester) {
          await notificationService.sendTicketResolvedNotification(ticket, requester);
        }
      }

      res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request', errors: error.errors });
      }
      console.error('Error updating ticket status:', error);
      res.status(500).json({ message: 'Failed to update ticket status' });
    }
  });

  app.post('/api/tickets/:id/comments', isAuthenticated, async (req: any, res) => {
    try {
      const { comment } = addCommentSchema.parse(req.body);
      const created = await storage.addTicketComment({
        ticketId: req.params.id,
        userId: req.user.id,
        comment,
      });
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request', errors: error.errors });
      }
      console.error('Error adding ticket comment:', error);
      res.status(500).json({ message: 'Failed to add comment' });
    }
  });
}
