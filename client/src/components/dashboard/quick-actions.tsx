import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, BarChart3, Settings, FileText, Ticket, Mail, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function QuickActions() {
  const [, setLocation] = useLocation();
  const auth = useAuth() as any;
  const { user, getDashboardType, isAdminRole, hasAnyPermission } = auth;
  const dashboardType = getDashboardType();

  const getActionsForRole = () => {
    const baseActions = [
      {
        icon: Ticket,
        label: "Tickets",
        tooltip: "View and manage support tickets",
        testId: "action-tickets",
        onClick: () => setLocation('/tickets'),
        allowedRoles: ['admin', 'manager', 'employee', 'segment_leader']
      }
    ];

    if (isAdminRole?.() || hasAnyPermission?.(['inbox.manage'])) {
      baseActions.push({
        icon: Mail,
        label: "Inbox",
        tooltip: "View incoming ticket emails",
        testId: "action-inbox",
        onClick: () => setLocation('/inbox'),
        allowedRoles: ['admin', 'manager', 'employee', 'segment_leader']
      });
    }

    if (isAdminRole?.() || hasAnyPermission?.(['reports.view'])) {
      baseActions.push({
        icon: BarChart3,
        label: "Reports",
        tooltip: "Access analytics and performance reports",
        testId: "action-view-reports",
        onClick: () => setLocation('/reports'),
        allowedRoles: ['admin', 'manager', 'employee', 'segment_leader']
      });
    }

    // Role-specific actions
    switch (dashboardType) {
      case 'segment_leader_academic':
      case 'segment_leader_parastals':
      case 'segment_leader_private': {
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
        ];
      }

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
          ...baseActions,
          {
            icon: Settings,
            label: "Manage Teams",
            tooltip: "Create and manage teams and admin roles",
            testId: "action-manage-teams",
            onClick: () => setLocation('/teams'),
            allowedRoles: ['admin', 'manager']
          },
          {
            icon: Building2,
            label: "Companies",
            tooltip: "View and manage client companies",
            testId: "action-companies",
            onClick: () => setLocation('/companies'),
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
