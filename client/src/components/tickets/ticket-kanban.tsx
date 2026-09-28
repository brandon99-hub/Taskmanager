import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket as TicketIcon, Clock, Building2 } from "lucide-react";
import CreateTicketDialog from "./create-ticket-dialog";
import TicketDetailDialog from "./ticket-detail-dialog";
import { TYPE_LABELS, TYPE_VARIANTS } from "@/lib/ticket-constants";

const COLUMNS = [
  { id: 'open', title: 'Open', color: 'bg-rose-50/60 border border-rose-200', accent: 'border-l-4 border-l-rose-500', badgeColor: 'bg-rose-100 text-rose-800' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-amber-50/60 border border-amber-200', accent: 'border-l-4 border-l-amber-500', badgeColor: 'bg-amber-100 text-amber-800' },
  { id: 'resolved', title: 'Resolved', color: 'bg-emerald-50/60 border border-emerald-200', accent: 'border-l-4 border-l-emerald-500', badgeColor: 'bg-emerald-100 text-emerald-800' },
];

function relativeTime(dateStr?: string) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TicketKanban() {
  const auth = useAuth() as any;
  const isAdmin = auth.isAdminRole?.() ?? false;
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/tickets', isAdmin ? 'all' : 'assigned'],
    queryFn: async () => {
      const res = await fetch(`/api/tickets?view=${isAdmin ? 'all' : 'assigned'}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tickets');
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const byStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tickets.filter((t) => t.status === col.id);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-600 text-sm">
            {isAdmin ? "All tickets by status" : "Tickets assigned to you, by status"}
          </p>
        </div>
        <CreateTicketDialog />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {COLUMNS.map((col) => (
            <div key={col.id} className={`rounded-lg p-4 ${col.color} min-h-[200px] animate-pulse`} />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <TicketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets yet</h3>
            <p className="text-gray-600">{isAdmin ? "No tickets have been logged yet." : "No tickets are assigned to you yet."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {COLUMNS.map((col) => (
            <div key={col.id} className={`rounded-lg p-4 ${col.color} min-h-[200px]`} data-testid={`ticket-kanban-column-${col.id}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">{col.title}</h3>
                <Badge className={col.badgeColor}>{byStatus[col.id].length}</Badge>
              </div>
              <div className="space-y-3">
                {byStatus[col.id].map((ticket: any) => (
                  <Card
                    key={ticket.id}
                    className={`cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${col.accent}`}
                    onClick={() => setOpenTicketId(ticket.id)}
                    data-testid={`ticket-kanban-card-${ticket.id}`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">{ticket.ticketNumber}</span>
                        <Badge variant={TYPE_VARIANTS[ticket.type]} className="text-xs">{TYPE_LABELS[ticket.type] || ticket.type}</Badge>
                      </div>
                      <p className="font-medium text-slate-900 text-sm line-clamp-2">{ticket.subject}</p>
                      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{ticket.project?.name || 'Unknown project'}</span>
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {relativeTime(ticket.createdAt)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {byStatus[col.id].length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">No {col.title.toLowerCase()} tickets</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {openTicketId && (
        <TicketDetailDialog ticketId={openTicketId} onClose={() => setOpenTicketId(null)} />
      )}
    </div>
  );
}
