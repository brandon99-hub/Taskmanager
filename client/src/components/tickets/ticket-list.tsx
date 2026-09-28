import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket as TicketIcon, ArrowUpCircle } from "lucide-react";
import TicketDetailDialog from "./ticket-detail-dialog";
import ResolveTicketModal from "./resolve-ticket-modal";
import EscalateTicketModal from "./escalate-ticket-modal";
import { STATUS_LABELS, STATUS_VARIANTS, TYPE_LABELS, TYPE_VARIANTS } from "@/lib/ticket-constants";

const ESCALATE_OPTION = "__escalate__";

interface TicketListProps {
  view: 'mine' | 'assigned' | 'all' | 'feedback';
  search?: string;
  type?: string;
  status?: string;
}

function matchesSearch(ticket: any, search: string) {
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();
  return (
    (ticket.ticketNumber || '').toLowerCase().includes(q) ||
    (ticket.subject || '').toLowerCase().includes(q) ||
    (ticket.contactName || '').toLowerCase().includes(q) ||
    (ticket.createdBy?.firstName || '').toLowerCase().includes(q) ||
    (ticket.createdBy?.lastName || '').toLowerCase().includes(q)
  );
}

export default function TicketList({ view, search = "", type = "all", status = "all" }: TicketListProps) {
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);
  const [escalatingTicketId, setEscalatingTicketId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth() as any;
  const { user, isAdminRole } = auth;

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/tickets', view],
    queryFn: async () => {
      const res = await fetch(`/api/tickets?view=${view}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tickets');
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const filteredTickets = useMemo(
    () =>
      tickets.filter(
        (t) =>
          matchesSearch(t, search) &&
          (type === "all" || t.type === type) &&
          (status === "all" || t.status === status)
      ),
    [tickets, search, type, status]
  );

  const statusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      await apiRequest('PUT', `/api/tickets/${ticketId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({ title: "Status updated" });
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to update status", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (filteredTickets.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <TicketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets here</h3>
          <p className="text-gray-600">
            {tickets.length > 0 && search
              ? `No matches for "${search}".`
              : view === 'mine' && "Tickets you log will show up here."}
            {tickets.length === 0 && view === 'assigned' && "Tickets assigned to you will show up here."}
            {tickets.length === 0 && view === 'all' && "No tickets have been logged yet."}
            {tickets.length === 0 && view === 'feedback' && "Compliments and suggestions will show up here."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Compliments/suggestions carry no workflow state (no status, no assignment), so their
  // Status column is omitted rather than showing a meaningless badge.
  const showStatus = view !== 'feedback';

  const canManageTicket = (ticket: any) => isAdminRole() || ticket.assignedToUserId === user?.id;

  const handleStatusSelect = (ticket: any, value: string) => {
    if (value === ESCALATE_OPTION) {
      setEscalatingTicketId(ticket.id);
      return;
    }
    if (value === 'resolved' && ticket.status !== 'resolved' && ticket.status !== 'closed') {
      setResolvingTicketId(ticket.id);
      return;
    }
    statusMutation.mutate({ ticketId: ticket.id, status: value });
  };

  const escalatingTicket = filteredTickets.find((t) => t.id === escalatingTicketId);

  const requesterFor = (ticket: any) =>
    ticket.contactName || (ticket.createdBy ? `${ticket.createdBy.firstName || ''} ${ticket.createdBy.lastName || ''}`.trim() : 'Unknown');

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Requester</TableHead>
                {showStatus && <TableHead>Status</TableHead>}
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setOpenTicketId(ticket.id)}
                  data-testid={`ticket-row-${ticket.id}`}
                >
                  <TableCell className="font-mono text-xs text-gray-500">{ticket.ticketNumber}</TableCell>
                  <TableCell><Badge variant={TYPE_VARIANTS[ticket.type]}>{TYPE_LABELS[ticket.type] || ticket.type}</Badge></TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="font-semibold text-gray-900 truncate max-w-xs">{ticket.subject}</div>
                      </TooltipTrigger>
                      <TooltipContent>{ticket.subject}</TooltipContent>
                    </Tooltip>
                    {ticket.category?.name && (
                      <div className="text-xs text-muted-foreground truncate max-w-xs">{ticket.category.name}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-600">{ticket.project?.name || 'Unknown project'}</TableCell>
                  <TableCell className="text-gray-600">{ticket.company?.name || '—'}</TableCell>
                  <TableCell className="text-gray-600">
                    <div>{requesterFor(ticket)}</div>
                    {ticket.contactEmail && (
                      <div className="text-xs text-muted-foreground">{ticket.contactEmail}</div>
                    )}
                  </TableCell>
                  {showStatus && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canManageTicket(ticket) ? (
                        <Select value={ticket.status} onValueChange={(v) => handleStatusSelect(ticket, v)}>
                          <SelectTrigger className="h-8 w-[140px] text-xs" data-testid={`select-status-${ticket.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectSeparator />
                            <SelectItem value={ESCALATE_OPTION}>
                              <span className="flex items-center gap-1.5 text-amber-700">
                                <ArrowUpCircle className="h-3.5 w-3.5" />
                                Escalate
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={STATUS_VARIANTS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-gray-500 text-sm">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ''}</TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      onClick={(e) => { e.stopPropagation(); setOpenTicketId(ticket.id); }}
                      data-testid={`button-view-ticket-${ticket.id}`}
                    >
                      View
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {openTicketId && (
        <TicketDetailDialog ticketId={openTicketId} onClose={() => setOpenTicketId(null)} />
      )}
      {resolvingTicketId && (
        <ResolveTicketModal
          ticketId={resolvingTicketId}
          open={!!resolvingTicketId}
          onClose={() => setResolvingTicketId(null)}
        />
      )}
      {escalatingTicketId && (
        <EscalateTicketModal
          ticketId={escalatingTicketId}
          teamId={escalatingTicket?.project?.teamId}
          currentAssigneeId={escalatingTicket?.assignedToUserId}
          open={!!escalatingTicketId}
          onClose={() => setEscalatingTicketId(null)}
        />
      )}
    </>
  );
}
