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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PriorityBadge from "@/components/ui/priority-badge";
import { Filter, Search, ExternalLink, Briefcase, ClipboardList, Zap, Eye, CheckCircle, AlertTriangle, ChevronRight, Calendar, User, ChevronLeft, ChevronRight as ChevronRightIcon, List as ListIcon, LayoutGrid as LayoutGridIcon } from "lucide-react";
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

  // View toggle state for modules vs subtasks
  const [viewMode, setViewMode] = useState<'milestones' | 'modules' | 'subtasks'>('modules');
  // Layout toggle state for Kanban vs List
  const [layoutMode, setLayoutMode] = useState<'kanban' | 'list'>('kanban');

  // Get terminology based on dashboard type and view mode
  const getTaskTerminology = () => {
    if (viewMode === 'subtasks') {
      return { singular: 'subtask', plural: 'subtasks', title: 'Subtasks' };
    }
    if (viewMode === 'milestones') {
      return { singular: 'milestone', plural: 'milestones', title: 'Milestones' };
    }
    
    switch (dashboardType) {
      case 'project_manager':
        return { singular: 'module', plural: 'modules', title: 'Modules' };
      case 'finance_head':
        return { singular: 'milestone', plural: 'milestones', title: 'Milestones' };
      default:
        return { singular: 'module', plural: 'modules', title: 'Modules' };
    }
  };

  const taskTerms = getTaskTerminology();

  // Check if user is FC consultant
  const isFCConsultant = currentUser?.role === 'employee' && 
    (currentUser?.assignedConsultantId || currentUser?.assignedDevId);

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
    ...(viewMode === 'subtasks' && isFCConsultant ? [{
      id: 'fcReview',
      title: 'FC Review',
      mobileTitle: 'FC Review',
      color: 'bg-purple-50',
      icon: Eye
    }] : []),
    { 
      id: 'review', 
      title: (viewMode === 'milestones') 
        ? 'Sent' 
        : (viewMode === 'subtasks') 
          ? 'FC Review' 
          : 'Client Review', 
      mobileTitle: 'Review',
      color: 'bg-blue-50', 
      icon: Eye 
    },
    { 
      id: 'recentlyDone', 
      title: viewMode === 'milestones' ? 'Paid' : 'Recently Done', 
      mobileTitle: 'Done',
      color: 'bg-green-50', 
      icon: CheckCircle 
    }
  ];

  // Pagination state for each column
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({
    overdue: 0,
    highPriorityTodo: 0,
    fcReview: 0,
    review: 0,
    recentlyDone: 0
  });

  const itemsPerPage = 3;

  // Fetch milestones/modules/subtasks feeds for the critical board
  const { data: milestonesKanban, isLoading: milestonesLoading } = useQuery<any>({
    queryKey: ['/api/milestones', 'kanban'],
    queryFn: async () => {
      const res = await fetch('/api/milestones', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed milestones');
      return res.json(); // array of milestones
    }
  });
  const { data: modulesKanban, isLoading: modulesLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/kanban-tasks'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/kanban-tasks', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed modules');
      return res.json();
    }
  });
  const { data: subtasksKanban, isLoading: subtasksLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/kanban-subtasks'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/kanban-subtasks', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed subtasks');
      return res.json();
    }
  });

  const isLoading = Boolean(milestonesLoading || modulesLoading || (currentUser?.role === 'employee' && subtasksLoading));

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const endpoint = viewMode === 'subtasks' ? `/api/subtasks/${taskId}` : `/api/tasks/${taskId}`;
      const response = await apiRequest("PUT", endpoint, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kanban-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kanban-subtasks"] });
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

  const updateMilestoneBillingMutation = useMutation({
    mutationFn: async ({ milestoneId, billingStatus }: { milestoneId: string; billingStatus: string }) => {
      const response = await apiRequest('PUT', `/api/milestones/${milestoneId}/billing-status`, { billingStatus });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/milestones'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/kanban-milestones'] });
      toast({ title: 'Success', description: 'Milestone billing status updated' });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: 'Unauthorized', description: 'You are logged out. Logging in again...', variant: 'destructive' });
        setTimeout(() => { window.location.href = '/login'; }, 500);
        return;
      }
      toast({ title: 'Error', description: 'Failed to update milestone status', variant: 'destructive' });
    }
  });

  const handleTaskStatusChange = (taskId: string, newStatus: string) => {
    // Map column IDs to actual database status values
    const statusMapping: Record<string, string> = {
      'overdue': 'todo', // Overdue tasks are typically todo tasks that are past due
      'highPriorityTodo': 'todo',
      'fcReview': 'fc_review', // FC review column
      'review': 'client_review', // Map review column to client_review status
      'recentlyDone': 'done'
    };
    
    const actualStatus = statusMapping[newStatus] || newStatus;
    updateTaskMutation.mutate({ taskId, status: actualStatus });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const mergeColumn = (id: string) => {
    const out: any[] = [];
    if (viewMode === 'milestones') {
      const list: any[] = Array.isArray(milestonesKanban) ? milestonesKanban : [];
      const today = new Date();
      const withinDays = (d?: any, n = 7) => {
        if (!d) return false; const dt = new Date(d); const diff = (dt.getTime() - today.getTime()) / 86400000; return diff >= 0 && diff <= n;
      };
      const filterByColumn = (m: any) => {
        const status = (m.billingStatus || 'none');
        if (id === 'overdue') return status !== 'paid' && m.expectedCollectionDate && new Date(m.expectedCollectionDate) < today;
        if (id === 'highPriorityTodo') return (m.priority === 'high' || m.priority === 'critical') || withinDays(m.endDate, 7);
        if (id === 'review') return status === 'sent' || status === 'processing';
        if (id === 'recentlyDone') return status === 'paid';
        return false;
      };
      out.push(...list.filter(filterByColumn).map(x => ({ ...x, _type: 'milestone' })));
    } else if (viewMode === 'modules') {
      if (modulesKanban?.[id]) {
        const list = modulesKanban[id]
          .filter((x: any) => (x.isMilestone !== true) && (x.billingStatus === undefined) && (x.phaseNumber === 3))
          .map((x: any) => ({ ...x, _type: 'module' }));
        // Strictly exclude subtasks from modules feed
        out.push(...list.filter((x: any) => !x.assignedUser && !x.parentSubtaskId));
      }
    } else if (viewMode === 'subtasks') {
      if (subtasksKanban?.[id]) {
        // Ensure every item is typed as subtask and exclude anything that has billingStatus or isMilestone
        const list = subtasksKanban[id]
          .filter((x: any) => !x.isMilestone && x.billingStatus === undefined)
          .map((x: any) => ({ ...x, _type: 'subtask' }));
        out.push(...list);
      }
    }
    // due date for sort
    return out.sort((a, b) => {
      const ad = a.dueDate || a.expectedCollectionDate || a.expectedInvoiceDate;
      const bd = b.dueDate || b.expectedCollectionDate || b.expectedInvoiceDate;
      const at = ad ? new Date(ad).getTime() : Infinity;
      const bt = bd ? new Date(bd).getTime() : Infinity;
      return at - bt;
    });
  };

  const tasksByStatus = statusColumns.reduce((acc, column) => {
    acc[column.id] = mergeColumn(column.id);
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
            {/* View Toggle for Milestones / Modules / Subtasks */}
            <div className="flex bg-gray-100 rounded-full p-1 border border-gray-200 shadow-inner">
              <Button
                variant={viewMode === 'milestones' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('milestones')}
                className={`text-xs px-3 h-8 rounded-full flex items-center space-x-1 ${viewMode === 'milestones' ? 'bg-primary text-white hover:bg-primary' : 'hover:bg-gray-200'}`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Milestones</span>
              </Button>
              <Button
                variant={viewMode === 'modules' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('modules')}
                className={`text-xs px-3 h-8 rounded-full flex items-center space-x-1 ${viewMode === 'modules' ? 'bg-primary text-white hover:bg-primary' : 'hover:bg-gray-200'}`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Modules</span>
              </Button>
              <Button
                variant={viewMode === 'subtasks' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('subtasks')}
                className={`text-xs px-3 h-8 rounded-full flex items-center space-x-1 ${viewMode === 'subtasks' ? 'bg-primary text-white hover:bg-primary' : 'hover:bg-gray-200'}`}
              >
                <ListIcon className="h-3.5 w-3.5" />
                <span>Subtasks</span>
              </Button>
            </div>
            {/* Layout Toggle for Kanban / List */}
            <div className="flex bg-gray-100 rounded-full p-1 border border-gray-200 shadow-inner">
                <Button 
                variant={layoutMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm" 
                onClick={() => setLayoutMode('kanban')}
                className={`text-xs px-3 h-8 rounded-full flex items-center space-x-1 ${layoutMode === 'kanban' ? 'bg-primary text-white hover:bg-primary' : 'hover:bg-gray-200'}`}
                >
                <LayoutGridIcon className="h-3.5 w-3.5" />
                <span>Kanban</span>
                </Button>
                <Button 
                variant={layoutMode === 'list' ? 'default' : 'ghost'}
                  size="sm" 
                onClick={() => setLayoutMode('list')}
                className={`text-xs px-3 h-8 rounded-full flex items-center space-x-1 ${layoutMode === 'list' ? 'bg-primary text-white hover:bg-primary' : 'hover:bg-gray-200'}`}
                >
                <ListIcon className="h-3.5 w-3.5" />
                <span>List</span>
                </Button>
            </div>
            
            {/* Removed filter and view-all buttons */}
          </div>
        </div>
      </CardHeader>
      <CardContent className={isMobile ? 'p-4' : ''}>
        {layoutMode === 'kanban' ? (
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
                        {/* Project and Module hierarchy */}
                        <div className="space-y-1 mb-3">
                          {/* Project */}
                          <div className="flex items-center space-x-1 text-xs text-blue-600">
                            <Briefcase className="h-3 w-3 flex-shrink-0" />
                            <span className="font-medium truncate">{task.project?.name || 'No Project'}</span>
                          </div>
                          
                          {/* Module (for subtasks) */}
                          {viewMode === 'subtasks' && task.module && (
                            <div className="flex items-center space-x-1 text-xs text-green-600 ml-2">
                              <ClipboardList className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{task.module.name}</span>
                            </div>
                          )}
                          
                          {/* Task/Subtask */}
                          <div className="flex items-center space-x-1 text-xs text-gray-700 ml-2">
                            <span className="font-medium truncate">{task.name}</span>
                              {task.phaseNumber && (
                                <Badge variant="outline" className="ml-2 text-[10px]">Phase {task.phaseNumber}</Badge>
                              )}
                            </div>
                        </div>
                        
                        <div className="flex items-start justify-between mb-2">
                          <PriorityBadge priority={task.priority} />
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
                              {task._type === 'subtask' ? (
                                task.assignedUser ? (
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
                                )
                              ) : (
                                task._type === 'module' && (
                                  <span className="text-xs text-gray-600 truncate">
                                    Start: {task.startDate ? new Date(task.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} · End: {(task.dueDate || task.endDate) ? new Date(task.dueDate || task.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                  </span>
                                )
                            )}
                          </div>
                          
                            {/* Removed single-date badge beside Start/End to avoid duplication */}
                          </div>
                          {task._type === 'subtask' && (
                            <div className="mt-1 text-[11px] text-gray-500">
                              {(() => {
                                const today = new Date();
                                const end = task.dueDate ? new Date(task.dueDate) : null;
                                const isOverdue = end ? end.getTime() < today.getTime() : false;
                                const isSoon = end ? (end.getTime() - today.getTime()) / 86400000 <= 7 && (end.getTime() - today.getTime()) > 0 : false;
                                const endCls = isOverdue ? 'text-red-600' : isSoon ? 'text-orange-600' : 'text-gray-500';
                                return (
                                  <>
                                    Start: {task.startDate ? new Date(task.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} · <span className={endCls}>End: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                          {task._type === 'milestone' && (
                            <div className="mt-2">
                              {(() => {
                                const pct = Math.max(0, Math.min(100, Math.round(Number(task.progress || 0))));
                                const today = new Date();
                                const end = task.endDate ? new Date(task.endDate) : null;
                                const isOverdue = end ? end.getTime() < today.getTime() : false;
                                const isSoon = end ? (end.getTime() - today.getTime()) / 86400000 <= 7 && (end.getTime() - today.getTime()) > 0 : false;
                                const endCls = isOverdue ? 'text-red-600' : isSoon ? 'text-orange-600' : 'text-gray-500';
                                return (
                                  <>
                                    <div className="text-[11px] text-gray-500">Start: {task.startDate ? new Date(task.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} · <span className={endCls}>End: {(task.dueDate || task.endDate) ? new Date(task.dueDate || task.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span></div>
                                    <Progress value={pct} className="h-1 mt-1" />
                                    <div className="text-[11px] text-gray-500 mt-1">Progress: {pct}%</div>
                                  </>
                                );
                              })()}
                        </div>
                          )}
                        
                        {/* Status control: dropdown */}
                        <div className="pt-1">
                            {task._type === 'milestone' ? (
                              <Select
                                value={task.billingStatus || 'none'}
                                disabled={updateMilestoneBillingMutation.isPending}
                                onValueChange={(value) => updateMilestoneBillingMutation.mutate({ milestoneId: task.id, billingStatus: value })}
                              >
                                <SelectTrigger className={`w-full h-8 text-xs ${updateMilestoneBillingMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                  {updateMilestoneBillingMutation.isPending ? (
                                    <div className="flex items-center">
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                                      <span className="text-xs text-gray-500">Processing...</span>
                                    </div>
                                  ) : (
                                    <SelectValue />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Not Sent</SelectItem>
                                  <SelectItem value="to_send">To Send</SelectItem>
                                  <SelectItem value="sent">Invoice Sent</SelectItem>
                                  <SelectItem value="processing">Processing</SelectItem>
                                  <SelectItem value="paid">Paid</SelectItem>
                                  <SelectItem value="overdue">Overdue</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                          <Select
                            value={task.status}
                            disabled={updateTaskMutation.isPending}
                            onValueChange={(value) => {
                              handleTaskStatusChange(task.id, value);
                            }}
                          >
                            <SelectTrigger className={`w-full h-8 text-xs ${
                              updateTaskMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''
                            } ${
                              task.status === 'completed' ? 'bg-green-50 border-green-200' : 
                              task.status === 'client_review' || task.status === 'fc_review' ? 'bg-yellow-50 border-yellow-200' : 
                              task.status === 'in_progress' ? 'bg-blue-50 border-blue-200' : 
                              'bg-gray-50 border-gray-200'
                            }`}>
                              {updateTaskMutation.isPending ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                                  <span className="text-xs text-gray-500">Processing...</span>
                                </div>
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                                                <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="fc_review">FC Review</SelectItem>
                      {viewMode === 'modules' && (
                        <>
                          <SelectItem value="qa">QA</SelectItem>
                          <SelectItem value="client_review">Client Review</SelectItem>
                        </>
                      )}
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                          </Select>
                            )}
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
        ) : (
          <div className="w-full">
            {(() => {
              const orderedIds = statusColumns.map(c => c.id);
              // Flatten with type guards and dedupe by id+_type to prevent repeats when items appear in multiple columns
              const flatRaw: any[] = orderedIds.flatMap(id => tasksByStatus[id] || []);
              const flatFiltered = flatRaw.filter((x: any) => {
                if (viewMode === 'milestones') return x._type === 'milestone';
                if (viewMode === 'modules') return x._type === 'module';
                return x._type === 'subtask';
              });
              const seen = new Set<string>();
              const flat = flatFiltered.filter((x: any) => {
                const key = `${x._type}:${x.id}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
              if (flat.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500" data-testid="text-empty-list">
                    No {taskTerms.plural} to display
                  </div>
                );
              }
              return (
                <div className="space-y-2">
                  {flat.map((task: any) => (
                    <div key={task.id} className="flex items-start justify-between bg-white border border-gray-200 rounded-md px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={() => setLocation(`/projects/${task.project.id}?task=${task.id}`)}>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2 text-xs text-blue-600">
                          <Briefcase className="h-3 w-3" />
                          <span className="font-medium truncate max-w-[260px]">{task.project?.name || 'No Project'}</span>
                        </div>
                        {viewMode === 'subtasks' && task.module && (
                          <div className="flex items-center space-x-2 text-[11px] text-green-700 ml-5 mt-0.5">
                            <ClipboardList className="h-3 w-3" />
                            <span className="truncate max-w-[260px]">{task.module.name}</span>
                          </div>
                        )}
                        <div className="text-sm text-gray-900 ml-5 mt-0.5 truncate max-w-[420px]">{task.name} {task.phaseNumber && (<Badge variant="outline" className="ml-2 text-[10px]">Phase {task.phaseNumber}</Badge>)}</div>
                        {task._type === 'subtask' && (
                          <div className="mt-1 text-[11px] text-gray-500 ml-5">
                            {(() => {
                              const today = new Date();
                              const end = task.dueDate ? new Date(task.dueDate) : null;
                              const isOverdue = end ? end.getTime() < today.getTime() : false;
                              const isSoon = end ? (end.getTime() - today.getTime()) / 86400000 <= 7 && (end.getTime() - today.getTime()) > 0 : false;
                              const endCls = isOverdue ? 'text-red-600' : isSoon ? 'text-orange-600' : 'text-gray-500';
                              return (
                                <>
                                  Start: {task.startDate ? new Date(task.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} · <span className={endCls}>End: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {(task._type === 'milestone' || task._type === 'module') && (
                          <div className="mt-1 text-[11px] text-gray-500 ml-5">
                            {(() => {
                              const today = new Date();
                              const end = (task.dueDate || task.endDate) ? new Date(task.dueDate || task.endDate) : null;
                              const isOverdue = end ? end.getTime() < today.getTime() : false;
                              const isSoon = end ? (end.getTime() - today.getTime()) / 86400000 <= 7 && (end.getTime() - today.getTime()) > 0 : false;
                              const endCls = isOverdue ? 'text-red-600' : isSoon ? 'text-orange-600' : 'text-gray-500';
                              return (
                                <>
                                  Start: {task.startDate ? new Date(task.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} · <span className={endCls}>End: {(task.dueDate || task.endDate) ? new Date(task.dueDate || task.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {task._type === 'milestone' && (
                          <div className="mt-1 ml-5">
                            {(() => {
                              const pct = Math.max(0, Math.min(100, Math.round(Number(task.progress || 0))));
                              return (
                                <>
                                  <Progress value={pct} className="h-1" />
                                  <div className="text-[11px] text-gray-500 mt-1">Progress: {pct}%</div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        {task._type === 'subtask' && (
                          task.assignedUser ? (
                            <div className="flex items-center space-x-1">
                              <Avatar className="w-6 h-6 border-2 border-white">
                                <AvatarImage src={task.assignedUser.profileImageUrl} />
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(task.assignedUser.firstName && task.assignedUser.lastName 
                                    ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}`
                                    : task.assignedUser.email || 'U'
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-gray-700">
                                {task.assignedUser.firstName || task.assignedUser.email?.split('@')[0]}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              <User className="h-3 w-3" />
                              <span>Unassigned</span>
                            </div>
                          )
                        )}
                        <div className="min-w-[140px]">
                          {task._type === 'milestone' ? (
                            <Select
                              value={task.billingStatus || 'none'}
                              disabled={updateMilestoneBillingMutation.isPending}
                              onValueChange={(value) => updateMilestoneBillingMutation.mutate({ milestoneId: task.id, billingStatus: value })}
                            >
                              <SelectTrigger className={`h-8 text-xs ${updateMilestoneBillingMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Not Sent</SelectItem>
                                <SelectItem value="to_send">To Send</SelectItem>
                                <SelectItem value="sent">Invoice Sent</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Select
                              value={task.status}
                              disabled={updateTaskMutation.isPending}
                              onValueChange={(value) => handleTaskStatusChange(task.id, value === 'qa' && viewMode === 'modules' ? 'client_review' : value)}
                            >
                              <SelectTrigger className={`h-8 text-xs ${updateTaskMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not_started">Not Started</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="fc_review">FC Review</SelectItem>
                                {viewMode === 'modules' && (
                                  <>
                                    <SelectItem value="qa">QA</SelectItem>
                                    <SelectItem value="client_review">Client Review</SelectItem>
                                  </>
                                )}
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="on_hold">On Hold</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <PriorityBadge priority={task.priority} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}