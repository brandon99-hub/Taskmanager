import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PriorityBadge from "@/components/ui/priority-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

interface TaskCardProps {
  task: {
    id: string;
    name: string;
    description?: string;
    priority: string;
    status: string;
    dueDate?: string;
    estimatedHours?: number;
    project: {
      id: string;
      name: string;
    };
    assignedUser?: {
      id: string;
      firstName?: string;
      lastName?: string;
      email: string;
      profileImageUrl?: string;
    };
  };
}

export default function TaskCard({ task }: TaskCardProps) {
  const { toast } = useToast();

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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'review': return 'bg-yellow-100 text-yellow-800';
      case 'done': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo': return 'To Do';
      case 'in_progress': return 'In Progress';
      case 'review': return 'Review';
      case 'done': return 'Done';
      default: return status;
    }
  };

  const handleStatusChange = (newStatus: string) => {
    updateTaskMutation.mutate({ taskId: task.id, status: newStatus });
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  return (
    <Card 
      className={`hover:shadow-md transition-shadow ${isOverdue ? 'border-error' : ''}`}
      data-testid={`task-card-${task.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h4 className="font-medium text-gray-900 text-sm line-clamp-2" data-testid={`text-task-name-${task.id}`}>
            {task.name}
          </h4>
          <PriorityBadge priority={task.priority} />
        </div>

        {task.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2" data-testid={`text-task-description-${task.id}`}>
            {task.description}
          </p>
        )}

        <div className="space-y-2 mb-3">
          <div className="flex items-center text-xs text-gray-600">
            <Calendar className="h-3 w-3 mr-1" />
            <span data-testid={`text-task-project-${task.id}`}>{task.project.name}</span>
          </div>

          {task.dueDate && (
            <div className={`flex items-center text-xs ${isOverdue ? 'text-error' : 'text-gray-600'}`}>
              <Clock className="h-3 w-3 mr-1" />
              <span data-testid={`text-task-due-date-${task.id}`}>
                Due: {new Date(task.dueDate).toLocaleDateString()}
                {isOverdue && ' (Overdue)'}
              </span>
            </div>
          )}

          {task.estimatedHours && (
            <div className="flex items-center text-xs text-gray-600">
              <Clock className="h-3 w-3 mr-1" />
              <span data-testid={`text-task-hours-${task.id}`}>
                {task.estimatedHours}h estimated
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          {task.assignedUser ? (
            <div className="flex items-center space-x-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={task.assignedUser.profileImageUrl} />
                <AvatarFallback className="text-xs">
                  {getInitials(task.assignedUser.firstName && task.assignedUser.lastName 
                    ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}`
                    : task.assignedUser.email
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-gray-600" data-testid={`text-task-assignee-${task.id}`}>
                {task.assignedUser.firstName || task.assignedUser.email.split('@')[0]}
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <User className="h-3 w-3" />
              <span>Unassigned</span>
            </div>
          )}

          <Badge 
            className={`text-xs ${getStatusColor(task.status)}`}
            data-testid={`badge-task-status-${task.id}`}
          >
            {getStatusLabel(task.status)}
          </Badge>
        </div>

        <div className="mt-3">
          <Select value={task.status} onValueChange={handleStatusChange} disabled={updateTaskMutation.isPending}>
            <SelectTrigger className="h-8 text-xs" data-testid={`select-task-status-${task.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
