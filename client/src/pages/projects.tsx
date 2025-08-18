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
import { Calendar, Users, DollarSign, MoreHorizontal, ExternalLink, AlertTriangle, Search, Filter } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p: any) => (
      (p.name || "").toLowerCase().includes(q) ||
      (p.client || "").toLowerCase().includes(q)
    ));
  }, [projects, query]);

  // Pagination logic
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProjects = filteredProjects.slice(startIndex, endIndex);

  // Reset to first page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

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

  const handleDeleteProject = async (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Delete project "${project.name}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await apiRequest('DELETE', `/api/projects/${project.id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      toast({ title: 'Project deleted', description: `${project.name} was removed.` });
    } catch (error: any) {
      if (isUnauthorizedError(error)) {
        toast({ title: 'Unauthorized', description: 'You are logged out. Logging in again...', variant: 'destructive' });
        setTimeout(() => { window.location.href = '/login'; }, 500);
        return;
      }
      toast({ title: 'Failed to delete', description: error?.message || 'Unknown error', variant: 'destructive' });
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

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search projects by name or client..."
            />
          </div>
        </div>

        {/* Projects Grid */}
        {projectsLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-2 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2" data-testid="text-no-projects">No projects found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search</p>
            </CardContent>
          </Card>
        ) : (
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
                              onClick={(e) => handleDeleteProject(e, project)}
                              data-testid={`button-project-delete-${project.id}`}
                            >
                              Delete
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
                        <Badge className={getStatusColor(project.status)} data-testid={`badge-project-status-${project.id}`}>
                          {formatStatus(project.status)}
                        </Badge>
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
                        <div className="flex items-center justify-between pt-2 text-xs text-gray-700">
                          <span data-testid={`text-project-milestones-${project.id}`}>
                            {completedMilestoneCount}/{milestoneCount} milestones done ({completionRate}%)
                          </span>
                          <span className="font-medium text-green-600" data-testid={`text-project-paid-amount-${project.id}`}>
                            KSh {(project.paidAmount || 0).toLocaleString()} paid
                          </span>
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
