import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket as TicketIcon } from "lucide-react";
import CreateTicketDialog from "./create-ticket-dialog";
import TicketDetailDialog from "./ticket-detail-dialog";

const COLUMNS = [
  { id: 'open', title: 'Open', color: 'bg-red-50' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-slate-100' },
  { id: 'resolved', title: 'Resolved', color: 'bg-amber-50' },
  { id: 'closed', title: 'Closed', color: 'bg-green-50' },
];

const PRIORITY_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {COLUMNS.map((col) => (
            <div key={col.id} className={`rounded-lg p-4 ${col.color} min-h-[200px]`} data-testid={`ticket-kanban-column-${col.id}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">{col.title}</h3>
                <Badge variant="secondary">{byStatus[col.id].length}</Badge>
              </div>
              <div className="space-y-3">
                {byStatus[col.id].map((ticket: any) => (
                  <Card
                    key={ticket.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setOpenTicketId(ticket.id)}
                    data-testid={`ticket-kanban-card-${ticket.id}`}
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-gray-500">{ticket.ticketNumber}</span>
                        <Badge variant={PRIORITY_VARIANTS[ticket.priority]} className="capitalize text-xs">{ticket.priority}</Badge>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                      <p className="text-xs text-gray-500 truncate">{ticket.project?.name || 'Unknown project'}</p>
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
