import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#F1414D",
  in_progress: "#0B1B32",
  resolved: "#10B981",
  closed: "#9CA3AF",
};

export default function TicketsByStatusChart() {
  const { data: myTickets = [] } = useQuery<any[]>({
    queryKey: ['/api/tickets', 'mine'],
    queryFn: async () => {
      const res = await fetch('/api/tickets?view=mine', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const { data: assignedTickets = [] } = useQuery<any[]>({
    queryKey: ['/api/tickets', 'assigned'],
    queryFn: async () => {
      const res = await fetch('/api/tickets?view=assigned', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const chartData = useMemo(() => {
    const byId = new Map<string, any>();
    for (const t of [...myTickets, ...assignedTickets]) byId.set(t.id, t);
    const counts: Record<string, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const t of Array.from(byId.values())) {
      if (counts[t.status] !== undefined) counts[t.status]++;
    }
    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([status, value]) => ({ name: STATUS_LABELS[status], value, color: STATUS_COLORS[status] }));
  }, [myTickets, assignedTickets]);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PieChartIcon className="h-4 w-4 text-primary" />
          My Tickets by Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No tickets created by or assigned to you yet.
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={75}
                  dataKey="value"
                  animationDuration={800}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {total > 0 && (
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {chartData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name} ({entry.value})
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
