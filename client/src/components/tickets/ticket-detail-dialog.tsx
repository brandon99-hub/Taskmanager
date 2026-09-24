import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Send, ArrowUpCircle } from "lucide-react";

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

const PRIORITY_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
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

export default function TicketDetailDialog({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth() as any;
  const { user, isAdminRole } = auth;
  const [comment, setComment] = useState("");
  const [resolvingOpen, setResolvingOpen] = useState(false);
  const [rootCause, setRootCause] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateToUserId, setEscalateToUserId] = useState("");
  const [escalateReason, setEscalateReason] = useState("");

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
    mutationFn: async (payload: { status: string; rootCause?: string; resolutionNotes?: string }) => {
      await apiRequest('PUT', `/api/tickets/${ticketId}/status`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({ title: "Status updated" });
      setResolvingOpen(false);
      setRootCause("");
      setResolutionNotes("");
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to update status", variant: "destructive" }),
  });

  const escalateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/tickets/${ticketId}/escalate`, {
        escalatedToUserId: escalateToUserId,
        reason: escalateReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({ title: "Ticket escalated" });
      setEscalateOpen(false);
      setEscalateToUserId("");
      setEscalateReason("");
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to escalate ticket", variant: "destructive" }),
  });

  const handleStatusChange = (status: string) => {
    if (status === 'resolved' && ticket?.status !== 'resolved' && ticket?.status !== 'closed') {
      setResolvingOpen(true);
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
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
                <Badge variant={PRIORITY_VARIANTS[ticket.priority]} className="capitalize">{ticket.priority}</Badge>
              </DialogTitle>
              <DialogDescription>{ticket.subject}</DialogDescription>
            </DialogHeader>

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
                    </SelectContent>
                  </Select>

                  {resolvingOpen && (
                    <div className="mt-3 space-y-2 border rounded-md p-3 bg-gray-50">
                      <p className="text-xs font-medium text-gray-700">Resolving requires a root cause and what was done</p>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Root Cause *</label>
                        <Textarea
                          value={rootCause}
                          onChange={(e) => setRootCause(e.target.value)}
                          placeholder="What caused this issue?"
                          className="min-h-[60px] text-sm"
                          data-testid="textarea-root-cause"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Resolution Notes *</label>
                        <Textarea
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="What was done to resolve it?"
                          className="min-h-[60px] text-sm"
                          data-testid="textarea-resolution-notes"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setResolvingOpen(false)}>Cancel</Button>
                        <Button
                          size="sm"
                          disabled={!rootCause.trim() || !resolutionNotes.trim() || statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ status: 'resolved', rootCause, resolutionNotes })}
                          data-testid="button-confirm-resolve"
                        >
                          {statusMutation.isPending ? "Saving..." : "Mark Resolved"}
                        </Button>
                      </div>
                    </div>
                  )}
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
                  {canManage && ticket.assignedToUserId && !escalateOpen && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setEscalateOpen(true)}
                      data-testid="button-escalate-ticket"
                    >
                      <ArrowUpCircle className="h-4 w-4 mr-2" />
                      Escalate
                    </Button>
                  )}
                  {escalateOpen && (
                    <div className="mt-3 space-y-2 border rounded-md p-3 bg-gray-50">
                      <p className="text-xs font-medium text-gray-700">Escalate to</p>
                      <Select value={escalateToUserId} onValueChange={setEscalateToUserId}>
                        <SelectTrigger data-testid="select-escalate-to">
                          <SelectValue placeholder="Choose someone" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamMembers.filter((m: any) => m.id !== ticket.assignedToUserId).map((m: any) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Reason *</label>
                        <Textarea
                          value={escalateReason}
                          onChange={(e) => setEscalateReason(e.target.value)}
                          placeholder="Why is this being escalated?"
                          className="min-h-[60px] text-sm"
                          data-testid="textarea-escalate-reason"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEscalateOpen(false)}>Cancel</Button>
                        <Button
                          size="sm"
                          disabled={!escalateToUserId || !escalateReason.trim() || escalateMutation.isPending}
                          onClick={() => escalateMutation.mutate()}
                          data-testid="button-confirm-escalate"
                        >
                          {escalateMutation.isPending ? "Escalating..." : "Escalate"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {(ticket.rootCause || ticket.resolutionNotes) && (
                <div className="grid grid-cols-2 gap-4 text-sm border rounded-md p-3 bg-gray-50">
                  <div>
                    <p className="text-gray-500">Root Cause</p>
                    <p className="font-medium whitespace-pre-wrap">{ticket.rootCause || '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Resolution Notes</p>
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
  );
}
