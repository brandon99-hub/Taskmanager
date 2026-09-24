import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Ticket } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface MonthlyTicketTrendItem {
  month: string;
  resolved?: number;
  created?: number;
  leads?: number;
  salesWon?: number;
  expectedOrders?: number;
}

export interface MonthlyTrendsChartProps {
  data?: MonthlyTicketTrendItem[] | any[];
  tickets?: any[];
  title?: string;
  description?: string;
  monthsCount?: number;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthlyTrendsChart({ 
  data, 
  tickets: propTickets,
  title = "Monthly Ticket Resolution Trends", 
  description = "Count of support tickets resolved and logged across recent months",
  monthsCount = 6,
}: MonthlyTrendsChartProps) {
  // If tickets are not provided as props and no pre-computed data is passed, fetch from API
  const { data: fetchedTickets = [] } = useQuery<any[]>({
    queryKey: ['/api/tickets'],
    enabled: (!data || data.length === 0) && (!propTickets || propTickets.length === 0),
    staleTime: 60 * 1000,
  });

  const activeTickets = propTickets || (Array.isArray(fetchedTickets) ? fetchedTickets : []);

  // Compute monthly counts if custom data wasn't provided
  const chartData: MonthlyTicketTrendItem[] = useMemo(() => {
    if (data && data.length > 0) {
      return data.map((item: any) => ({
        month: item.month,
        resolved: item.resolved ?? item.salesWon ?? 0,
        created: item.created ?? item.leads ?? 0,
      }));
    }

    const now = new Date();
    const months: MonthlyTicketTrendItem[] = [];

    // Generate month slots for the last `monthsCount` months in chronological order
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      months.push({
        month: label,
        resolved: 0,
        created: 0,
      });
    }

    if (!activeTickets || activeTickets.length === 0) {
      return months;
    }

    // Populate counts based on tickets
    for (const ticket of activeTickets) {
      // Check created month
      if (ticket.createdAt) {
        const createdDate = new Date(ticket.createdAt);
        const label = `${MONTH_NAMES[createdDate.getMonth()]} ${createdDate.getFullYear().toString().slice(-2)}`;
        const monthItem = months.find((m) => m.month === label);
        if (monthItem) {
          monthItem.created = (monthItem.created || 0) + 1;
        }
      }

      // Check resolved month
      const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
      if (isResolved) {
        const resolutionDate = ticket.resolvedAt ? new Date(ticket.resolvedAt) : (ticket.updatedAt ? new Date(ticket.updatedAt) : null);
        if (resolutionDate) {
          const label = `${MONTH_NAMES[resolutionDate.getMonth()]} ${resolutionDate.getFullYear().toString().slice(-2)}`;
          const monthItem = months.find((m) => m.month === label);
          if (monthItem) {
            monthItem.resolved += 1;
          }
        }
      }
    }

    return months;
  }, [data, activeTickets, monthsCount]);

  const totalResolved = useMemo(() => {
    return chartData.reduce((sum, item) => sum + (item.resolved || 0), 0);
  }, [chartData]);

  const totalCreated = useMemo(() => {
    return chartData.reduce((sum, item) => sum + (item.created || 0), 0);
  }, [chartData]);

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
            </div>
            <CardDescription className="text-gray-500 text-sm mt-1">{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs py-1 px-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {totalResolved} Resolved
            </Badge>
            {totalCreated > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs py-1 px-2.5">
                <Ticket className="h-3.5 w-3.5 mr-1" />
                {totalCreated} Logged
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <Line 
            data={{
              labels: chartData.map(item => item.month),
              datasets: [
                {
                  label: 'Tickets Resolved',
                  data: chartData.map(item => item.resolved),
                  borderColor: '#10B981', // Emerald 500
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  tension: 0.35,
                  fill: true,
                  pointBackgroundColor: '#10B981',
                  pointBorderColor: '#ffffff',
                  pointHoverBackgroundColor: '#059669',
                  pointHoverBorderColor: '#ffffff',
                  pointRadius: 4,
                  pointHoverRadius: 6,
                  borderWidth: 2.5,
                },
                {
                  label: 'Tickets Logged',
                  data: chartData.map(item => item.created ?? 0),
                  borderColor: '#3B82F6', // Blue 500
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  tension: 0.35,
                  fill: false,
                  pointBackgroundColor: '#3B82F6',
                  pointBorderColor: '#ffffff',
                  pointHoverBackgroundColor: '#1D4ED8',
                  pointHoverBorderColor: '#ffffff',
                  pointRadius: 4,
                  pointHoverRadius: 6,
                  borderWidth: 2,
                  borderDash: [4, 4],
                },
              ],
            }} 
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: {
                duration: 800,
                easing: 'easeOutQuart',
              },
              plugins: {
                legend: {
                  position: 'top' as const,
                  align: 'end',
                  labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    padding: 16,
                    font: {
                      size: 12,
                      weight: 500
                    }
                  }
                },
                tooltip: {
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  titleColor: '#ffffff',
                  bodyColor: '#ffffff',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderWidth: 1,
                  cornerRadius: 6,
                  padding: 10,
                  displayColors: true,
                  mode: 'index',
                  intersect: false,
                  callbacks: {
                    label: function(context: any) {
                      const val = context.parsed.y;
                      return `${context.dataset.label}: ${val} ticket${val === 1 ? '' : 's'}`;
                    }
                  }
                }
              },
              scales: {
                x: {
                  grid: {
                    display: false,
                  },
                  ticks: {
                    font: {
                      size: 11,
                      weight: 500
                    },
                    color: '#64748B',
                  }
                },
                y: {
                  beginAtZero: true,
                  grid: {
                    color: 'rgba(0, 0, 0, 0.06)',
                  },
                  ticks: {
                    stepSize: 1,
                    precision: 0,
                    font: {
                      size: 11,
                      weight: 500
                    },
                    color: '#64748B',
                    callback: function(value: any) {
                      if (Number.isInteger(value)) return value;
                      return null;
                    }
                  }
                }
              },
              interaction: {
                intersect: false,
                mode: 'index',
              }
            }} 
          />
        </div>
      </CardContent>
    </Card>
  );
}
