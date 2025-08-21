import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import Navigation from "@/components/layout/navigation";
import CreateProjectModal from "@/components/projects/create-project-modal";
import MilestoneTable from "@/components/projects/milestone-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Calendar, 
  Users, 
  DollarSign, 
  ArrowLeft, 
  Edit,
  Trash2,
  CheckCircle
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function ProjectDetail() {
  const auth = useAuth() as any;
  const { isAuthenticated, isLoading, user } = auth;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = params.id;

  const [editingProject, setEditingProject] = useState<any>(null);

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

  const { data: project, isLoading: projectLoading, error } = useQuery<any>({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { 
        credentials: 'include', 
        cache: 'no-store' 
      });
      if (!res.ok) throw new Error('Failed to fetch project');
      return res.json();
    },
    enabled: !!isAuthenticated && !!projectId,
  });

  const { data: milestones = [], isLoading: milestonesLoading } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'tasks'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tasks`, { 
        credentials: 'include', 
        cache: 'no-store' 
      });
      if (!res.ok) throw new Error('Failed to fetch milestones');
      return res.json();
    },
    enabled: !!isAuthenticated && !!projectId,
  });

  // Fetch segment leader based on project segment
  const { data: segmentLeader } = useQuery<any>({
    queryKey: ['/api/segment-leaders', project?.segment],
    queryFn: async () => {
      if (!project?.segment) return null;
      const res = await fetch(`/api/segment-leaders/${project.segment}`, { 
        credentials: 'include' 
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!isAuthenticated && !!project?.segment,
  });

  const handleDeactivateProject = async () => {
    if (!project) return;
    
    const confirmed = window.confirm(`Deactivate project "${project.name}"? This will mark the project as inactive.`);
    if (!confirmed) return;
    
    try {
      await apiRequest('PUT', `/api/projects/${project.id}/terminate`);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      
      toast({ title: 'Project deactivated', description: `${project.name} has been deactivated.` });
    } catch (error: any) {
      console.error('Error deactivating project:', error);
      toast({ title: 'Failed to deactivate', description: error?.message || 'Unknown error', variant: 'destructive' });
    }
  };

  const handleEditMilestone = (milestone: any) => {
    // For now, we'll use the existing CreateProjectModal to edit milestones
    // This can be enhanced later with a dedicated milestone edit modal
    setEditingProject({ ...project, milestoneToEdit: milestone });
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

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-background-page">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background-page">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Project not found</h2>
            <Button onClick={() => setLocation('/projects')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </div>
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Calculate financial metrics
  const totalProjectValue = parseFloat(project.budget || '0');
  const paidAmount = milestones
    .filter((m: any) => m.billingStatus === 'sent') // Changed from 'paid' to 'sent'
    .reduce((sum: number, m: any) => sum + parseFloat(m.feeAmount || '0'), 0);

  // Milestone status counts for summary cards
  const milestoneStats = {
    total: milestones.length,
    todo: milestones.filter((m: any) => m.status === 'todo').length,
    inProgress: milestones.filter((m: any) => m.status === 'in_progress').length,
    client_review: milestones.filter((m: any) => m.status === 'client_review').length,
    done: milestones.filter((m: any) => m.status === 'done').length,
  };

  return (
    <div className="min-h-screen bg-background-page">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header with breadcrumb and actions */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/projects')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
            <div className="text-sm text-gray-500">
              Projects / {project.client || project.name}
            </div>
          </div>
          
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setEditingProject(project)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Project
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDeactivateProject}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Deactivate
              </Button>
            </div>
          )}
        </div>

        {/* Project Header Card */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <CardTitle className="text-2xl">{project.client || project.name}</CardTitle>
                  <Badge className={getStatusColor(project.status)}>
                    {formatStatus(project.status)}
                  </Badge>
                </div>
                <CardDescription className="text-base">
                  {project.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Project Details */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Project Details</h4>
                
                {project.client && (
                  <div className="flex items-center text-sm">
                    <Users className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{project.client}</span>
                  </div>
                )}
                
                <div className="flex items-center text-sm">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  <span>
                    {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Contract Value:</span>
                  <span className="font-medium">KSh {totalProjectValue.toLocaleString()}</span>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Financial Status</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Contract Value:</span>
                    <span className="font-medium">KSh {totalProjectValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Paid Amount:</span>
                    <span className="font-medium text-green-600">KSh {paidAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Outstanding:</span>
                    <span className="font-medium">KSh {(totalProjectValue - paidAmount).toLocaleString()}</span>
                  </div>
                </div>
                <Progress 
                  value={totalProjectValue > 0 ? (paidAmount / totalProjectValue) * 100 : 0} 
                  className="h-2" 
                />
                <p className="text-xs text-gray-500">
                  {totalProjectValue > 0 ? Math.round((paidAmount / totalProjectValue) * 100) : 0}% paid
                </p>
              </div>

              {/* Milestone Summary */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Milestone Progress</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total:</span>
                    <span className="font-medium">{milestoneStats.total}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Completed:</span>
                    <span className="font-medium text-green-600">{milestoneStats.done}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>In Progress:</span>
                    <span className="font-medium text-blue-600">{milestoneStats.inProgress}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Pending:</span>
                    <span className="font-medium">{milestoneStats.todo}</span>
                  </div>
                </div>
                <Progress 
                  value={milestoneStats.total > 0 ? (milestoneStats.done / milestoneStats.total) * 100 : 0} 
                  className="h-2" 
                />
              </div>

              {/* Team Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Team</h4>
                
                {segmentLeader && (
                  <div className="flex items-center space-x-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-xs">
                        {getInitials(segmentLeader.leaderName || 'SL')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {segmentLeader.leaderName}
                      </p>
                      <p className="text-xs text-gray-500">Project Manager</p>
                    </div>
                  </div>
                )}

                {project.team && (
                  <div className="text-sm">
                    <p className="font-medium">{project.team.name}</p>
                    <p className="text-xs text-gray-500">Project Team</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Milestones Table */}
        {milestonesLoading ? (
          <Card>
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <MilestoneTable 
            milestones={milestones}
            projectSegment={project.segment || 'private'}
            onEdit={handleEditMilestone}
          />
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
