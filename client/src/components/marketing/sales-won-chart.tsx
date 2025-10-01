import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Title,
  Tooltip,
  Legend
);

interface SalesWonData {
  marketerId: string;
  marketerName: string;
  salesWon: number;
  target: number;
  achievementRate: number;
}

interface SalesWonChartProps {
  data?: SalesWonData[];
  title?: string;
  description?: string;
}

export function SalesWonChart({ 
  data = [], 
  title = "Sales Won Per Marketer", 
  description = "Individual marketer sales performance" 
}: SalesWonChartProps) {
  const safeData = Array.isArray(data) ? data : [];
  
  const maxValue = safeData.length
    ? Math.max(...safeData.map(d => Math.max(d.salesWon || 0, d.target || 0)))
    : 0;
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
        </div>
        <CardDescription className="text-gray-600">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {safeData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No data available</p>
                <p className="text-sm">Set targets and record sales to see performance comparison</p>
              </div>
            </div>
          ) : (
            <Chart type='bar' data={{
            labels: safeData.map(item => item.marketerName),
            datasets: [
              {
                type: 'bar' as const,
                label: 'Target',
                data: safeData.map(item => item.target),
                backgroundColor: 'rgba(239, 68, 68, 0.6)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
                order: 2,
              },
              {
                type: 'line' as const,
                label: 'Sales Won',
                data: safeData.map(item => item.salesWon),
                borderColor: 'rgba(34, 197, 94, 1)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                pointBackgroundColor: 'rgba(34, 197, 94, 1)',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: 'rgba(34, 197, 94, 1)',
                pointHoverBorderColor: '#ffffff',
                order: 1,
              },
            ],
          }} options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 2000,
              easing: 'easeInOutQuart',
              delay: (context: any) => context.dataIndex * 200,
            },
            plugins: {
              legend: {
                position: 'top' as const,
                labels: {
                  usePointStyle: true,
                  padding: 20,
                  font: {
                    size: 12,
                    weight: '500'
                  }
                }
              },
              title: {
                display: false,
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: 'white',
                bodyColor: 'white',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                cornerRadius: 8,
                displayColors: true,
                callbacks: {
                  label: function(context: any) {
                    const value = context.parsed.y;
                    return `${context.dataset.label}: ${formatCurrency(value)}`;
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
                    weight: '500'
                  }
                }
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)',
                },
                ticks: {
                  callback: function(value: any) {
                    return formatCurrency(value);
                  },
                  font: {
                    size: 11,
                    weight: '500'
                  }
                }
              }
            },
            elements: {
              bar: {
                borderRadius: 6,
                borderSkipped: false,
              },
              line: {
                tension: 0.4,
              },
              point: {
                radius: 6,
                hoverRadius: 8,
              }
            }
          }} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
