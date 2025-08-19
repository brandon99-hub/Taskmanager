import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useScreenSize } from "@/hooks/use-mobile";
import Navigation from "@/components/layout/navigation";
import CreateProjectModal from "@/components/projects/create-project-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Users, DollarSign, MoreHorizontal, ExternalLink, AlertTriangle, Search, Filter, Grid3X3, Table } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Projects() {
  const auth = useAuth() as any;
  const { isAuthenticated, isLoading, user } = auth;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isMobile, isTablet } = useScreenSize();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 18; // 6 cards per column × 3 columns

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

  const { data: projects = [], isLoading: projectsLoading, error } = useQuery<any[]>({
    queryKey: ['/api/projects'],
    enabled: !!isAuthenticated,
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  
  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    // Apply search query filter
    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((p: any) => (
        (p.name || "").toLowerCase().includes(q) ||
        (p.client || "").toLowerCase().includes(q)
      ));
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((p: any) => p.status === statusFilter);
    }
    
    // Apply segment filter
    if (segmentFilter !== "all") {
      filtered = filtered.filter((p: any) => p.segment === segmentFilter);
    }
    
    return filtered;
  }, [projects, query, statusFilter, segmentFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProjects = filteredProjects.slice(startIndex, endIndex);

  // Reset to first page when search query or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, segmentFilter]);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const { data: overdueTasks = [] } = useQuery<any[]>({
    queryKey: ['/api/dashboard/overdue-tasks'],
    enabled: !!isAuthenticated,
  });

  // Get overdue tasks count for each project
  const getProjectOverdueCount = (projectId: string) => {
    return overdueTasks.filter((task: any) => task.projectId === projectId).length;
  };

  const handleTerminateProject = async (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Terminate project "${project.name}"? This will mark the project as terminated.`);
    if (!confirmed) return;
    try {
      await apiRequest('PUT', `/api/projects/${project.id}/terminate`);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      toast({ title: 'Project terminated', description: `${project.name} has been terminated.` });
    } catch (error: any) {
      if (isUnauthorizedError(error)) {
        toast({ title: 'Unauthorized', description: 'You are logged out. Logging in again...', variant: 'destructive' });
        setTimeout(() => { window.location.href = '/login'; }, 500);
        return;
      }
      toast({ title: 'Failed to terminate', description: error?.message || 'Unknown error', variant: 'destructive' });
    }
  };

  const handleProjectClick = (projectId: string) => {
    // Navigate to dedicated project detail page
    setLocation(`/projects/${projectId}`);
  };

  const [editingProject, setEditingProject] = useState<any>(null);

  const handleEditProject = (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    setEditingProject(project);
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'planning': return 'bg-warning text-warning-foreground';
      case 'completed': return 'bg-primary text-primary-foreground';
      case 'on_hold': return 'bg-error text-error-foreground';
      case 'cancelled': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="min-h-screen bg-background-page">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h2 className="text-3xl font-medium text-gray-900 mb-2" data-testid="text-title">Projects</h2>
            <p className="text-gray-600" data-testid="text-subtitle">Manage and track all your active projects</p>
          </div>
          <div className="flex space-x-3 mt-4 md:mt-0">
            {/* Mount modal so it can open from global event as well */}
            <CreateProjectModal />
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* View Toggle and Project Count Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">View:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    viewMode === "grid" 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                  Grid
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    viewMode === "table" 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Table className="h-4 w-4" />
                  Table
                </button>
              </div>
            </div>
            
            {/* Project Count */}
            <div className="text-sm text-gray-600">
              {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} found
            </div>
          </div>
          
          {/* Filters Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters & Search</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search projects..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
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
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex flex-col space-y-2 lg:space-y-0">
                  <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                    <SelectTrigger data-testid="select-segment">
                      <SelectValue placeholder="Filter by segment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Segments</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="parastals">Parastals</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" data-testid="badge-project-count">
                      {filteredProjects.length} projects
                    </Badge>
                    {(statusFilter !== "all" || segmentFilter !== "all") && (
                      <Badge variant="secondary" className="text-xs">
                        Filtered
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Display */}
        {projectsLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2" data-testid="text-no-projects">No projects found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
            </CardContent>
          </Card>
        ) : viewMode === "table" ? (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Segment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Milestones</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentProjects.map((project: any) => {
                  const milestoneCount = project.milestoneCount || 0;
                  const completedMilestoneCount = project.completedMilestoneCount || 0;
                  const completionRate = milestoneCount > 0 ? Math.round((completedMilestoneCount / milestoneCount) * 100) : 0;
                  
                  return (
                    <Tooltip key={project.id}>
                      <TooltipTrigger asChild>
                        <tr 
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setLocation(`/projects/${project.id}`)}
                        >
                      <td className="px-4 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{project.name}</div>
                          <div className="text-sm text-gray-500">{project.description}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className="capitalize">
                          {project.segment || 'private'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={getStatusColor(project.status)}>
                          {formatStatus(project.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Progress value={project.progress} className="h-2 w-16" />
                          <span className="text-sm text-gray-600">{project.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {project.client || 'N/A'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {project.budget ? `KSh ${parseFloat(project.budget).toLocaleString()}` : 'N/A'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        KSh {(project.paidAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {completedMilestoneCount}/{milestoneCount} ({completionRate}%)
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <div>
                          <div>{new Date(project.startDate).toLocaleDateString()}</div>
                          <div className="text-gray-500">{new Date(project.endDate).toLocaleDateString()}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/projects/${project.id}`);
                            }}
                          >
                            View
                          </Button>
                          {['admin', 'manager'].includes(user?.role) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleTerminateProject(e, project)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Terminate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="top" 
                        align="start"
                        className="max-w-md p-4"
                        sideOffset={5}
                      >
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-1">{project.name}</h4>
                            <p className="text-sm text-gray-600 line-clamp-3">{project.description}</p>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-gray-500" />
                              <span className="text-gray-700">
                                <span className="font-medium">Manager:</span> {project.manager?.firstName || project.manager?.email}
                              </span>
                            </div>
                            
                            {project.team && (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-700">
                                  <span className="font-medium">Team:</span> {project.team.name} ({project.team.segment})
                                </span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-gray-500" />
                              <span className="text-gray-700">
                                <span className="font-medium">Financial:</span> Budget KSh {(project.budget || 0).toLocaleString()} | Paid KSh {(project.paidAmount || 0).toLocaleString()} | Outstanding KSh {(parseFloat(project.budget || '0') - (project.paidAmount || 0)).toLocaleString()}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span className="text-gray-700">
                                <span className="font-medium">Milestones:</span> {completedMilestoneCount}/{milestoneCount} ({completionRate}%)
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span className="text-gray-700">
                                <span className="font-medium">Timeline:</span> {new Date(project.startDate).toLocaleDateString()} to {new Date(project.endDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentProjects.map((project: any) => {
              const overdueCount = getProjectOverdueCount(project.id);
              const milestoneCount = project.milestoneCount ?? 0;
              const completedMilestoneCount = project.completedMilestoneCount ?? 0;
              const completionRate = milestoneCount > 0 ? Math.round((completedMilestoneCount / milestoneCount) * 100) : project.progress;
              return (
                <Card 
                  key={project.id} 
                  className="hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-primary" 
                  data-testid={`card-project-${project.id}`}
                  onClick={() => handleProjectClick(project.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <CardTitle className="text-lg" data-testid={`text-project-name-${project.id}`}>
                            {project.name}
                          </CardTitle>
                          {overdueCount > 0 && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="destructive" className="flex items-center space-x-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>{overdueCount}</span>
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{overdueCount} overdue task{overdueCount > 1 ? 's' : ''}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <CardDescription className="line-clamp-2" data-testid={`text-project-description-${project.id}`}>
                          {project.description}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProjectClick(project.id);
                              }}
                              data-testid={`button-project-view-${project.id}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View project details</p>
                          </TooltipContent>
                        </Tooltip>
                        {(user as any)?.role !== 'employee' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => handleEditProject(e, project)}
                              data-testid={`button-project-edit-${project.id}`}
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => handleTerminateProject(e, project)}
                              data-testid={`button-project-terminate-${project.id}`}
                            >
                              Terminate
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(project.status)} data-testid={`badge-project-status-${project.id}`}>
                            {formatStatus(project.status)}
                          </Badge>
                          <Badge variant="outline" className="capitalize" data-testid={`badge-project-segment-${project.id}`}>
                            {project.segment || 'private'}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500" data-testid={`text-project-progress-${project.id}`}>
                          {project.progress}% Complete
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <Progress value={project.progress} className="h-2" data-testid={`progress-project-${project.id}`} />

                      {/* Project Details */}
                      <div className="space-y-2 text-sm text-gray-600">
                        {project.client && (
                          <div className="flex items-center" data-testid={`text-project-client-${project.id}`}>
                            <Users className="h-4 w-4 mr-2" />
                            <span>{project.client}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center" data-testid={`text-project-dates-${project.id}`}>
                          <Calendar className="h-4 w-4 mr-2" />
                          <span>
                            {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                          </span>
                        </div>

                        {project.budget && (
                          <div className="flex items-center" data-testid={`text-project-budget-${project.id}`}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            <span>KSh {parseFloat(project.budget).toLocaleString()}</span>
                          </div>
                        )}

                        <div className="flex items-center" data-testid={`text-project-manager-${project.id}`}>
                          <Users className="h-4 w-4 mr-2" />
                          <span>Manager: {project.manager?.firstName || project.manager?.email}</span>
                        </div>

                        {project.team && (
                          <div className="flex items-center" data-testid={`text-project-team-${project.id}`}>
                            <Users className="h-4 w-4 mr-2" />
                            <span>Team: {project.team.name}</span>
                          </div>
                        )}
                        
                        {/* Financial Summary */}
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex items-center justify-between text-xs text-gray-700 mb-1">
                            <span data-testid={`text-project-milestones-${project.id}`}>
                              {completedMilestoneCount}/{milestoneCount} milestones done ({completionRate}%)
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-green-600" data-testid={`text-project-paid-amount-${project.id}`}>
                              KSh {(project.paidAmount || 0).toLocaleString()} paid
                            </span>
                          </div>
                          {project.budget && (
                            <div className="flex items-center justify-between text-xs mt-1">
                              <span className="text-gray-600">
                                Outstanding: KSh {(parseFloat(project.budget || '0') - (project.paidAmount || 0)).toLocaleString()}
                              </span>
                              <span className={`font-medium ${(project.paidAmount || 0) >= parseFloat(project.budget || '0') ? 'text-green-600' : 'text-orange-600'}`}>
                                {Math.round(((project.paidAmount || 0) / parseFloat(project.budget || '1')) * 100)}% funded
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-8 space-x-4">
            <Button
              variant="outline"
              onClick={goToPrevPage}
              disabled={currentPage === 1}
              className="px-4 py-2"
            >
              Previous
            </Button>
            
            <div className="flex items-center space-x-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    onClick={() => goToPage(pageNum)}
                    className="w-10 h-10 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="px-4 py-2"
            >
              Next
            </Button>
          </div>
        )}
        
        {/* Edit Project Modal */}
        {editingProject && (
          <CreateProjectModal 
            project={editingProject} 
            key={`edit-${editingProject.id}`}
            onClose={() => setEditingProject(null)}
          />
        )}
      </div>
    </div>
  );
}
