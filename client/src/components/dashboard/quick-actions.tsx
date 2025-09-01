import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Users, BarChart3, Download, UserPlus, DollarSign, Settings, FileText } from "lucide-react";
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
  console.log('QuickActions - dashboardType:', dashboardType);
  console.log('QuickActions - user role:', user?.role);
  console.log('QuickActions - isAdminRole():', isAdminRole());

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
        label: "Manage Milestones",
        tooltip: "View, assign and update task statuses",
        testId: "action-manage-tasks", 
        onClick: () => setLocation('/tasks'),
        allowedRoles: ['admin', 'manager', 'employee', 'project_manager', 'finance_head', 'segment_leader']
      }
    ];

    // Role-specific actions
    switch (dashboardType) {
      case 'project_manager':
        return [
          {
            icon: Plus,
            label: "Create New Project",
            tooltip: "Start a new project with tasks and team assignments",
            testId: "action-create-project",
            onClick: () => {
              window.dispatchEvent(new CustomEvent('open-create-project'))
            },
            allowedRoles: ['project_manager']
          },
          {
            icon: UserPlus,
            label: "Manage Teams",
            tooltip: "Create and manage project teams",
            testId: "action-manage-teams",
            onClick: () => setLocation('/teams'),
            allowedRoles: ['project_manager']
          },
          ...baseActions,
          {
            icon: BarChart3,
            label: "Project Reports",
            tooltip: "View project performance and analytics",
            testId: "action-view-analytics",
            onClick: () => setLocation('/reports'),
            allowedRoles: ['project_manager']
          },
          {
            icon: Download,
            label: "Export Data",
            tooltip: "Download project and task data as CSV",
            testId: "action-export-data",
            onClick: handleExportData,
            allowedRoles: ['project_manager']
          }
        ];

      case 'finance_head':
        return [
          {
            icon: DollarSign,
            label: "Invoice Management",
            tooltip: "Manage invoices and payment tracking",
            testId: "action-manage-invoices",
            onClick: () => setLocation('/invoices'),
            allowedRoles: ['finance_head']
          },
          {
            icon: FileText,
            label: "Financial Reports",
            tooltip: "View financial reports and analytics",
            testId: "action-financial-reports",
            onClick: () => setLocation('/reports?tab=financial'),
            allowedRoles: ['finance_head']
          },
          ...baseActions,
          {
            icon: Download,
            label: "Export Financial Data",
            tooltip: "Download financial reports and invoices",
            testId: "action-export-data",
            onClick: handleExportData,
            allowedRoles: ['finance_head']
          }
        ];

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
        return baseActions;
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
