import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Users, BarChart3, Download, Settings, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function QuickActions() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const auth = useAuth() as any;
  const { user, getDashboardType, isAdminRole } = auth;
  const dashboardType = getDashboardType();
  
  // Debug logging
  // console.debug('QuickActions - dashboardType:', dashboardType);
  // console.debug('QuickActions - user role:', user?.role);
  // console.debug('QuickActions - isAdminRole():', isAdminRole());

  const handleExportData = () => {
    // Generate CSV data from current tasks/projects
    toast({
      title: "Export Started",
      description: "Generating report... This feature will download CSV files soon.",
    });
  };

  const getActionsForRole = () => {
    const baseActions = [
      {
        icon: Users,
        label: "Ticket Board",
        tooltip: "View tickets grouped by status",
        testId: "action-manage-tasks",
        onClick: () => setLocation('/tasks'),
        allowedRoles: ['admin', 'manager', 'employee', 'segment_leader']
      }
    ];

    // Role-specific actions
    switch (dashboardType) {
      case 'segment_leader_academic':
      case 'segment_leader_parastals':
      case 'segment_leader_private':
        const segment = dashboardType.split('_')[2];
        return [
          {
            icon: BarChart3,
            label: `${segment.charAt(0).toUpperCase() + segment.slice(1)} Analytics`,
            tooltip: `View ${segment} segment performance and reports`,
            testId: "action-segment-analytics",
            onClick: () => setLocation(`/reports?segment=${segment}`),
            allowedRoles: ['segment_leader']
          },
          ...baseActions,
          {
            icon: Download,
            label: "Export Segment Data",
            tooltip: `Download ${segment} segment reports`,
            testId: "action-export-data",
            onClick: handleExportData,
            allowedRoles: ['segment_leader']
          }
        ];

      case 'admin':
      case 'manager':
        return [
          {
            icon: Plus,
            label: "Create New Project",
            tooltip: "Start a new project with tasks and team assignments",
            testId: "action-create-project",
            onClick: () => {
              window.dispatchEvent(new CustomEvent('open-create-project'))
            },
            allowedRoles: ['admin', 'manager']
          },
          {
            icon: Settings,
            label: "Admin Management",
            tooltip: "Manage admin roles and system settings",
            testId: "action-admin-management",
            onClick: () => setLocation('/teams'), // Admin role management is in teams page
            allowedRoles: ['admin', 'manager']
          },
          ...baseActions,
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
        ];

      default: // Employee
        return [
          {
            icon: FileText,
            label: "View My Tasks",
            tooltip: "View all your assigned subtasks and modules",
            testId: "action-view-my-tasks",
            onClick: () => setLocation('/tasks?view=my-tasks'),
            allowedRoles: ['employee']
          },
          ...baseActions
        ];
    }
  };

  const actions = getActionsForRole().filter(action => {
    // Use isAdminRole() for admin actions, otherwise check specific roles
    if (action.allowedRoles.includes('admin') || action.allowedRoles.includes('manager')) {
      return isAdminRole();
    }
    // For non-admin actions, check both user role and dashboard type
    return action.allowedRoles.includes(user?.role || 'employee') || 
           action.allowedRoles.includes(dashboardType);
  });

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
