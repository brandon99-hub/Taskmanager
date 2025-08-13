import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/layout/navigation";
import MetricsCards from "@/components/dashboard/metrics-cards";
import KanbanBoard from "@/components/dashboard/kanban-board";
import UpcomingDeadlines from "@/components/dashboard/upcoming-deadlines";
import TeamWorkload from "@/components/dashboard/team-workload";
import QuickActions from "@/components/dashboard/quick-actions";
import CreateProjectModal from "@/components/projects/create-project-modal";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-page">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h2 className="text-3xl font-medium text-gray-900 mb-2" data-testid="text-title">Project Dashboard</h2>
            <p className="text-gray-600" data-testid="text-subtitle">Track projects, manage tasks, and monitor team performance</p>
          </div>
          <div className="flex space-x-3 mt-4 md:mt-0">
            <CreateProjectModal />
          </div>
        </div>

        {/* Metrics Cards */}
        <MetricsCards />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Kanban Board Section */}
          <div className="lg:col-span-2">
            <KanbanBoard />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <UpcomingDeadlines />
            <TeamWorkload />
            <QuickActions />
          </div>
        </div>
      </div>
    </div>
  );
}
