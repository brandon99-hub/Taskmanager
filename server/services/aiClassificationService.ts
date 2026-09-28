import Anthropic from "@anthropic-ai/sdk";
import { TICKET_TYPE_VALUES, TICKET_PRIORITY_VALUES } from "../../shared/schema";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

let client: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[aiClassificationService] ANTHROPIC_API_KEY not set — AI ticket classification disabled.");
    client = null;
    return client;
  }
  client = new Anthropic();
  return client;
}

export interface AvailableCategory {
  id: string;
  name: string;
  type: "complaint" | "enquiry";
}

export interface ExistingTicketContext {
  id: string;
  subject: string;
  descriptionExcerpt: string;
  recentComments?: string[];
  sameReporter: boolean;
}

export interface ClassifyTicketInput {
  subject: string;
  description: string;
  availableCategories: AvailableCategory[];
  /** Candidate projects the ticket may belong to — only passed for the email auto-ticketing flow. */
  candidateProjects?: { id: string; name: string }[];
  /** Currently open/in_progress tickets on the resolved project, for duplicate/follow-up detection. */
  existingTickets?: ExistingTicketContext[];
}

export interface TicketClassification {
  suggestedType: string;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  suggestedPriority: string;
  suggestedProjectId: string | null;
  existingTicketId: string | null;
  confidence: number;
  reasoning: string;
  model: string;
  classifiedAt: string;
}

const MAX_TEXT_LENGTH = 4000;

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

function buildTool(input: ClassifyTicketInput): Anthropic.Tool {
  const categoryIds = input.availableCategories.map((c) => c.id);
  const projectIds = (input.candidateProjects || []).map((p) => p.id);
  const existingTicketIds = (input.existingTickets || []).map((t) => t.id);

  const properties: Record<string, unknown> = {
    suggestedType: { type: "string", enum: TICKET_TYPE_VALUES },
    suggestedCategoryId: {
      type: ["string", "null"],
      enum: categoryIds.length > 0 ? [...categoryIds, null] : [null],
      description: "Best-matching service category id from availableCategories, or null if none fits (e.g. compliment/suggestion tickets never take a category).",
    },
    suggestedPriority: { type: "string", enum: TICKET_PRIORITY_VALUES },
    confidence: { type: "number", description: "0 to 1 confidence in this overall classification." },
    reasoning: { type: "string", description: "One short sentence (under 200 chars) explaining the classification." },
  };
  const required = ["suggestedType", "suggestedCategoryId", "suggestedPriority", "confidence", "reasoning"];

  if (projectIds.length > 0) {
    properties.suggestedProjectId = {
      type: "string",
      enum: projectIds,
      description: "Which candidate project this email most likely concerns, based on its content.",
    };
    required.push("suggestedProjectId");
  }

  if (existingTicketIds.length > 0) {
    properties.existingTicketId = {
      type: ["string", "null"],
      enum: [...existingTicketIds, null],
      description:
        "If this email is very likely the same underlying issue as one of existingTickets (a cross-sender duplicate, or the same reporter following up on their own already-open ticket, judged from the ticket list and any recentComments given), return that ticket's id here. Otherwise null — it is a genuinely new/distinct issue.",
    };
    required.push("existingTicketId");
  }

  return {
    name: "classify_ticket",
    description: "Classify a support ticket/email into its type, service category, priority, and (when relevant) the project it belongs to or an existing ticket it duplicates/follows up on.",
    input_schema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  };
}

function buildPrompt(input: ClassifyTicketInput): string {
  const categoriesText = input.availableCategories.length
    ? input.availableCategories.map((c) => `- ${c.id}: ${c.name} (${c.type})`).join("\n")
    : "(no categories available)";

  let prompt = `Classify this support ticket.\n\nSubject: ${truncate(input.subject)}\n\nDescription:\n${truncate(input.description)}\n\nAvailable service categories:\n${categoriesText}`;

  if (input.candidateProjects && input.candidateProjects.length > 0) {
    prompt += `\n\nCandidate projects (pick the one this content most likely concerns):\n${input.candidateProjects.map((p) => `- ${p.id}: ${p.name}`).join("\n")}`;
  }

  if (input.existingTickets && input.existingTickets.length > 0) {
    prompt += `\n\nCurrently open/in-progress tickets on the resolved project (check for duplicates/follow-ups):\n`;
    prompt += input.existingTickets
      .map((t) => {
        const lines = [
          `- ${t.id}${t.sameReporter ? " [SAME REPORTER — already has an open ticket]" : ""}: ${truncate(t.subject)}`,
          `  ${truncate(t.descriptionExcerpt)}`,
        ];
        if (t.recentComments && t.recentComments.length > 0) {
          lines.push(`  Recent activity: ${t.recentComments.map(truncate).join(" | ")}`);
        }
        return lines.join("\n");
      })
      .join("\n");
    prompt += `\n\nIf this new content is the same underlying issue as one of the above (whether from the same reporter following up, or a different person at the same organization reporting the same problem), set existingTicketId to that ticket's id instead of treating it as new. Only treat a same-reporter email as a new ticket if it clearly describes a distinct, unrelated issue.`;
  }

  return prompt;
}

/**
 * Classifies a ticket/email. Never throws — returns null on any failure (missing API key,
 * network error, malformed response) so callers can treat classification as best-effort
 * enrichment that never blocks ticket creation.
 */
export async function classifyTicket(input: ClassifyTicketInput): Promise<TicketClassification | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const tool = buildTool(input);
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      tools: [tool],
      tool_choice: { type: "tool", name: "classify_ticket" },
      messages: [{ role: "user", content: buildPrompt(input) }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (!toolUse) {
      console.error("[aiClassificationService] No tool_use block in response");
      return null;
    }

    const result = toolUse.input as Record<string, unknown>;
    if (
      typeof result.suggestedType !== "string" ||
      typeof result.suggestedPriority !== "string" ||
      typeof result.confidence !== "number"
    ) {
      console.error("[aiClassificationService] Malformed classification result", result);
      return null;
    }

    const category = input.availableCategories.find((c) => c.id === result.suggestedCategoryId);

    return {
      suggestedType: result.suggestedType,
      suggestedCategoryId: (result.suggestedCategoryId as string | null) ?? null,
      suggestedCategoryName: category?.name ?? null,
      suggestedPriority: result.suggestedPriority,
      suggestedProjectId: (result.suggestedProjectId as string | null | undefined) ?? null,
      existingTicketId: (result.existingTicketId as string | null | undefined) ?? null,
      confidence: Math.max(0, Math.min(1, result.confidence)),
      reasoning: typeof result.reasoning === "string" ? result.reasoning.slice(0, 300) : "",
      model: MODEL,
      classifiedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[aiClassificationService] classifyTicket failed:", error);
    return null;
  }
}
