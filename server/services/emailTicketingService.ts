import { storage } from "../storage";
import { getInboxDelta, type GraphMessage } from "./microsoftGraphService";
import { classifyTicket, type ExistingTicketContext } from "./aiClassificationService";

// Fixed and deliberately high (not user-configurable, unlike the ticket-form threshold) —
// email inboxes carry far more noise (newsletters, automated notices) than a purpose-built
// support form, and this flow creates tickets with no human confirmation step.
const AI_EMAIL_TICKET_CONFIDENCE_THRESHOLD = 0.85;

const FIRST_SYNC_LOOKBACK_HOURS = 48;

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function senderDomain(email: string): string {
  const parts = email.toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : "";
}

/**
 * Processes one user's inbox: fetches new messages since the last sync, matches each to a
 * ticket (existing conversation, existing duplicate/follow-up, or a brand-new one), and
 * auto-creates tickets only when the AI classification clears AI_EMAIL_TICKET_CONFIDENCE_THRESHOLD.
 * Never throws — sync errors are recorded on the user's settings row for the Inbox Settings tab.
 */
export async function processInboxForUser(userId: string): Promise<{ processed: number; created: number; linked: number }> {
  const settings = await storage.getUserMicrosoftSettings(userId);
  if (!settings.connected) return { processed: 0, created: 0, linked: 0 };

  let processed = 0, created = 0, linked = 0;

  try {
    const isFirstSync = !settings.deltaLink;
    const { messages, newDeltaLink } = await getInboxDelta(userId, settings.deltaLink);

    const cutoff = isFirstSync ? Date.now() - FIRST_SYNC_LOOKBACK_HOURS * 60 * 60 * 1000 : 0;
    const relevantMessages = isFirstSync
      ? messages.filter((m) => new Date(m.receivedDateTime).getTime() >= cutoff)
      : messages;

    for (const message of relevantMessages) {
      try {
        const wasHandled = await processMessage(message);
        processed++;
        if (wasHandled === "created") created++;
        if (wasHandled === "linked") linked++;
      } catch (msgError) {
        console.error(`[emailTicketingService] Failed processing message ${message.id}:`, msgError);
      }
    }

    await storage.updateUserMicrosoftSettings(userId, {
      deltaLink: newDeltaLink,
      lastSyncAt: new Date(),
      lastSyncError: null,
    });
  } catch (error) {
    console.error(`[emailTicketingService] Sync failed for user ${userId}:`, error);
    await storage.updateUserMicrosoftSettings(userId, {
      lastSyncAt: new Date(),
      lastSyncError: error instanceof Error ? error.message : String(error),
    });
  }

  return { processed, created, linked };
}

async function processMessage(message: GraphMessage): Promise<"created" | "linked" | "skipped"> {
  const senderEmail = message.from?.emailAddress?.address?.toLowerCase();
  if (!senderEmail) return "skipped";

  // Step 1: same-thread dedup — a reply on an already-ticketed conversation is a comment, not a new ticket.
  const existingByConversation = await storage.getTicketByEmailConversationId(message.conversationId);
  if (existingByConversation) {
    await storage.addTicketComment({
      ticketId: existingByConversation.id,
      userId: null as any,
      comment: `Email from ${message.from.emailAddress.name || senderEmail}: ${htmlToText(message.bodyPreview || message.body?.content || "").slice(0, 2000)}`,
    });
    return "linked";
  }

  // Step 2: match sender domain to a company.
  const domain = senderDomain(senderEmail);
  if (!domain) return "skipped";
  const company = await storage.getCompanyByEmailDomain(domain);
  if (!company) return "skipped"; // Left unticketed by design — no guessing which company this is.

  // Step 3: resolve project — single active project auto-picked, multiple → AI chooses.
  const allProjects = await storage.getProjects();
  const candidateProjects = (Array.isArray(allProjects) ? allProjects : [])
    .filter((p: any) => p.companyId === company.id && p.status !== 'inactive' && p.status !== 'support_closed')
    .map((p: any) => ({ id: p.id, name: p.name }));
  if (candidateProjects.length === 0) return "skipped";

  const subject = message.subject || "(no subject)";
  const description = htmlToText(message.body?.content || message.bodyPreview || "");

  // Step 4: build duplicate/follow-up context from the resolved project's open tickets —
  // only meaningful once we have a single candidate project to pull context for. When
  // multiple projects are candidates, classification picks the project first (this call),
  // and duplicate detection against that project's tickets happens in a second pass below.
  const singleProject = candidateProjects.length === 1 ? candidateProjects[0] : null;
  const existingTickets = singleProject ? await buildExistingTicketContext(singleProject.id, senderEmail) : [];

  const availableCategories = (await storage.getServiceCategories())
    .filter((c: any) => c.isActive)
    .map((c: any) => ({ id: c.id, name: c.name, type: c.type }));

  const classification = await classifyTicket({
    subject,
    description,
    availableCategories,
    candidateProjects: singleProject ? undefined : candidateProjects,
    existingTickets,
  });

  if (!classification) return "skipped";

  // Only complaint/enquiry tickets carry a category, and the category's own type must match
  // the ticket's type — guard against the model picking a category that doesn't fit (the
  // authenticated create route enforces this too; the auto-ticketing path has no such gate).
  const needsCategory = classification.suggestedType === 'complaint' || classification.suggestedType === 'enquiry';
  const category = availableCategories.find((c) => c.id === classification.suggestedCategoryId);
  if (!needsCategory || !category || category.type !== classification.suggestedType) {
    classification.suggestedCategoryId = null;
  }

  // If multiple candidate projects, re-run duplicate detection now that a project is chosen.
  let resolvedProjectId = singleProject?.id || classification.suggestedProjectId;
  let finalExistingTicketId = classification.existingTicketId;
  if (!singleProject && resolvedProjectId) {
    const context = await buildExistingTicketContext(resolvedProjectId, senderEmail);
    if (context.length > 0) {
      const dupCheck = await classifyTicket({ subject, description, availableCategories: [], existingTickets: context });
      if (dupCheck?.existingTicketId) finalExistingTicketId = dupCheck.existingTicketId;
    }
  }

  if (!resolvedProjectId) return "skipped";

  if (finalExistingTicketId) {
    await storage.linkTicketEmailConversation(finalExistingTicketId, message.conversationId);
    await storage.addTicketComment({
      ticketId: finalExistingTicketId,
      userId: null as any,
      comment: `Email from ${message.from.emailAddress.name || senderEmail}: ${description.slice(0, 2000)}`,
    });
    return "linked";
  }

  if (classification.confidence < AI_EMAIL_TICKET_CONFIDENCE_THRESHOLD) {
    return "skipped";
  }

  const ticketCount = await storage.getTicketCount();
  const ticketNumber = `TKT-${String(ticketCount + 1).padStart(5, '0')}`;

  const project = await storage.getProject(resolvedProjectId);
  const newTicket = await storage.createTicket({
    ticketNumber,
    projectId: resolvedProjectId,
    companyId: company.id,
    type: classification.suggestedType as any,
    categoryId: classification.suggestedCategoryId,
    subject: subject.slice(0, 200),
    description,
    status: 'open',
    priority: classification.suggestedPriority as any,
    contactName: message.from.emailAddress.name || undefined,
    contactEmail: senderEmail,
    createdByUserId: null,
    assignedToUserId: project?.managerId || null,
    assignedTeamId: project?.teamId || null,
    emailConversationId: message.conversationId,
    sourceMessageId: message.id,
    aiClassification: classification as any,
  } as any);

  return newTicket ? "created" : "skipped";
}

async function buildExistingTicketContext(projectId: string, senderEmail: string): Promise<ExistingTicketContext[]> {
  const openTickets = await storage.getOpenTicketsForProject(projectId);
  const context: ExistingTicketContext[] = [];
  for (const ticket of openTickets.slice(0, 15)) {
    const comments = await storage.getTicketComments(ticket.id);
    context.push({
      id: ticket.id,
      subject: ticket.subject,
      descriptionExcerpt: (ticket.description || "").slice(0, 500),
      recentComments: comments.slice(-3).map((c) => c.comment),
      sameReporter: (ticket.contactEmail || "").toLowerCase() === senderEmail,
    });
  }
  return context;
}

export async function processAllConnectedInboxes(): Promise<void> {
  const connectedUsers = await storage.getConnectedMicrosoftUsers();
  for (const settings of connectedUsers) {
    await processInboxForUser(settings.userId);
  }
}

let pollTimer: NodeJS.Timeout | null = null;

/** Starts the polling loop. Call once at server boot. No-op if already running. */
export function startEmailTicketingPoll(intervalMs = 5 * 60 * 1000): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    processAllConnectedInboxes().catch((error) => console.error("[emailTicketingService] Poll cycle failed:", error));
  }, intervalMs);
}
