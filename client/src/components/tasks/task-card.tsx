import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useScreenSize } from "@/hooks/use-mobile";
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
    feeAmount?: string | number;
    billingStatus?: 'none' | 'to_send' | 'sent' | 'paid';
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
  const auth = useAuth() as any;
  const { user } = auth;
  const { isMobile, isTablet } = useScreenSize();

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
        description: "Milestone status updated successfully",
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
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update milestone status",
        variant: "destructive",
      });
    },
  });

  const updateBillingStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: 'none' | 'to_send' | 'sent' | 'paid' }) => {
      const response = await apiRequest("PUT", `/api/tasks/${taskId}/billing-status`, { billingStatus: status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      // Also invalidate project-specific tasks if we're in project detail page
      if (task.project?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", task.project.id, "tasks"] });
      }
      toast({ title: "Success", description: "Billing status updated" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update billing status", variant: "destructive" });
    },
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'client_review': return 'bg-yellow-100 text-yellow-800';
      case 'done': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo': return 'Not Started';
      case 'in_progress': return 'In Progress';
      case 'client_review': return 'Client Review';
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
      <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <h4 className={`font-medium text-gray-900 ${isMobile ? 'text-sm' : 'text-sm'} line-clamp-2 flex-1 mr-2`} data-testid={`text-task-name-${task.id}`}>
            {task.name}
          </h4>
          <PriorityBadge priority={task.priority} className="flex-shrink-0" />
        </div>

        {!isMobile && task.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2" data-testid={`text-task-description-${task.id}`}>
            {task.description}
          </p>
        )}

        <div className={`space-y-${isMobile ? '1' : '2'} mb-3`}>
          {task.project && (
            <div className="flex items-center text-xs text-gray-600">
              <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate" data-testid={`text-task-project-${task.id}`}>{task.project.name}</span>
            </div>
          )}

          {task.dueDate && (
            <div className={`flex items-center text-xs ${isOverdue ? 'text-error' : 'text-gray-600'}`}>
              <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate" data-testid={`text-task-due-date-${task.id}`}>
                {isMobile ? 
                  `${new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${isOverdue ? ' (Late)' : ''}` :
                  `Due: ${new Date(task.dueDate).toLocaleDateString()}${isOverdue ? ' (Overdue)' : ''}`
                }
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
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <Avatar className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} flex-shrink-0`}>
                <AvatarImage src={task.assignedUser.profileImageUrl} />
                <AvatarFallback className="text-xs">
                  {getInitials(task.assignedUser.firstName && task.assignedUser.lastName 
                    ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}`
                    : task.assignedUser.email
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-gray-600 truncate" data-testid={`text-task-assignee-${task.id}`}>
                {isMobile 
                  ? (task.assignedUser.firstName?.[0] || task.assignedUser.email.split('@')[0].substring(0, 3))
                  : (task.assignedUser.firstName || task.assignedUser.email.split('@')[0])
                }
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-xs text-gray-500 min-w-0 flex-1">
              <User className="h-3 w-3 flex-shrink-0" />
              <span>{isMobile ? 'None' : 'Unassigned'}</span>
            </div>
          )}

          <Badge 
            className={`text-xs ${getStatusColor(task.status)} flex-shrink-0`}
            data-testid={`badge-task-status-${task.id}`}
          >
            {getStatusLabel(task.status)}
          </Badge>
        </div>

        {/* Fee & Billing */}
        {(task.feeAmount || task.billingStatus) && (
          <div className="flex items-center justify-between mb-2 text-xs">
            {task.feeAmount && (
              <span className="text-gray-700" data-testid={`text-task-fee-${task.id}`}>
                KSh {Number(task.feeAmount).toLocaleString()}
              </span>
            )}
            <div className="flex items-center gap-2">
              {task.billingStatus && task.billingStatus !== 'none' && (
                <Badge variant={task.billingStatus === 'paid' ? 'success' as any : task.billingStatus === 'to_send' ? 'warning' as any : 'secondary'} className="text-xs" data-testid={`badge-billing-${task.id}`}>
                  {task.billingStatus === 'to_send' ? 'To Send' : task.billingStatus.charAt(0).toUpperCase() + task.billingStatus.slice(1)}
                </Badge>
              )}
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <Select
                  value={task.billingStatus || 'none'}
                  onValueChange={(v) => updateBillingStatusMutation.mutate({ taskId: task.id, status: v as any })}
                  disabled={updateBillingStatusMutation.isPending}
                >
                  <SelectTrigger className="h-7 text-xs w-[120px]" data-testid={`select-billing-status-${task.id}`}>
                    <SelectValue placeholder="Billing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="to_send">To Send</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        <div className="mt-3">
          <Select value={task.status} onValueChange={handleStatusChange} disabled={updateTaskMutation.isPending}>
            <SelectTrigger className="h-8 text-xs" data-testid={`select-task-status-${task.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
                                      <SelectItem value="todo">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="client_review">Client Review</SelectItem>
              {user?.role !== 'employee' && (
                <SelectItem value="done">Done</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
