import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PriorityBadge from "@/components/ui/priority-badge";
import { Filter, Search } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

const statusColumns = [
  { id: 'todo', title: 'To Do', color: 'bg-gray-50' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50' },
  { id: 'review', title: 'Review', color: 'bg-yellow-50' },
  { id: 'done', title: 'Done', color: 'bg-green-50' }
];

export default function KanbanBoard() {
  const { toast } = useToast();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['/api/tasks'],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const response = await apiRequest("PUT", `/api/tasks/${taskId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Success",
        description: "Task status updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    },
  });

  const handleTaskStatusChange = (taskId: string, newStatus: string) => {
    updateTaskMutation.mutate({ taskId, status: newStatus });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const tasksByStatus = statusColumns.reduce((acc, column) => {
    acc[column.id] = tasks.filter((task: any) => task.status === column.id);
    return acc;
  }, {} as Record<string, any[]>);

  if (isLoading) {
    return (
      <Card className="bg-surface shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Project Board</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {statusColumns.map((column) => (
              <div key={column.id} className={`${column.color} rounded-lg p-4 animate-pulse`}>
                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-surface p-4 rounded-lg h-32"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface shadow-sm border border-gray-200" data-testid="kanban-board">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg" data-testid="text-kanban-title">Project Board</CardTitle>
          <div className="flex space-x-2">
            <Button variant="ghost" size="sm" data-testid="button-kanban-filter">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" data-testid="button-kanban-search">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {statusColumns.map((column) => {
            const columnTasks = tasksByStatus[column.id] || [];
            
            return (
              <div 
                key={column.id} 
                className={`${column.color} rounded-lg p-4`}
                data-testid={`kanban-column-${column.id}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900" data-testid={`text-column-title-${column.id}`}>
                    {column.title}
                  </h4>
                  <Badge variant="secondary" data-testid={`badge-column-count-${column.id}`}>
                    {columnTasks.length}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {columnTasks.map((task: any) => (
                    <Card 
                      key={task.id} 
                      className="bg-surface border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                      data-testid={`task-card-${task.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-medium text-gray-900 text-sm line-clamp-2" data-testid={`text-task-name-${task.id}`}>
                            {task.name}
                          </h5>
                          <PriorityBadge priority={task.priority} />
                        </div>
                        
                        {task.description && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2" data-testid={`text-task-description-${task.id}`}>
                            {task.description}
                          </p>
                        )}
                        
                        {task.status === 'in_progress' && (
                          <div className="mb-3">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full" 
                                style={{ width: `${Math.random() * 80 + 10}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-2">
                            {task.assignedUser && (
                              <Avatar className="w-6 h-6 border-2 border-white">
                                <AvatarImage src={task.assignedUser.profileImageUrl} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(task.assignedUser.firstName && task.assignedUser.lastName 
                                    ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}`
                                    : task.assignedUser.email || 'U'
                                  )}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                          
                          {task.dueDate && (
                            <span className="text-xs text-gray-500" data-testid={`text-task-due-${task.id}`}>
                              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        
                        {/* Quick status change buttons */}
                        <div className="mt-3 flex space-x-1">
                          {statusColumns.map((status) => (
                            <Button
                              key={status.id}
                              size="sm"
                              variant={task.status === status.id ? "default" : "outline"}
                              className="text-xs h-6 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (task.status !== status.id) {
                                  handleTaskStatusChange(task.id, status.id);
                                }
                              }}
                              disabled={updateTaskMutation.isPending}
                              data-testid={`button-status-${status.id}-${task.id}`}
                            >
                              {status.title.split(' ')[0]}
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {columnTasks.length === 0 && (
                    <div className="text-center py-8 text-gray-500" data-testid={`text-empty-column-${column.id}`}>
                      No {column.title.toLowerCase()} tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
