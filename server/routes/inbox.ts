import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { requirePermission } from "../utils/permissions";
import { z } from "zod";
import { getInboxThreads, getConversationMessages, replyToEmail } from "../services/microsoftGraphService";
import { processInboxForUser } from "../services/emailTicketingService";

const replySchema = z.object({
  messageId: z.string().min(1, "messageId is required"),
  bodyHtml: z.string().min(1, "Reply body cannot be empty"),
});

export function registerInboxRoutes(app: Express) {
  app.get('/api/inbox/connection-status', isAuthenticated, requirePermission('inbox.manage'), async (req: any, res) => {
    try {
      const settings = await storage.getUserMicrosoftSettings(req.user.id);
      res.json({
        connected: settings.connected,
        mailboxEmail: settings.mailboxEmail,
        lastSyncAt: settings.lastSyncAt,
        lastSyncError: settings.lastSyncError,
      });
    } catch (error) {
      console.error('Error fetching inbox connection status:', error);
      res.status(500).json({ message: 'Failed to fetch connection status' });
    }
  });

  app.post('/api/inbox/sync-now', isAuthenticated, requirePermission('inbox.manage'), async (req: any, res) => {
    try {
      const result = await processInboxForUser(req.user.id);
      res.json(result);
    } catch (error) {
      console.error('Error running manual inbox sync:', error);
      res.status(500).json({ message: 'Failed to sync inbox' });
    }
  });

  app.get('/api/inbox/threads', isAuthenticated, requirePermission('inbox.manage'), async (req: any, res) => {
    try {
      const settings = await storage.getUserMicrosoftSettings(req.user.id);
      if (!settings.connected) {
        return res.status(400).json({ message: 'Microsoft 365 is not connected' });
      }
      const threads = await getInboxThreads(req.user.id);
      res.json(threads);
    } catch (error) {
      console.error('Error fetching inbox threads:', error);
      res.status(500).json({ message: 'Failed to fetch inbox threads' });
    }
  });

  app.get('/api/inbox/threads/:conversationId', isAuthenticated, requirePermission('inbox.manage'), async (req: any, res) => {
    try {
      const settings = await storage.getUserMicrosoftSettings(req.user.id);
      if (!settings.connected) {
        return res.status(400).json({ message: 'Microsoft 365 is not connected' });
      }
      const messages = await getConversationMessages(req.user.id, req.params.conversationId);
      const linkedTicket = await storage.getTicketByEmailConversationId(req.params.conversationId);
      res.json({ messages, linkedTicketId: linkedTicket?.id || null });
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      res.status(500).json({ message: 'Failed to fetch conversation messages' });
    }
  });

  app.post('/api/inbox/threads/:conversationId/reply', isAuthenticated, requirePermission('inbox.manage'), async (req: any, res) => {
    try {
      const { messageId, bodyHtml } = replySchema.parse(req.body);
      await replyToEmail(req.user.id, messageId, bodyHtml);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request', errors: error.errors });
      }
      console.error('Error sending reply:', error);
      res.status(500).json({ message: 'Failed to send reply' });
    }
  });
}
