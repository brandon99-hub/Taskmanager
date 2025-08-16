import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Users, BarChart3, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function QuickActions() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const auth = useAuth() as any;
  const { user } = auth;

  const handleExportData = () => {
    // Generate CSV data from current tasks/projects
    toast({
      title: "Export Started",
      description: "Generating report... This feature will download CSV files soon.",
    });
  };

  const actions = [
    {
      icon: Plus,
      label: "Create New Project",
      tooltip: "Start a new project with tasks and team assignments",
      testId: "action-create-project",
      onClick: () => {
        // Fire a global event to open the modal on the current page
        window.dispatchEvent(new CustomEvent('open-create-project'))
      },
      allowedRoles: ['admin', 'manager']
    },
    {
      icon: Users,
      label: "Manage Milestones",
      tooltip: "View, assign and update task statuses",
      testId: "action-manage-tasks", 
      onClick: () => setLocation('/tasks'),
      allowedRoles: ['admin', 'manager', 'employee']
    },
    {
      icon: BarChart3,
      label: "View Reports",
      tooltip: "Access analytics and performance reports",
      testId: "action-view-analytics",
      onClick: () => setLocation('/reports'),
      allowedRoles: ['admin', 'manager']
    },
    {
      icon: Download,
      label: "Export Data",
      tooltip: "Download project and task data as CSV",
      testId: "action-export-data",
      onClick: handleExportData,
      allowedRoles: ['admin', 'manager']
    }
  ].filter(action => action.allowedRoles.includes(user?.role || 'employee'));

  return (
    <Card className="bg-surface shadow-sm border border-gray-200" data-testid="quick-actions">
      <CardHeader>
        <CardTitle className="text-lg" data-testid="text-quick-actions-title">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Tooltip key={action.testId}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left p-3 hover:bg-gray-50 transition-colors"
                    onClick={action.onClick}
                    data-testid={action.testId}
                  >
                    <Icon className="h-4 w-4 mr-3 text-primary" />
                    <span className="text-sm text-gray-700">{action.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{action.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
