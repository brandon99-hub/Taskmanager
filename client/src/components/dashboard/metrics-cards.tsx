import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, CheckCircle, AlertTriangle, Users } from "lucide-react";

export default function MetricsCards() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              </div>
              <div className="mt-4">
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Active Projects",
      value: metrics?.activeProjects || 0,
      icon: BarChart3,
      color: "bg-primary",
      change: "+2.1%",
      changeLabel: "from last month",
      testId: "card-active-projects"
    },
    {
      title: "Tasks Completed",
      value: metrics?.completedTasks || 0,
      icon: CheckCircle,
      color: "bg-success",
      change: "+12.5%",
      changeLabel: "this week",
      testId: "card-completed-tasks"
    },
    {
      title: "Overdue Tasks",
      value: metrics?.overdueTasks || 0,
      icon: AlertTriangle,
      color: "bg-error",
      change: `+${metrics?.overdueTasks || 0} tasks`,
      changeLabel: "need attention",
      isNegative: true,
      testId: "card-overdue-tasks"
    },
    {
      title: "Team Members",
      value: metrics?.teamMembers || 0,
      icon: Users,
      color: "bg-warning",
      change: "85% utilization rate",
      changeLabel: "",
      testId: "card-team-members"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="bg-surface border border-gray-200" data-testid={card.testId}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600" data-testid={`text-${card.testId}-title`}>
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1" data-testid={`text-${card.testId}-value`}>
                    {card.value}
                  </p>
                </div>
                <div className={`p-3 ${card.color} bg-opacity-10 rounded-lg`}>
                  <Icon className={`h-6 w-6 ${card.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className={`text-sm font-medium ${card.isNegative ? 'text-error' : 'text-success'}`}>
                  {card.change}
                </span>
                {card.changeLabel && (
                  <span className="text-gray-600 text-sm ml-2">{card.changeLabel}</span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
