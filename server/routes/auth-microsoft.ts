import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";

const MICROSOFT_SCOPES = "offline_access Mail.Read Mail.ReadWrite Mail.Send User.Read";

function authorizeUrl(userId: string): string {
  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?` +
    `client_id=${process.env.MICROSOFT_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI || "")}&` +
    `scope=${encodeURIComponent(MICROSOFT_SCOPES)}&` +
    `response_type=code&` +
    `response_mode=query&` +
    `prompt=consent&` +
    `state=${userId}`;
}

export function registerMicrosoftAuthRoutes(app: Express) {
  app.get('/api/auth/microsoft', isAuthenticated, async (req: any, res) => {
    try {
      res.json({ authUrl: authorizeUrl(req.user.id) });
    } catch (error) {
      console.error("Error generating Microsoft auth URL:", error);
      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  app.get('/api/auth/microsoft/callback', async (req: any, res) => {
    try {
      const { code, state } = req.query;
      const userId = state as string;

      if (!code || !userId) {
        return res.status(400).json({ message: "Missing authorization code or user ID" });
      }

      const tenant = process.env.MICROSOFT_TENANT_ID || "common";
      const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          code: code as string,
          grant_type: 'authorization_code',
          redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
          scope: MICROSOFT_SCOPES,
        }),
      });

      const tokens = await tokenResponse.json();
      if (tokens.error) {
        throw new Error(`Microsoft OAuth error: ${tokens.error_description || tokens.error}`);
      }

      let mailboxEmail = '';
      try {
        const meResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (meResponse.ok) {
          const me = await meResponse.json();
          mailboxEmail = me.mail || me.userPrincipalName || '';
        }
      } catch (meError) {
        console.warn('Could not fetch Microsoft mailbox address, continuing without it:', meError);
      }

      await storage.updateUserMicrosoftSettings(userId, {
        connected: true,
        mailboxEmail,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        lastSyncError: null,
      });

      res.redirect('/inbox?microsoft=connected');
    } catch (error) {
      console.error("Error in Microsoft OAuth callback:", error);
      res.redirect('/inbox?microsoft=error');
    }
  });

  app.post('/api/user/microsoft-disconnect', isAuthenticated, async (req: any, res) => {
    try {
      await storage.updateUserMicrosoftSettings(req.user.id, {
        connected: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        deltaLink: null,
      });
      res.json({ message: "Microsoft 365 disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting Microsoft 365:", error);
      res.status(500).json({ message: "Failed to disconnect Microsoft 365" });
    }
  });
}
