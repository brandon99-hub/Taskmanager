import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useScreenSize } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/layout/navigation";
import MetricsCards from "@/components/dashboard/metrics-cards";
import InvoiceReport from "@/components/dashboard/invoice-report";
import ProjectManagementHub from "@/components/dashboard/project-management-hub";
import RiskQualityControl from "@/components/dashboard/risk-quality-control";
import KanbanBoard from "@/components/dashboard/kanban-board";
import UpcomingDeadlines from "@/components/dashboard/upcoming-deadlines";
import TeamWorkload from "@/components/dashboard/team-workload";
import QuickActions from "@/components/dashboard/quick-actions";
import CreateProjectModal from "@/components/projects/create-project-modal";
import PasswordChangeModal from "@/components/auth/password-change-modal";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Dashboard() {
  const { isAuthenticated, isLoading, getDashboardType, getSegment, isAdminRole } = useAuth();
  const { toast } = useToast();
  const { isMobile, isTablet } = useScreenSize();
  const dashboardType = getDashboardType();
  const segment = getSegment();
  
  // Debug logging
  // console.debug('Dashboard - dashboardType:', dashboardType);
  // console.debug('Dashboard - isAdminRole():', isAdminRole());
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Check if user must change password
  const { data: passwordStatus } = useQuery<{ mustChangePassword?: boolean }>({
    queryKey: ['/api/auth/must-change-password'],
    enabled: !!isAuthenticated,
  });

  // Show password modal if required
  useEffect(() => {
    if (passwordStatus?.mustChangePassword) {
      setShowPasswordModal(true);
    }
  }, [passwordStatus]);

  // Get user-friendly role name for header
  const getRoleName = () => {
    switch (dashboardType) {
      case 'project_manager': return 'Project Manager Dashboard';
      case 'finance_head': return 'Finance Head Dashboard';
      case 'segment_leader_academic': return 'Academic Segment Leader Dashboard';
      case 'segment_leader_parastals': return 'Parastatal Segment Leader Dashboard';
      case 'segment_leader_private': return 'Private Segment Leader Dashboard';
      case 'admin': return 'Admin Dashboard';
      case 'employee': return 'Employee Dashboard';
      default: return 'Project Dashboard';
    }
  };

  const getSubtitle = () => {
    if (isMobile) return "Track & manage work";
    
    switch (dashboardType) {
      case 'project_manager': return 'Oversee all projects, teams, and deliverables';
      case 'finance_head': return 'Monitor financial performance, collections, and budgets';
      case 'segment_leader_academic': return 'Manage academic sector projects and performance';
      case 'segment_leader_parastals': return 'Manage parastatal sector projects and performance';
      case 'segment_leader_private': return 'Manage private sector projects and performance';
      case 'admin': return 'System administration and user management';
      case 'employee': return 'Track your assigned tasks and deadlines';
      default: return 'Track projects, manage tasks, and monitor team performance';
    }
  };

  // Authentication is handled by the router, no need for redirect logic here

  return (
    <div className="min-h-screen bg-background-page">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        
        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 lg:mb-8">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl sm:text-3xl font-medium text-gray-900 mb-1 sm:mb-2 truncate" data-testid="text-title">
              {isMobile ? "Dashboard" : getRoleName()}
            </h2>
            <p className="text-sm sm:text-base text-gray-600" data-testid="text-subtitle">
              {getSubtitle()}
            </p>
          </div>
          <div className="flex space-x-3 mt-3 sm:mt-0 w-full sm:w-auto">
            {/* Ensure modal mounted at dashboard to allow opening here too */}
            {isAdminRole() && (
              <CreateProjectModal />
            )}
          </div>
        </div>

        {/* Metrics Cards */}
        <MetricsCards />

        {/* Section 1 - Role-based content */}
        {dashboardType === 'project_manager' ? (
          <ProjectManagementHub />
        ) : (dashboardType === 'finance_head' || ['admin', 'manager'].includes(dashboardType)) ? (
          <InvoiceReport />
        ) : null}

        {/* Section 2 - Risk Management & Quality Control for Project Managers */}
        {dashboardType === 'project_manager' && (
          <RiskQualityControl />
        )}

        {/* Main Content */}
        <div className={`grid gap-6 lg:gap-8 ${isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
          
          {/* Kanban Board Section */}
          <div className={isMobile || isTablet ? 'order-1' : 'lg:col-span-2 order-1'}>
            <KanbanBoard />
          </div>

          {/* Right Sidebar */}
          <div className={`space-y-4 sm:space-y-6 ${isMobile ? 'order-2' : isTablet ? 'order-2' : 'order-2'}`}>
            <UpcomingDeadlines />
            <TeamWorkload />
            <QuickActions />
          </div>
        </div>
      </div>
      
      {/* Password Change Modal */}
      <PasswordChangeModal 
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        isForced={passwordStatus?.mustChangePassword || false}
      />
    </div>
  );
}
