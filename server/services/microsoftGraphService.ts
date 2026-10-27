import { storage } from "../storage";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`;

export interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
}

/**
 * Ensures a valid (non-expired) access token for the user, refreshing via the Microsoft
 * identity platform token endpoint if needed. Graph access tokens expire in ~60-90 minutes,
 * so — unlike the Google Calendar integration — this refresh path is exercised on every sync.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const settings = await storage.getUserMicrosoftSettings(userId);
  if (!settings.connected || !settings.accessToken) return null;

  const expiry = settings.tokenExpiry ? new Date(settings.tokenExpiry).getTime() : 0;
  const stillValid = expiry - Date.now() > 5 * 60 * 1000; // 5 min buffer
  if (stillValid) return settings.accessToken;

  if (!settings.refreshToken) return null;

  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: settings.refreshToken,
        grant_type: "refresh_token",
        scope: "offline_access Mail.Read Mail.ReadWrite Mail.Send User.Read",
      }),
    });
    const tokens = await response.json();
    if (tokens.error) {
      console.error("[microsoftGraphService] Token refresh failed:", tokens.error_description || tokens.error);
      await storage.updateUserMicrosoftSettings(userId, { lastSyncError: `Token refresh failed: ${tokens.error}` });
      return null;
    }

    await storage.updateUserMicrosoftSettings(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || settings.refreshToken,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    });
    return tokens.access_token;
  } catch (error) {
    console.error("[microsoftGraphService] Token refresh error:", error);
    return null;
  }
}

async function graphFetch(userId: string, path: string, init?: RequestInit): Promise<any> {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error("No valid Microsoft access token for user");

  const response = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Graph API ${response.status}: ${text}`);
  }
  if (response.status === 202 || response.headers.get("content-length") === "0") return null;
  return response.json();
}

/** Lists inbox messages, newest first. Used by the Messages tab of /inbox. */
export async function getInboxThreads(userId: string, top = 25): Promise<GraphMessage[]> {
  const data = await graphFetch(
    userId,
    `/me/mailFolders/inbox/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,conversationId,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead,hasAttachments`
  );
  return data?.value || [];
}

/** Full chronological message history for a conversation thread. */
export async function getConversationMessages(userId: string, conversationId: string): Promise<GraphMessage[]> {
  const filter = encodeURIComponent(`conversationId eq '${conversationId}'`);
  // No $orderby here: Graph rejects a conversationId $filter combined with a sort ("InefficientFilter"),
  // so the thread is sorted oldest-first in code instead.
  const data = await graphFetch(
    userId,
    `/me/messages?$filter=${filter}&$top=50&$select=id,conversationId,subject,body,bodyPreview,from,toRecipients,receivedDateTime,isRead,hasAttachments`
  );
  const messages: GraphMessage[] = data?.value || [];
  return messages.sort((a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime());
}

export async function replyToEmail(userId: string, messageId: string, bodyHtml: string): Promise<void> {
  await graphFetch(userId, `/me/messages/${messageId}/reply`, {
    method: "POST",
    body: JSON.stringify({ comment: bodyHtml }),
  });
}

export async function sendNewEmail(userId: string, to: string, subject: string, bodyHtml: string): Promise<void> {
  await graphFetch(userId, `/me/sendMail`, {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: bodyHtml },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
}

/**
 * Delta-query new inbox messages since the user's stored deltaLink. On first sync (no
 * deltaLink yet), Graph's delta endpoint still returns the current inbox state — the caller
 * is responsible for bounding a first sync to recent messages only (see emailTicketingService).
 */
export async function getInboxDelta(userId: string, deltaLink: string | null): Promise<{ messages: GraphMessage[]; newDeltaLink: string }> {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error("No valid Microsoft access token for user");

  const url = deltaLink || `${GRAPH_BASE}/me/mailFolders/inbox/messages/delta?$select=id,conversationId,subject,body,bodyPreview,from,toRecipients,receivedDateTime,isRead,hasAttachments`;

  let messages: GraphMessage[] = [];
  let nextUrl: string | null = url;
  let newDeltaLink = deltaLink || "";

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Graph delta API ${response.status}: ${text}`);
    }
    const data: any = await response.json();
    messages = messages.concat(data.value || []);
    nextUrl = data["@odata.nextLink"] || null;
    if (data["@odata.deltaLink"]) newDeltaLink = data["@odata.deltaLink"];
  }

  return { messages, newDeltaLink };
}
