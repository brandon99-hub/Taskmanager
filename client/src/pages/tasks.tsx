import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import Navigation from "@/components/layout/navigation";
import TaskCard from "@/components/tasks/task-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Plus, X } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Tasks() {
  const auth = useAuth() as any;
  const { isAuthenticated, isLoading, user } = auth;
  const { toast } = useToast();
  const searchParams = useSearch();
  const [, setLocation] = useLocation();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  // Get project filter from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(searchParams);
    const projectParam = urlParams.get('project');
    if (projectParam) {
      setProjectFilter(projectParam);
    }
  }, [searchParams]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  // Add view mode: milestones | modules | subtasks
  const [viewMode, setViewMode] = useState<'milestones' | 'modules' | 'subtasks'>('milestones');

  const { data: tasks = [], isLoading: tasksLoading, error } = useQuery<any[]>({
    queryKey: ['/api/tasks', viewMode],
    enabled: !!isAuthenticated,
    queryFn: async () => {
      if (viewMode === 'milestones') {
        const res = await fetch('/api/milestones', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch milestones');
        const data = await res.json();
        return Array.isArray(data) ? data.map((m: any) => ({ ...m, type: 'milestone' })) : [];
      }
      if (viewMode === 'modules') {
        const res = await fetch('/api/tasks', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch modules');
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        // Only show Phase 3 modules
        return list.filter((m: any) => m.phaseNumber === 3).map((m: any) => ({ ...m, type: 'module' }));
      }
      // subtasks view: flatten kanban subtasks groups
      const res = await fetch('/api/dashboard/kanban-subtasks', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch subtasks');
      const grouped = await res.json();
      const keys = ['overdue', 'review', 'recentlyDone', 'highPriorityTodo', 'fcReview'];
      const flat: any[] = [];
      for (const k of keys) {
        const arr = Array.isArray(grouped?.[k]) ? grouped[k] : [];
        for (const item of arr) flat.push({ ...item, type: 'subtask' });
      }
      return flat;
    }
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['/api/projects'],
    enabled: !!isAuthenticated,
  });

  // Role-based task filtering
  const roleFilteredTasks = tasks.filter((task: any) => {
    if (user?.role === 'employee') {
      return task.assignedUserId === user.id;
    }
    return true;
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [error, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Filter tasks based on search and filters
  const filteredTasks = roleFilteredTasks.filter((task: any) => {
    const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.project?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || task.status === statusFilter || (viewMode === 'milestones' && (task.billingStatus === statusFilter));
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    const matchesProject = projectFilter === "all" 
      || task.projectId === projectFilter 
      || task.project?.id === projectFilter 
      || task.module?.projectId === projectFilter;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesProject;
  });

  // Get active filters count
  const activeFiltersCount = [
    searchTerm && searchTerm.length > 0,
    statusFilter !== "all",
    priorityFilter !== "all", 
    projectFilter !== "all"
  ].filter(Boolean).length;

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setProjectFilter("all");
    setLocation('/tasks');
  };

  // Group items based on view mode
  const tasksByStatus = viewMode === 'milestones' ? {
    none: filteredTasks.filter((m: any) => (m.billingStatus || 'none') === 'none'),
    to_send: filteredTasks.filter((m: any) => (m.billingStatus || 'none') === 'to_send'),
    sent: filteredTasks.filter((m: any) => (m.billingStatus || 'none') === 'sent'),
    paid: filteredTasks.filter((m: any) => (m.billingStatus || 'none') === 'paid'),
  } : viewMode === 'subtasks' ? {
    todo: filteredTasks.filter((task: any) => task.status === 'todo' || task.status === 'not_started'),
    in_progress: filteredTasks.filter((task: any) => task.status === 'in_progress' || task.status === 'ongoing'),
    fc_review: filteredTasks.filter((task: any) => task.status === 'fc_review'),
    done: filteredTasks.filter((task: any) => task.status === 'completed' || task.status === 'finished' || task.status === 'done'),
  } : {
    todo: filteredTasks.filter((task: any) => task.status === 'todo' || task.status === 'not_started'),
    in_progress: filteredTasks.filter((task: any) => task.status === 'in_progress' || task.status === 'ongoing'),
    client_review: filteredTasks.filter((task: any) => task.status === 'client_review' || task.status === 'qa'),
    done: filteredTasks.filter((task: any) => task.status === 'done' || task.status === 'finished' || task.status === 'completed'),
  };

  const getStatusTitle = (status: string) => {
    if (viewMode === 'milestones') {
      switch (status) {
        case 'to_send': return 'To Invoice';
        case 'sent': return 'Invoice Sent';
        case 'paid': return 'Paid';
        case 'none': return 'Not Invoiced';
        default: return status;
      }
    }
    if (viewMode === 'subtasks') {
      switch (status) {
        case 'todo': return 'Not Started';
        case 'in_progress': return 'In Progress';
        case 'fc_review': return 'FC Review';
        case 'done': return 'Completed';
        default: return status;
      }
    }
    switch (status) {
      case 'todo': return 'Not Started';
      case 'in_progress': return 'In Progress';
      case 'client_review': return 'Client Review';
      case 'done': return 'Done';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    if (viewMode === 'milestones') {
      switch (status) {
        case 'to_send': return 'bg-orange-50';
        case 'sent': return 'bg-indigo-50';
        case 'paid': return 'bg-green-50';
        case 'none': return 'bg-gray-100';
        default: return 'bg-gray-100';
      }
    }
    if (viewMode === 'subtasks') {
      switch (status) {
        case 'todo': return 'bg-gray-100';
        case 'in_progress': return 'bg-blue-50';
        case 'fc_review': return 'bg-yellow-50';
        case 'done': return 'bg-green-50';
        default: return 'bg-gray-100';
      }
    }
    switch (status) {
      case 'todo': return 'bg-gray-100';
      case 'in_progress': return 'bg-blue-50';
      case 'client_review': return 'bg-yellow-50';
      case 'done': return 'bg-green-50';
      default: return 'bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-background-page">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sm:mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-medium text-gray-900 mb-1 sm:mb-2" data-testid="text-title">
              {viewMode === 'milestones' ? (user?.role === 'employee' ? 'My Milestones' : 'All Milestones') : viewMode === 'modules' ? 'Modules' : 'Subtasks'}
            </h2>
            <p className="text-gray-600 text-sm sm:text-base" data-testid="text-subtitle">
              {user?.role === 'employee' 
                 ? 'Track and manage your assigned milestones' 
                : 'Track and manage all team milestones'
              }
            </p>
          </div>
          {activeFiltersCount > 0 && (
            <Button 
              variant="outline" 
              onClick={clearFilters}
              className="flex items-center space-x-2"
            >
              <X className="h-4 w-4" />
              <span>Clear Filters ({activeFiltersCount})</span>
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6 sm:mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filters & Search</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant={viewMode === 'milestones' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('milestones')}>Milestones</Button>
                <Button variant={viewMode === 'modules' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('modules')}>Modules</Button>
                <Button variant={viewMode === 'subtasks' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('subtasks')}>Subtasks</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                                          <SelectItem value="todo">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                                          <SelectItem value="client_review">Client Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger data-testid="select-priority">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex flex-col space-y-2 lg:space-y-0">
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger data-testid="select-project">
                    <SelectValue placeholder="Filter by project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map((project: any) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="flex items-center justify-between">
                  <Badge variant="outline" data-testid="badge-task-count">
                    {filteredTasks.length} {viewMode === 'milestones' ? 'milestones' : viewMode}
                  </Badge>
                  {projectFilter !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      Project filtered
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Milestones Content */}
        {tasksLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-full"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-12 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2" data-testid="text-no-tasks">No milestones yet</h3>
              <p className="text-gray-600 mb-4">Milestones will appear here once they are assigned to you</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
              <div key={status} className={`rounded-lg p-4 ${getStatusColor(status)} min-h-[200px]`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900" data-testid={`text-status-${status}`}>
                    {getStatusTitle(status)}
                  </h3>
                  <Badge variant="secondary" data-testid={`badge-count-${status}`}>
                    {statusTasks.length}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {statusTasks.map((task: any) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  
                  {statusTasks.length === 0 && (
                    <div className="text-center py-8 text-gray-500" data-testid={`text-empty-${status}`}>
                      No {getStatusTitle(status).toLowerCase()} milestones
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
