import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import ResetPassword from "@/pages/reset-password";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Tasks from "@/pages/tasks";
import Reports from "@/pages/reports";
import ReportDetail from "@/pages/report-detail";
import Team from "@/pages/team";
import TeamDetail from "@/pages/team-detail";
import ExecutiveDashboard from "@/pages/executive-dashboard";
import MarketingLogin from "@/pages/marketing-login";
import MarketingDashboard from "@/pages/marketing-dashboard";
import MarketingResetPassword from "@/pages/marketing-reset-password";
import Logs from "@/pages/logs";
import Tickets from "@/pages/tickets";
import Companies from "@/pages/companies";
import ServiceCategories from "@/pages/service-categories";
import Segments from "@/pages/segments";
import AuthenticatedLayout from "@/components/layout/authenticated-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";

function Router() {
  const { isAuthenticated, isLoading, user, isAdminRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Marketing Pipeline Routes - Independent System */}
      <Route path="/marketing/login" component={MarketingLogin} />
      <Route path="/marketing/reset-password" component={MarketingResetPassword} />
      <Route path="/marketing/dashboard" component={MarketingDashboard} />
      <Route path="/marketing/admin" component={MarketingDashboard} />
      
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/support" component={Landing} />
          <Route path="/login" component={Login} />
          <Route path="/reset-password" component={ResetPassword} />
        </>
      ) : (
        <Route>
          {() => (
            <AuthenticatedLayout>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/support" component={Landing} />
                <Route path="/home" component={Home} />
                <Route path="/projects" component={Projects} />
                <Route path="/projects/:id" component={ProjectDetail} />
                <Route path="/tasks" component={Tasks} />
                <Route path="/tickets" component={Tickets} />
                <Route path="/companies" component={Companies} />
                <Route path="/segments" component={Segments} />
                <Route path="/sectors" component={Segments} />
                <Route path="/service-categories" component={ServiceCategories} />
                {isAdminRole() && (
                  <>
                    <Route path="/reports" component={Reports} />
                    <Route path="/reports/detail" component={ReportDetail} />
                    <Route path="/executive-dashboard" component={ExecutiveDashboard} />
                    <Route path="/logs" component={Logs} />
                  </>
                )}
                <Route path="/teams" component={Team} />
                <Route path="/teams/:teamId" component={TeamDetail} />
                <Route component={NotFound} />
              </Switch>
            </AuthenticatedLayout>
          )}
        </Route>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
