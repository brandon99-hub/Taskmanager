import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Send, ArrowUpCircle, BrainCircuit } from "lucide-react";
import ResolveTicketModal from "./resolve-ticket-modal";
import EscalateTicketModal from "./escalate-ticket-modal";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "destructive",
  in_progress: "default",
  resolved: "secondary",
  closed: "outline",
};

const TYPE_LABELS: Record<string, string> = {
  complaint: "Complaint",
  enquiry: "Enquiry",
  compliment: "Compliment",
  suggestion: "Suggestion",
};

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  complaint: "destructive",
  enquiry: "default",
  compliment: "secondary",
  suggestion: "outline",
};

const ESCALATE_OPTION = "__escalate__";

export default function TicketDetailDialog({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth() as any;
  const { user, isAdminRole } = auth;
  const [comment, setComment] = useState("");
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);

  const { data: ticket, isLoading } = useQuery<any>({
    queryKey: ['/api/tickets', ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${ticketId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch ticket');
      return res.json();
    },
  });

  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/teams', ticket?.project?.teamId, 'members-for-assign'],
    queryFn: async () => {
      if (!ticket?.project?.teamId) return [];
      const res = await fetch(`/api/teams/${ticket.project.teamId}`, { credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.members?.map((m: any) => m.user) ?? [];
    },
    enabled: !!ticket?.project?.teamId,
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { status: string }) => {
      await apiRequest('PUT', `/api/tickets/${ticketId}/status`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({ title: "Status updated" });
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to update status", variant: "destructive" }),
  });

  const handleStatusChange = (status: string) => {
    if (status === ESCALATE_OPTION) {
      setEscalateModalOpen(true);
      return;
    }
    if (status === 'resolved' && ticket?.status !== 'resolved' && ticket?.status !== 'closed') {
      setResolveModalOpen(true);
      return;
    }
    statusMutation.mutate({ status });
  };

  const assignMutation = useMutation({
    mutationFn: async (assignedToUserId: string) => {
      await apiRequest('PUT', `/api/tickets/${ticketId}/assign`, {
        assignedToUserId,
        assignedTeamId: ticket?.project?.teamId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({ title: "Ticket assigned" });
    },
    onError: () => toast({ title: "Error", description: "Failed to assign ticket", variant: "destructive" }),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/tickets/${ticketId}/comments`, { comment });
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
    },
    onError: () => toast({ title: "Error", description: "Failed to add comment", variant: "destructive" }),
  });

  const canManage = isAdminRole() || ticket?.createdByUserId === user?.id || ticket?.assignedToUserId === user?.id;

  return (
    <>
    <Dialog open={!resolveModalOpen && !escalateModalOpen} onOpenChange={(open) => { if (!open && !resolveModalOpen && !escalateModalOpen) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {isLoading || !ticket ? (
          <div className="py-12 text-center text-gray-500">Loading ticket...</div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <span>{ticket.ticketNumber}</span>
                <Badge variant={TYPE_VARIANTS[ticket.type]}>{TYPE_LABELS[ticket.type] || ticket.type}</Badge>
                <Badge variant={STATUS_VARIANTS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
              </DialogTitle>
              <DialogDescription>{ticket.subject}</DialogDescription>
            </DialogHeader>

            {ticket.aiClassification && (
              (ticket.aiClassification.suggestedCategoryName && ticket.aiClassification.suggestedCategoryName !== ticket.category?.name) ||
              ticket.aiClassification.suggestedPriority !== ticket.priority
            ) && (
              <div className="flex items-start gap-2 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                <BrainCircuit className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  AI suggested: {ticket.aiClassification.suggestedCategoryName || 'no category'} · {ticket.aiClassification.suggestedPriority} priority
                  {typeof ticket.aiClassification.confidence === 'number' && ` (confidence ${Math.round(ticket.aiClassification.confidence * 100)}%)`}
                </span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Project</p>
                  <p className="font-medium">{ticket.project?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Category</p>
                  <p className="font-medium">{ticket.category?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Reported by</p>
                  <p className="font-medium">{ticket.contactName || 'Not specified'}</p>
                  {ticket.contactEmail && <p className="text-gray-500 text-xs">{ticket.contactEmail}</p>}
                </div>
                <div>
                  <p className="text-gray-500">Logged by</p>
                  <p className="font-medium">
                    {ticket.createdBy ? `${ticket.createdBy.firstName || ''} ${ticket.createdBy.lastName || ''}`.trim() || ticket.createdBy.email : '—'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-gray-500 text-sm mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Status</p>
                  <Select
                    value={ticket.status}
                    onValueChange={handleStatusChange}
                    disabled={!canManage || statusMutation.isPending}
                  >
                    <SelectTrigger data-testid="select-ticket-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      {canManage && ticket.assignedToUserId && (
                        <>
                          <SelectSeparator />
                          <SelectItem value={ESCALATE_OPTION}>
                            <span className="flex items-center gap-1.5 text-amber-700">
                              <ArrowUpCircle className="h-3.5 w-3.5" />
                              Escalate
                            </span>
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Assigned to</p>
                  <Select
                    value={ticket.assignedToUserId || undefined}
                    onValueChange={(v) => assignMutation.mutate(v)}
                    disabled={!isAdminRole() || assignMutation.isPending}
                  >
                    <SelectTrigger data-testid="select-ticket-assignee">
                      <SelectValue placeholder={teamMembers.length ? "Unassigned" : "No team on project"} />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(ticket.rootCause || ticket.resolutionNotes) && (
                <div className="grid grid-cols-2 gap-4 text-sm border rounded-md p-3 bg-gray-50">
                  <div>
                    <p className="text-gray-500">Root Cause</p>
                    <p className="font-medium whitespace-pre-wrap">{ticket.rootCause || '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Steps taken to resolve the issue</p>
                    <p className="font-medium whitespace-pre-wrap">{ticket.resolutionNotes || '—'}</p>
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Activity</p>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {(ticket.comments || []).length === 0 ? (
                    <p className="text-sm text-gray-500">No activity yet.</p>
                  ) : (
                    ticket.comments.map((c: any) => (
                      <div key={c.id} className="text-sm">
                        <span className="font-medium">
                          {c.user?.firstName && c.user?.lastName ? `${c.user.firstName} ${c.user.lastName}` : c.user?.email || 'Someone'}
                        </span>
                        <span className="text-gray-500"> — {c.comment}</span>
                        <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="min-h-[40px] flex-1"
                  />
                  <Button
                    size="icon"
                    disabled={!comment.trim() || commentMutation.isPending}
                    onClick={() => commentMutation.mutate()}
                    data-testid="button-add-comment"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    {resolveModalOpen && (
      <ResolveTicketModal ticketId={ticketId} open={resolveModalOpen} onClose={() => setResolveModalOpen(false)} />
    )}
    {escalateModalOpen && ticket && (
      <EscalateTicketModal
        ticketId={ticketId}
        teamId={ticket.project?.teamId}
        currentAssigneeId={ticket.assignedToUserId}
        open={escalateModalOpen}
        onClose={() => setEscalateModalOpen(false)}
      />
    )}
    </>
  );
}
