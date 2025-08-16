import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useScreenSize } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, CheckCircle, AlertTriangle, Users } from "lucide-react";

export default function MetricsCards() {
  const auth = useAuth() as any;
  const { user } = auth;
  const { isMobile, isTablet } = useScreenSize();

  const { data: metrics, isLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/metrics'],
  });

  // Additional real data to power the subtexts
  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ['/api/teams'],
  });

  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ['/api/tasks'],
  });

  const { data: upcoming = [] } = useQuery<any[]>({
    queryKey: ['/api/dashboard/upcoming-tasks'],
  });

  // For employees, get their team count
  const { data: employeeTeamsCount } = useQuery<{ count: number }>({
    queryKey: ['/api/dashboard/teams-count'],
    enabled: user?.role === 'employee',
  });

  if (isLoading) {
    return (
      <div className={`grid gap-4 sm:gap-6 mb-6 sm:mb-8 ${
        isMobile ? 'grid-cols-2' : isTablet ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      }`}>
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-6 sm:h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} bg-gray-200 rounded-lg`}></div>
              </div>
              <div className="mt-3 sm:mt-4">
                <div className="h-2 sm:h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  const completedThisWeek = Array.isArray(tasks)
    ? tasks.filter((t: any) => t.status === 'done' && t.completedAt && new Date(t.completedAt) >= daysAgo(7)).length
    : 0;

  const teamsCount = Array.isArray(teams) ? teams.length : 0;
  const upcomingCount = Array.isArray(upcoming) ? upcoming.length : 0;

  const cards = [
    {
      title: "Active Projects",
      value: metrics?.activeProjects || 0,
      icon: BarChart3,
      color: "bg-primary",
      change: `${teamsCount} team${teamsCount === 1 ? '' : 's'}`,
      changeLabel: "you're part of",
      testId: "card-active-projects"
    },
    {
      title: "Milestones Completed",
      value: metrics?.completedTasks || 0,
      icon: CheckCircle,
      color: "bg-success",
      change: `+${completedThisWeek}`,
      changeLabel: "this week",
      testId: "card-completed-tasks"
    },
    {
      title: "Overdue Milestones",
      value: metrics?.overdueTasks || 0,
      icon: AlertTriangle,
      color: "bg-error",
      change: `${metrics?.overdueTasks || 0} overdue · ${upcomingCount} due soon`,
      changeLabel: "",
      isNegative: true,
      testId: "card-overdue-tasks"
    },
    {
      title: user?.role === 'employee' ? "Team Members" : "Staff Members",
      value: user?.role === 'employee' ? (employeeTeamsCount?.count || 0) : (metrics?.teamMembers || 0),
      icon: Users,
      color: "bg-warning",
      change: user?.role === 'employee' 
        ? `${employeeTeamsCount?.count || 0} team${(employeeTeamsCount?.count || 0) === 1 ? '' : 's'}`
        : `${teamsCount} team${teamsCount === 1 ? '' : 's'}`,
      changeLabel: user?.role === 'employee' ? "you're in" : "across your teams",
      testId: "card-team-members"
    }
  ];

  return (
    <div className={`grid gap-4 sm:gap-6 mb-6 sm:mb-8 ${
      isMobile ? 'grid-cols-2' : isTablet ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
    }`}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="bg-surface border border-gray-200 hover:shadow-md transition-shadow" data-testid={card.testId}>
            <CardContent className={`${isMobile ? 'p-4' : 'p-5 sm:p-6'}`}>
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-600 truncate`} data-testid={`text-${card.testId}-title`}>
                    {isMobile && card.title === "Milestones Completed" ? "Completed" : 
                     isMobile && card.title === "Overdue Milestones" ? "Overdue" :
                     isMobile && card.title.includes("Members") ? "Members" :
                     card.title}
                  </p>
                  <p className={`${isMobile ? 'text-xl' : 'text-2xl sm:text-3xl'} font-bold text-gray-900 mt-1`} data-testid={`text-${card.testId}-value`}>
                    {card.value}
                  </p>
                </div>
                <div className={`${isMobile ? 'p-2' : 'p-2 sm:p-3'} ${card.color} bg-opacity-10 rounded-lg flex-shrink-0`}>
                  <Icon className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5 sm:h-6 sm:w-6'} ${card.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
              <div className={`${isMobile ? 'mt-2' : 'mt-3 sm:mt-4'} flex items-start`}>
                <div className="min-w-0 flex-1">
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium ${card.isNegative ? 'text-error' : 'text-success'} truncate block`}>
                    {card.change}
                  </span>
                  {card.changeLabel && (
                    <span className={`text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'} block truncate`}>
                      {card.changeLabel}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
