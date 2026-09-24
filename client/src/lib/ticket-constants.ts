export const TICKET_TYPES = [
  { value: "complaint", label: "Complaint" },
  { value: "enquiry", label: "Enquiry" },
  { value: "compliment", label: "Compliment" },
  { value: "suggestion", label: "Suggestion" },
] as const;

export type TicketType = (typeof TICKET_TYPES)[number]["value"];

export const TICKET_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number]["value"];

export const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TICKET_TYPES.map((t) => [t.value, t.label])
);

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  TICKET_STATUSES.map((s) => [s.value, s.label])
);

export const TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  complaint: "destructive",
  enquiry: "default",
  compliment: "secondary",
  suggestion: "outline",
};

export const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "destructive",
  in_progress: "default",
  resolved: "secondary",
  closed: "outline",
};

export const PRIORITY_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};
