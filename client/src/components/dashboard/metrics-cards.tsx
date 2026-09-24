import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useScreenSize } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, CheckCircle, AlertTriangle, Eye, DollarSign, Building, GraduationCap, Clock, ClipboardList, Ticket } from "lucide-react";

// Define the metrics interface for better type safety
interface DashboardMetrics {
  totalProjects?: number;
  totalTeamProjects?: number;
  activeTeamProjects?: number;
  assignedSubtasks?: number;
  completedSubtasks?: number;
  openTicketsCount?: number;
  resolvedTicketsCount?: number;
  overdueSubtasks?: number;
  totalOverdue?: number;
  activeProjects?: number;
  projectsOnSupport?: number;
  totalBudget?: number;
  collectedAmount?: number;
  pendingAmount?: number;
  totalSubtasks?: number;
  onSupportProjects?: number;
}

export default function MetricsCards() {
  const auth = useAuth() as any;
  const { user, getDashboardType, getSegment } = auth;
  const { isMobile, isTablet } = useScreenSize();
  const dashboardType = getDashboardType();
  const segment = getSegment();

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
    staleTime: 30 * 1000,
  });

  // Additional data needed for some calculations
  const { data: upcoming = [] } = useQuery<any[]>({
    queryKey: ['/api/dashboard/upcoming-tasks'],
  });

  // Get projects data for segment leaders to calculate segment-specific details
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['/api/projects'],
    enabled: dashboardType?.startsWith('segment_leader'),
  });

  // Segment leader dashboards are still keyed by the legacy academic/parastals/private name
  // (out of scope for the dynamic-segments migration), so resolve that name to the matching
  // dynamic segment's id to filter projects.segmentId.
  const { data: segmentsList = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/segments'],
    enabled: dashboardType?.startsWith('segment_leader'),
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

  const upcomingCount = Array.isArray(upcoming) ? upcoming.length : 0;
  
  // Generate role-based cards
  const getCardsForRole = () => {
    const baseCards = {
      totalTeamProjects: {
        title: "Total Projects",
        value: metrics?.totalTeamProjects || 0,
        icon: BarChart3,
        color: "bg-primary",
        change: "",
        changeLabel: "",
        detail: `${metrics?.activeTeamProjects || 0} active projects`,
        detailColor: "text-primary",
        testId: "card-total-projects"
      },
      subtasksSummary: {
        title: "Subtasks",
        value: metrics?.assignedSubtasks || 0,
        icon: ClipboardList,
        color: "bg-primary",
        change: "",
        changeLabel: "",
        detail: `${metrics?.completedSubtasks || 0} completed`,
        detailColor: "text-primary",
        testId: "card-subtasks-summary"
      },
      activeProjects: {
        title: "Active Projects",
        value: metrics?.activeProjects || 0,
        icon: BarChart3,
        color: "bg-primary",
        change: "",
        changeLabel: "",
        detail: `${metrics?.totalProjects ?? ((metrics?.activeProjects || 0) + (metrics?.projectsOnSupport || 0))} total projects`,
        detailColor: "text-primary",
        testId: "card-active-projects"
      },
      openTickets: {
        title: "Open Tickets",
        value: metrics?.openTicketsCount || 0,
        icon: Ticket,
        color: "bg-warning",
        change: "",
        changeLabel: "",
        detail: "Needs attention",
        detailColor: "text-orange-600",
        testId: "card-open-tickets"
      },
      resolvedTickets: {
        title: "Resolved Tickets",
        value: metrics?.resolvedTicketsCount || 0,
        icon: CheckCircle,
        color: "bg-success",
        change: "",
        changeLabel: "",
        detail: "Closed out",
        detailColor: "text-green-600",
        testId: "card-resolved-tickets"
      },
      projectsOnSupport: {
        title: "Projects on SLA",
        value: metrics?.projectsOnSupport || 0,
        icon: Eye,
        color: "bg-success",
        change: "",
        changeLabel: "",
        detail: `Success indicator - projects delivered`,
        detailColor: "text-green-600",
        testId: "card-projects-on-support"
      },
      onSupportProjects: {
        title: "On SLA Projects",
        value: metrics?.onSupportProjects || 0,
        icon: Eye,
        color: "bg-info",
        change: "",
        changeLabel: "",
        detail: `${metrics?.activeProjects || 0} active projects`,
        detailColor: "text-indigo-600",
        testId: "card-on-support-projects"
      },
      assignedSubtasks: {
        title: "Assigned Subtasks",
        value: metrics?.assignedSubtasks || 0,
        icon: ClipboardList,
        color: "bg-primary",
        change: "",
        changeLabel: "",
        detail: `${metrics?.totalSubtasks || 0} total subtasks`,
        detailColor: "text-primary",
        testId: "card-assigned-subtasks"
      },
      completedSubtasks: {
        title: "Completed Subtasks",
        value: metrics?.completedSubtasks || 0,
        icon: CheckCircle,
        color: "bg-success",
        change: "",
        changeLabel: "",
        detail: `${metrics?.assignedSubtasks || 0} assigned subtasks`,
        detailColor: "text-green-600",
        testId: "card-completed-subtasks"
      },
      totalBudget: {
        title: "Total Contract Value",
        value: `KSh ${(metrics?.totalBudget || 0).toLocaleString()}`,
        icon: DollarSign,
        color: "bg-success",
        change: "",
        changeLabel: "",
        detail: "All active projects",
        detailColor: "text-green-600",
        testId: "card-total-budget"
      },
      collectedAmount: {
        title: "Amount Collected",
        value: `KSh ${(metrics?.collectedAmount || 0).toLocaleString()}`,
        icon: CheckCircle,
        color: "bg-success",
        change: `${((metrics?.collectedAmount || 0) / (metrics?.totalBudget || 1) * 100).toFixed(1)}% of total`,
        changeLabel: "",
        detail: "Payments received",
        detailColor: "text-green-600",
        testId: "card-collected-amount"
      },
      pendingAmount: {
        title: "Pending Collections",
        value: `KSh ${(metrics?.pendingAmount || 0).toLocaleString()}`,
        icon: Clock,
        color: "bg-warning",
        change: "",
        changeLabel: "",
        detail: "Outstanding invoices",
        detailColor: "text-orange-600",
        testId: "card-pending-amount"
      }
    };

    // Role-specific card combinations
    switch (dashboardType) {
      case 'segment_leader_academic':
      case 'segment_leader_parastals':
      case 'segment_leader_private':
        const segmentName = segment || dashboardType.split('_')[2];
        const segmentIcon = segmentName === 'academic' ? GraduationCap : 
                           segmentName === 'parastals' ? Building : 
                           DollarSign;
        
        const matchingSegmentId = segmentsList.find((s) => s.name.trim().toLowerCase() === segmentName)?.id;
        const segmentProjects = projects.filter((p: any) => p.segmentId === matchingSegmentId);
        
        return [
          {
            ...baseCards.activeProjects,
            title: `${segmentName?.charAt(0).toUpperCase()}${segmentName?.slice(1)} Projects`,
            icon: segmentIcon,
            detail: `${segmentProjects.length} total in ${segmentName}`,
          },
          baseCards.openTickets,
          baseCards.resolvedTickets,
          {
            ...baseCards.totalBudget,
            title: "Segment Budget",
          }
        ];

      case 'employee':
        return [
          baseCards.totalTeamProjects,
          baseCards.subtasksSummary,
          baseCards.openTickets,
          baseCards.resolvedTickets
        ];

      default:
        return [
          baseCards.activeProjects,
          baseCards.openTickets,
          baseCards.resolvedTickets,
          baseCards.onSupportProjects
        ];
    }
  };

  const cards = getCardsForRole();

  const renderIcon = (icon: any, color: string) => {
    if (icon === BarChart3) return <BarChart3 className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === CheckCircle) return <CheckCircle className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === AlertTriangle) return <AlertTriangle className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === Eye) return <Eye className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === DollarSign) return <DollarSign className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === Building) return <Building className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === GraduationCap) return <GraduationCap className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === Clock) return <Clock className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === ClipboardList) return <ClipboardList className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    if (icon === Ticket) return <Ticket className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} />;
    return null;
  };

  const renderCard = (card: any) => {
    return (
      <Card>
        <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className={`text-sm ${card.isNegative ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {card.change}
              </p>
              {card.detail && (
                <p className={`text-xs font-medium ${card.detailColor} mt-1`}>
                  {card.detail}
                </p>
              )}
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