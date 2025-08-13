import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";

export default function UpcomingDeadlines() {
  const { data: upcomingTasks = [], isLoading } = useQuery({
    queryKey: ['/api/dashboard/upcoming-tasks'],
  });

  const getUrgencyColor = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) return 'bg-red-50 border-red-200';
    if (diffDays <= 3) return 'bg-yellow-50 border-yellow-200';
    return 'bg-blue-50 border-blue-200';
  };

  const getUrgencyDot = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) return 'bg-error';
    if (diffDays <= 3) return 'bg-warning';
    return 'bg-primary';
  };

  const formatDeadline = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Overdue';
    if (diffDays === 1) return 'Due Tomorrow';
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    return due.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card className="bg-surface shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface shadow-sm border border-gray-200" data-testid="upcoming-deadlines">
      <CardHeader>
        <CardTitle className="text-lg flex items-center" data-testid="text-deadlines-title">
          <Calendar className="h-5 w-5 mr-2" />
          Upcoming Deadlines
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500" data-testid="text-no-deadlines">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p>No upcoming deadlines</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingTasks.slice(0, 5).map((task: any) => (
              <div 
                key={task.id} 
                className={`flex items-center space-x-3 p-3 rounded-lg border ${getUrgencyColor(task.dueDate)}`}
                data-testid={`deadline-item-${task.id}`}
              >
                <div className="flex-shrink-0">
                  <div className={`w-3 h-3 ${getUrgencyDot(task.dueDate)} rounded-full`}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" data-testid={`text-deadline-task-${task.id}`}>
                    {task.name}
                  </p>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm text-gray-600" data-testid={`text-deadline-project-${task.id}`}>
                      {task.project?.name}
                    </p>
                    {task.assignedUser && (
                      <Badge variant="outline" className="text-xs">
                        {task.assignedUser.firstName || task.assignedUser.email}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600" data-testid={`text-deadline-date-${task.id}`}>
                    {formatDeadline(task.dueDate)}
                  </p>
                </div>
              </div>
            ))}
            
            {upcomingTasks.length > 5 && (
              <div className="text-center pt-2">
                <Badge variant="outline" data-testid="badge-more-deadlines">
                  +{upcomingTasks.length - 5} more deadlines
                </Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
