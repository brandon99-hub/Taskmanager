import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useScreenSize } from "@/hooks/use-mobile";
import Navigation from "@/components/layout/navigation";
import MetricsCards from "@/components/dashboard/metrics-cards";
import InvoiceReport from "@/components/dashboard/invoice-report";
import KanbanBoard from "@/components/dashboard/kanban-board";
import UpcomingDeadlines from "@/components/dashboard/upcoming-deadlines";
import TeamWorkload from "@/components/dashboard/team-workload";
import QuickActions from "@/components/dashboard/quick-actions";
import CreateProjectModal from "@/components/projects/create-project-modal";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { isMobile, isTablet } = useScreenSize();

  // Authentication is handled by the router, no need for redirect logic here

  return (
    <div className="min-h-screen bg-background-page">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        
        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 lg:mb-8">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl sm:text-3xl font-medium text-gray-900 mb-1 sm:mb-2 truncate" data-testid="text-title">
              {isMobile ? "Dashboard" : "Project Dashboard"}
            </h2>
            <p className="text-sm sm:text-base text-gray-600" data-testid="text-subtitle">
              {isMobile ? "Track & manage work" : "Track projects, manage tasks, and monitor team performance"}
            </p>
          </div>
          <div className="flex space-x-3 mt-3 sm:mt-0 w-full sm:w-auto">
            {/* Ensure modal mounted at dashboard to allow opening here too */}
            <CreateProjectModal />
          </div>
        </div>

        {/* Metrics Cards */}
        <MetricsCards />

        {/* Invoice Report Section - Above Critical Milestones Board */}
        <InvoiceReport />

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
    </div>
  );
}
