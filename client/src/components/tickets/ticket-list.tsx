import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Ticket as TicketIcon } from "lucide-react";
import TicketDetailDialog from "./ticket-detail-dialog";
import { STATUS_LABELS, STATUS_VARIANTS, PRIORITY_VARIANTS, TYPE_LABELS, TYPE_VARIANTS } from "@/lib/ticket-constants";

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

  // Compliments/suggestions carry no workflow state (no status, no assignment), so they get
  // a flat table instead of the case-style list used for the other views.
  if (view === 'feedback') {
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
                  <TableHead>From</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
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
                    <TableCell className="font-mono text-sm text-gray-500">{ticket.ticketNumber}</TableCell>
                    <TableCell><Badge variant={TYPE_VARIANTS[ticket.type]}>{TYPE_LABELS[ticket.type] || ticket.type}</Badge></TableCell>
                    <TableCell className="font-medium text-gray-900">{ticket.subject}</TableCell>
                    <TableCell className="text-gray-600">{ticket.contactName || (ticket.createdBy ? `${ticket.createdBy.firstName || ''} ${ticket.createdBy.lastName || ''}`.trim() : 'Unknown')}</TableCell>
                    <TableCell className="text-gray-600">{ticket.project?.name || 'Unknown project'}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {openTicketId && (
          <TicketDetailDialog ticketId={openTicketId} onClose={() => setOpenTicketId(null)} />
        )}
      </>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0 divide-y">
          {filteredTickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setOpenTicketId(ticket.id)}
              className="w-full text-left flex items-center justify-between gap-4 p-4 hover:bg-gray-50 transition-colors"
              data-testid={`ticket-row-${ticket.id}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-mono text-gray-500">{ticket.ticketNumber}</span>
                  <span className="font-medium text-gray-900 truncate">{ticket.subject}</span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {ticket.project?.name || 'Unknown project'}
                  {ticket.category?.name ? ` • ${ticket.category.name}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={TYPE_VARIANTS[ticket.type]}>{TYPE_LABELS[ticket.type] || ticket.type}</Badge>
                <Badge variant={PRIORITY_VARIANTS[ticket.priority]} className="capitalize">{ticket.priority}</Badge>
                <Badge variant={STATUS_VARIANTS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {openTicketId && (
        <TicketDetailDialog ticketId={openTicketId} onClose={() => setOpenTicketId(null)} />
      )}
    </>
  );
}
