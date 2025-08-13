import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/layout/navigation";
import CreateProjectModal from "@/components/projects/create-project-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Calendar, Users, DollarSign, MoreHorizontal } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Projects() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: projects = [], isLoading: projectsLoading, error } = useQuery({
    queryKey: ['/api/projects'],
    enabled: !!isAuthenticated,
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
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
            <CreateProjectModal />
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
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2" data-testid="text-no-projects">No projects yet</h3>
              <p className="text-gray-600 mb-4">Create your first project to get started</p>
              <CreateProjectModal />
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project: any) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow" data-testid={`card-project-${project.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2" data-testid={`text-project-name-${project.id}`}>
                        {project.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-2" data-testid={`text-project-description-${project.id}`}>
                        {project.description}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" data-testid={`button-project-menu-${project.id}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
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
                          <span>${parseFloat(project.budget).toLocaleString()}</span>
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
