import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useScreenSize } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, CheckCircle, AlertTriangle, Users } from "lucide-react";
import MilestoneDetailModal from "./milestone-detail-modal";

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

  // For admin/manager, get total users count
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
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
  
  // Get total staff members for admin/manager, teams count for employee
  const staffOrTeamsCount = user?.role === 'employee' 
    ? (employeeTeamsCount?.count || 0)
    : (Array.isArray(users) ? users.length : 0);

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
      testId: "card-completed-tasks",
      hasModal: true,
      modalType: "completed"
    },
    {
      title: "Overdue Milestones",
      value: metrics?.overdueTasks || 0,
      icon: AlertTriangle,
      color: "bg-error",
      change: `${metrics?.overdueTasks || 0} overdue · ${upcomingCount} due soon`,
      changeLabel: "",
      isNegative: true,
      testId: "card-overdue-tasks",
      hasModal: true,
      modalType: "overdue"
    },
    {
      title: user?.role === 'employee' ? "Teams You're Part Of" : "Total Staff Members",
      value: staffOrTeamsCount,
      icon: Users,
      color: "bg-info",
      change: user?.role === 'employee' ? "teams you're part of" : "total staff members",
      changeLabel: "",
      testId: "card-team-members"
    }
  ];

  const renderIcon = (icon: any, color: string) => {
    if (icon === BarChart3) return <BarChart3 className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === CheckCircle) return <CheckCircle className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === AlertTriangle) return <AlertTriangle className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === Users) return <Users className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    return null;
  };

  const renderCard = (card: any) => {
    if (card.hasModal) {
      return (
        <MilestoneDetailModal
          type={card.modalType}
          trigger={
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">{card.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                    <p className="text-sm text-gray-500">{card.change}</p>
                  </div>
                  <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} ${card.color} rounded-lg flex items-center justify-center`}>
                    {renderIcon(card.icon, card.color)}
                  </div>
                </div>
              </CardContent>
            </Card>
          }
        />
      );
    }

    return (
      <Card>
        <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500">{card.change}</p>
            </div>
            <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} ${card.color} rounded-lg flex items-center justify-center`}>
              {renderIcon(card.icon, card.color)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={`grid gap-4 sm:gap-6 mb-6 sm:mb-8 ${
      isMobile ? 'grid-cols-2' : isTablet ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
    }`}>
      {cards.map((card, index) => (
        <div key={index}>
          {renderCard(card)}
        </div>
      ))}
    </div>
  );
}
