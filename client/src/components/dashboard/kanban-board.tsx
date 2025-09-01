import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useScreenSize } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import PriorityBadge from "@/components/ui/priority-badge";
import { Filter, Search, ExternalLink, Briefcase, ClipboardList, Zap, Eye, CheckCircle, AlertTriangle, ChevronRight, Calendar, User, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useLocation } from "wouter";
import { useState } from "react";

export default function KanbanBoard() {
  const { toast } = useToast();
  const { user, getDashboardType, getSegment } = useAuth();
  const currentUser = user as any;
  const dashboardType = getDashboardType();
  const segment = getSegment();
  const [, setLocation] = useLocation();
  const { isMobile, isTablet } = useScreenSize();

  // Get terminology based on dashboard type
  const getTaskTerminology = () => {
    switch (dashboardType) {
      case 'project_manager':
        return { singular: 'module', plural: 'modules', title: 'Modules' };
      case 'finance_head':
        return { singular: 'milestone', plural: 'milestones', title: 'Milestones' };
      default:
        return { singular: 'task', plural: 'tasks', title: 'Tasks' };
    }
  };

  const taskTerms = getTaskTerminology();

  // Define status columns with dynamic terminology
  const statusColumns = [
    { 
      id: 'overdue', 
      title: 'Overdue', 
      mobileTitle: 'Overdue',
      color: 'bg-red-50', 
      icon: AlertTriangle 
    },
    { 
      id: 'highPriorityTodo', 
      title: `High Priority ${taskTerms.title}`, 
      mobileTitle: 'Priority',
      color: 'bg-orange-50', 
      icon: Zap 
    },
    { 
      id: 'review', 
      title: 'Client Review', 
      mobileTitle: 'Review',
      color: 'bg-blue-50', 
      icon: Eye 
    },
    { 
      id: 'recentlyDone', 
      title: 'Recently Done', 
      mobileTitle: 'Done',
      color: 'bg-green-50', 
      icon: CheckCircle 
    }
  ];

  // Pagination state for each column
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({
    overdue: 0,
    highPriorityTodo: 0,
    review: 0,
    recentlyDone: 0
  });

  const itemsPerPage = 3;

  // Enhanced kanban task fetching
  const { data: kanbanTasks, isLoading, error } = useQuery<{
    overdue: any[];
    review: any[];
    recentlyDone: any[];
    highPriorityTodo: any[];
  }>({
    queryKey: ['/api/dashboard/kanban-tasks'],
  });



  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const response = await apiRequest("PUT", `/api/tasks/${taskId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kanban-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Success",
        description: `${taskTerms.title.slice(0, -1)} status updated successfully`,
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
        description: `Failed to update ${taskTerms.singular} status`,
        variant: "destructive",
      });
    },
  });

  const handleTaskStatusChange = (taskId: string, newStatus: string) => {
    // Map column IDs to actual database status values
    const statusMapping: Record<string, string> = {
      'overdue': 'todo', // Overdue tasks are typically todo tasks that are past due
      'highPriorityTodo': 'todo',
      'review': 'client_review', // Map review column to client_review status
      'recentlyDone': 'done'
    };
    
    const actualStatus = statusMapping[newStatus] || newStatus;
    updateTaskMutation.mutate({ taskId, status: actualStatus });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const tasksByStatus = statusColumns.reduce((acc, column) => {
    acc[column.id] = kanbanTasks?.[column.id as keyof typeof kanbanTasks] || [];
    return acc;
  }, {} as Record<string, any[]>);



  // Get board title based on user role
  const getBoardTitle = () => {
    switch (dashboardType) {
      case 'project_manager':
        return 'Project Critical Modules';
      case 'finance_head':
        return 'Financial Critical Milestones';
      case 'segment_leader_academic':
        return 'Academic Sector Modules';
      case 'segment_leader_parastals':
        return 'Parastatal Sector Modules';
      case 'segment_leader_private':
        return 'Private Sector Modules';
      case 'employee':
        return 'My Critical Tasks';
      default:
        return 'Critical Task Board';
    }
  };

  // Pagination functions
  const goToNextPage = (columnId: string) => {
    setCurrentPages(prev => ({
      ...prev,
      [columnId]: Math.min(prev[columnId] + 1, Math.ceil((tasksByStatus[columnId]?.length || 0) / itemsPerPage) - 1)
    }));
  };

  const goToPrevPage = (columnId: string) => {
    setCurrentPages(prev => ({
      ...prev,
      [columnId]: Math.max(prev[columnId] - 1, 0)
    }));
  };

  const getPaginatedTasks = (columnId: string) => {
    const tasks = tasksByStatus[columnId] || [];
    const startIndex = currentPages[columnId] * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return tasks.slice(startIndex, endIndex);
  };

  const getTotalPages = (columnId: string) => {
    const tasks = tasksByStatus[columnId] || [];
    return Math.ceil(tasks.length / itemsPerPage);
  };

  if (isLoading) {
    return (
      <Card className="bg-surface shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">{getBoardTitle()}</CardTitle>
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
          <div className="flex items-center space-x-2">
            <CardTitle className="text-lg" data-testid="text-kanban-title">{getBoardTitle()}</CardTitle>
            {currentUser?.role === 'employee' && (
              <Badge variant="outline" className="text-xs">
                {Object.values(tasksByStatus).reduce((total, tasks) => total + tasks.length, 0)} {taskTerms.plural}
              </Badge>
            )}
          </div>
          <div className="flex space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  data-testid="button-kanban-filter"
                  onClick={() => setLocation('/tasks')}
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                 <p>Filter and search all {taskTerms.plural}</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  data-testid="button-kanban-view-all"
                  onClick={() => setLocation('/tasks')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                 <p>View all {taskTerms.plural}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className={isMobile ? 'p-4' : ''}>
        {/* Enhanced scrollable container with full card visibility */}
        <div className="relative">
          {/* Scroll indicator for desktop */}
          {!isMobile && (
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-gradient-to-l from-white via-white/80 to-transparent w-8 h-full pointer-events-none flex items-center justify-end pr-1">
              <ChevronRight className="h-4 w-4 text-gray-400 animate-pulse" />
            </div>
          )}
          
          <div className={`isolate kanban-scroll-container ${isMobile 
            ? 'flex gap-3 overflow-x-auto snap-x pb-2' 
            : 'flex gap-4 overflow-x-auto snap-x pb-2'
          } scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100`}>
          {statusColumns.map((column) => {
            const columnTasks = tasksByStatus[column.id] || [];
            const Icon = column.icon;
            const paginatedTasks = getPaginatedTasks(column.id);
            const totalPages = getTotalPages(column.id);
            const currentPage = currentPages[column.id];
            
            return (
              <div 
                key={column.id} 
                className={`${column.color} rounded-lg ${
                  isMobile 
                    ? 'p-3 min-w-[320px] snap-start flex-shrink-0' 
                    : 'p-5 min-w-[380px] snap-start flex-shrink-0'
                } relative z-0 overflow-visible`}
                data-testid={`kanban-column-${column.id}`}
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center space-x-2">
                    <Icon className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-gray-700`} />
                    <h4 className={`font-medium text-gray-900 ${isMobile ? 'text-sm' : 'text-base'}`} data-testid={`text-column-title-${column.id}`}>
                      {isMobile ? column.mobileTitle : column.title}
                    </h4>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" data-testid={`badge-column-count-${column.id}`}>
                        {columnTasks.length}
                      </Badge>
                    </TooltipTrigger>
                     <TooltipContent>
                       <p>{columnTasks.length} milestones</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <div className={`space-y-${isMobile ? '3' : '4'}`}>
                  {paginatedTasks.map((task: any) => (
                    <Card 
                      key={task.id} 
                      className="bg-surface border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow relative z-[1] hover:z-10"
                      data-testid={`task-card-${task.id}`}
                      onClick={() => setLocation(`/projects/${task.project.id}?task=${task.id}`)}
                    >
                      <CardContent className={`${isMobile ? 'p-3 space-y-2' : 'p-4 sm:p-5 space-y-3'}`}>
                        {/* Project badge */}
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="outline" className={`text-xs flex items-center space-x-1 ${isMobile ? 'max-w-[140px]' : 'max-w-[200px]'} flex-wrap`}>
                            <Briefcase className="h-3 w-3 flex-shrink-0" />
                            <span className="break-words">{task.project?.name || 'No Project'}</span>
                          </Badge>
                          <PriorityBadge priority={task.priority} />
                        </div>
                        
                        <div>
                          <h5 className={`font-medium text-gray-900 ${isMobile ? 'text-sm' : 'text-sm'} mb-2 whitespace-pre-wrap leading-relaxed`} data-testid={`text-task-name-${task.id}`}>
                            {task.name}
                          </h5>
                        </div>
                        
                        {task.description && (
                          <div className="mb-3">
                            <p className={`text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'} whitespace-pre-wrap leading-relaxed`} data-testid={`text-task-description-${task.id}`}>
                              {task.description}
                            </p>
                          </div>
                        )}
                        
                        {task.status === 'in_progress' && (
                          <div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full" 
                                style={{ width: `${Math.random() * 80 + 10}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            {task.assignedUser ? (
                              <>
                                <Avatar className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} border-2 border-white flex-shrink-0`}>
                                  <AvatarImage src={task.assignedUser.profileImageUrl} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(task.assignedUser.firstName && task.assignedUser.lastName 
                                      ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}`
                                      : task.assignedUser.email || 'U'
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-gray-600 truncate">
                                  {isMobile 
                                    ? (task.assignedUser.firstName?.[0] || task.assignedUser.email.split('@')[0].substring(0, 3))
                                    : (task.assignedUser.firstName || task.assignedUser.email.split('@')[0])
                                  }
                                </span>
                              </>
                            ) : (
                              <div className="flex items-center space-x-1 text-xs text-gray-500">
                                <User className="h-3 w-3" />
                                <span>{isMobile ? 'None' : 'Unassigned'}</span>
                              </div>
                            )}
                          </div>
                          
                          {task.dueDate && (
                            <span 
                              className={`text-xs px-2 py-1 rounded ${
                                new Date(task.dueDate) < new Date() && task.status !== 'done'
                                  ? 'bg-red-100 text-red-800 font-medium'
                                  : 'text-gray-500'
                              }`} 
                              data-testid={`text-task-due-${task.id}`}
                            >
                              {new Date(task.dueDate) < new Date() && task.status !== 'done' 
                                ? 'OVERDUE' 
                                : new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              }
                            </span>
                          )}
                        </div>
                        
                        {/* Status control: icons with tooltips */}
                        <div className="pt-1 flex items-center gap-1.5">
                          {statusColumns.map((status) => {
                            // Map column IDs to actual database status values
                            const statusMapping: Record<string, string> = {
                              'overdue': 'todo',
                              'highPriorityTodo': 'todo',
                              'clientReview': 'client_review',
                              'recentlyDone': 'done'
                            };
                            
                            const actualStatus = statusMapping[status.id];
                            const isActive = task.status === actualStatus;
                            
                            // Get the correct icon based on the actual status
                            const Icon = actualStatus === 'todo' ? ClipboardList : 
                                        actualStatus === 'in_progress' ? Zap : 
                                        actualStatus === 'client_review' ? Eye : 
                                        actualStatus === 'done' ? CheckCircle : ClipboardList;
                            
                            // Hide "done" status button for employees
                            if (currentUser?.role === 'employee' && status.id === 'recentlyDone') {
                              return null;
                            }
                            
                            return (
                              <Tooltip key={status.id}>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant={isActive ? 'default' : 'outline'}
                                    className={`h-7 w-7 p-0 ${isActive ? '' : 'text-gray-600'}`}
                                    aria-label={`Move to ${status.title}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isActive) handleTaskStatusChange(task.id, status.id);
                                    }}
                                    disabled={updateTaskMutation.isPending}
                                    data-testid={`button-status-${status.id}-${task.id}`}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Move to {status.title}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {paginatedTasks.length === 0 && (
                    <div className="text-center py-8 text-gray-500" data-testid={`text-empty-column-${column.id}`}>
                      No {column.title.toLowerCase()} {taskTerms.plural}
                    </div>
                  )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => goToPrevPage(column.id)}
                        disabled={currentPage === 0}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-gray-600">
                        {currentPage + 1} of {totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => goToNextPage(column.id)}
                        disabled={currentPage >= totalPages - 1}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronRightIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}