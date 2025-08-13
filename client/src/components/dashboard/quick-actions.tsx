import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, BarChart3, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function QuickActions() {
  const { toast } = useToast();

  const handleQuickAction = (action: string) => {
    toast({
      title: "Quick Action",
      description: `${action} functionality will be available soon`,
    });
  };

  const actions = [
    {
      icon: Plus,
      label: "Create New Task",
      testId: "action-create-task",
      onClick: () => handleQuickAction("Create Task")
    },
    {
      icon: Users,
      label: "Assign Tasks",
      testId: "action-assign-tasks", 
      onClick: () => handleQuickAction("Assign Tasks")
    },
    {
      icon: BarChart3,
      label: "View Analytics",
      testId: "action-view-analytics",
      onClick: () => window.location.href = '/reports'
    },
    {
      icon: Download,
      label: "Export Data",
      testId: "action-export-data",
      onClick: () => handleQuickAction("Export Data")
    }
  ];

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
              <Button
                key={action.testId}
                variant="ghost"
                className="w-full justify-start text-left p-3 hover:bg-gray-50 transition-colors"
                onClick={action.onClick}
                data-testid={action.testId}
              >
                <Icon className="h-4 w-4 mr-3 text-primary" />
                <span className="text-sm text-gray-700">{action.label}</span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
