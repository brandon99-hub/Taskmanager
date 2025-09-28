import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ResetPassword from "@/pages/reset-password";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Tasks from "@/pages/tasks";
import Reports from "@/pages/reports";
import ReportDetail from "@/pages/report-detail";
import Contracts from "@/pages/contracts";
import ContractDetail from "@/pages/contract-detail";
import ContractForm from "@/pages/contract-form";
import Team from "@/pages/team";
import TeamDetail from "@/pages/team-detail";
import ExecutiveDashboard from "@/pages/executive-dashboard";
import MarketingLogin from "@/pages/marketing-login";
import MarketingDashboard from "@/pages/marketing-dashboard";
import MarketingResetPassword from "@/pages/marketing-reset-password";
import Logs from "@/pages/logs";
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
          <Route path="/" component={Login} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/reset-password" component={ResetPassword} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/home" component={Home} />
          <Route path="/projects" component={Projects} />
          <Route path="/projects/:id" component={ProjectDetail} />
          <Route path="/tasks" component={Tasks} />
          {isAuthenticated && isAdminRole() && (
            <>
              <Route path="/reports" component={Reports} />
              <Route path="/reports/detail" component={ReportDetail} />
              <Route path="/contracts" component={Contracts} />
              <Route path="/contracts/new" component={ContractForm} />
              <Route path="/contracts/:id" component={ContractDetail} />
              <Route path="/contracts/:id/edit" component={ContractForm} />
              <Route path="/executive-dashboard" component={ExecutiveDashboard} />
              <Route path="/logs" component={Logs} />
            </>
          )}
          <Route path="/teams" component={Team} />
          <Route path="/teams/:teamId" component={TeamDetail} />
        </>
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
