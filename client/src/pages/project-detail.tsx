import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams, useSearch } from "wouter";
import Navigation from "@/components/layout/navigation";
import CreateProjectModal from "@/components/projects/create-project-modal";
import ModuleTable from "@/components/projects/module-table";
import MilestonesTable from "@/components/projects/milestones-table";
import PhaseOverview from "@/components/projects/phase-overview";
import GanttChart from "@/components/projects/gantt-chart";
import ProjectCharter from "@/components/projects/project-charter";
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
  CheckCircle,
  Clock
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, calculateWeightBasedProgress } from "@/lib/utils";

export default function ProjectDetail() {
  // Type definitions
  interface Phase {
    id: string;
    phaseNumber: number;
    phaseName: string;
    description: string;
    startDate: string | null;
    endDate: string | null;
    status: 'not_started' | 'in_progress' | 'completed' | 'on_hold';
    progress: number;
    deliverables: any[];
    reports: any[];
    modules: any[];
  }

  interface Module {
    id: string;
    name: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'not_started' | 'in_progress' | 'fc_review' | 'qa' | 'client_review' | 'completed' | 'overdue' | 'on_hold' | 'cancelled';
    startDate?: string;
    dueDate?: string;
    estimatedHours?: number;
    actualHours?: number;
    weight: number;
    assignedUserId?: string;
    assignedUser?: {
      firstName?: string;
      lastName?: string;
      email: string;
    };
    projectId: string;
    phaseNumber?: number;
    phaseName?: string;
    progressPercent: number;
    createdAt: string;
    updatedAt: string;
    subtasks?: any[];
  }

  const auth = useAuth() as any;
  const { isAuthenticated, isLoading, user } = auth;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = params.id;

  const [editingProject, setEditingProject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('modules');
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  
  // Get search parameters to check if a specific milestone was clicked
  const search = useSearch();
  const urlParams = new URLSearchParams(search);
  const taskIdFromUrl = urlParams.get('task');

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
      if (!projectId) throw new Error('Project ID is required');
      const res = await fetch(`/api/projects/${projectId}`, { 
        credentials: 'include', 
        cache: 'no-store' 
      });
      if (!res.ok) throw new Error('Failed to fetch project');
      return res.json();
    },
    enabled: !!isAuthenticated && !!projectId,
  });

  const { data: modules = [], isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ['/api/projects', projectId, 'modules'],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`/api/projects/${projectId}/modules`, { 
        credentials: 'include', 
        cache: 'no-store' 
      });
      if (!res.ok) throw new Error('Failed to fetch modules');
      return res.json();
    },
    enabled: !!isAuthenticated && !!projectId,
  });

  const { data: milestones = [], isLoading: milestonesLoading } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'milestones'],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`/api/projects/${projectId}/milestones`, { 
        credentials: 'include', 
        cache: 'no-store' 
      });
      if (!res.ok) throw new Error('Failed to fetch milestones');
      return res.json();
    },
    enabled: !!isAuthenticated && !!projectId,
  });

  // Auto-expand milestone if task parameter is present in URL
  useEffect(() => {
    if (taskIdFromUrl && milestones.length > 0) {
      setExpandedMilestone(taskIdFromUrl);
      // Ensure we're on the milestones tab
      setActiveTab('milestones');
    }
  }, [taskIdFromUrl, milestones]);

  // Fetch phases from server API (includes real status updates from automation)
  const { data: phases = [], isLoading: phasesLoading, error: phasesError } = useQuery<Phase[]>({
    queryKey: ['/api/projects', projectId, 'phases'],
    queryFn: async () => {
      if (!projectId) return [];
      
      // First, ensure phases exist for this project
      try {
        const createResponse = await fetch(`/api/projects/${projectId}/phases`, {
          method: 'POST',
          credentials: 'include'
        });
        if (!createResponse.ok && createResponse.status !== 409) {
          // 409 means phases already exist, which is fine
          console.warn('Failed to create phases, continuing with fetch');
        }
      } catch (error) {
        console.warn('Error creating phases:', error);
      }
      
      // Fetch the actual phases from server
      const response = await fetch(`/api/projects/${projectId}/phases`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch phases');
      }
      
      const serverPhases = await response.json();
      
      // Transform server phase data to match client interface
      return serverPhases.map((phase: any) => ({
        id: phase.id,
        phaseNumber: phase.phaseNumber,
        phaseName: phase.phaseName,
        description: phase.description,
        startDate: phase.startDate,
        endDate: phase.endDate,
        status: phase.status,
        progress: phase.progress || 0,
        deliverables: phase.deliverables || [],
        reports: phase.reports || []
      }));
    },
    enabled: !!isAuthenticated && !!projectId,
  });





  // Fetch project charter
  const { data: projectCharter, isLoading: charterLoading } = useQuery<any>({
    queryKey: ['/api/projects', projectId, 'charter'],
    queryFn: async () => {
      if (!projectId) return null;
      const res = await fetch(`/api/projects/${projectId}/charter`, { 
        credentials: 'include', 
        cache: 'no-store' 
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!isAuthenticated && !!projectId,
  });

  // Generate Gantt chart data from backend API
  const { data: ganttData, isLoading: ganttLoading, error: ganttError } = useQuery<any>({
    queryKey: ['/api/projects', projectId, 'gantt'],
    queryFn: async () => {
      if (!projectId) return null;
      
      const res = await fetch(`/api/projects/${projectId}/gantt`, {
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch Gantt chart data');
      }
      
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

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'planning':
        return 'bg-blue-100 text-blue-800';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'on_support':
        return 'bg-purple-100 text-purple-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };



  const handleDeactivateProject = async () => {
    if (!project) return;
    
    const confirmed = window.confirm(`Deactivate project "${project.name}"? This will mark the project as inactive.`);
    if (!confirmed) return;
    
    try {
      await apiRequest('PUT', `/api/projects/${project.id}/terminate`);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Success",
        description: "Project deactivated successfully",
      });
    } catch (error: any) {
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
      console.error('Error deactivating project:', error);
      toast({
        title: "Error",
        description: "Failed to deactivate project",
        variant: "destructive",
      });
    }
  };

  // Phase management handlers
  const handlePhaseUpdate = async (phaseId: string, updates: any) => {
    if (!projectId) return;
    try {
      await apiRequest('PUT', `/api/phases/${phaseId}`, updates);
      // Invalidate phase queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'phases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'gantt'] });
      // Also invalidate modules query to ensure phase status updates are reflected
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'modules'] });
      toast({
        title: "Success",
        description: "Phase updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating phase:', error);
      toast({
        title: "Error",
        description: "Failed to update phase",
        variant: "destructive",
      });
    }
  };

  const handlePhaseComplete = async (phaseId: string, completionReport: string) => {
    if (!projectId) return;
    try {
      await apiRequest('PUT', `/api/phases/${phaseId}/complete`, { completionReport });
      // Invalidate phase queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'phases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'gantt'] });
      // Also invalidate modules query to ensure phase status updates are reflected
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'modules'] });
      toast({
        title: "Success",
        description: "Phase completed successfully",
      });
    } catch (error: any) {
      console.error('Error completing phase:', error);
      toast({
        title: "Error",
        description: "Failed to complete phase",
        variant: "destructive",
      });
    }
  };

  // Charter management handler
  const handleCharterSave = async (charterData: any) => {
    if (!projectId) return;
    try {
      if (projectCharter) {
        await apiRequest('PUT', `/api/projects/${projectId}/charter`, charterData);
      } else {
        await apiRequest('POST', `/api/projects/${projectId}/charter`, charterData);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'charter'] });
      toast({
        title: "Success",
        description: "Project charter saved successfully",
      });
    } catch (error: any) {
      console.error('Error saving charter:', error);
      toast({
        title: "Error",
        description: "Failed to save project charter",
        variant: "destructive",
      });
    }
  };

  // Milestone management handler
  const handleEditMilestone = async (milestone: any) => {
    try {
      // Update milestone using the API
      const response = await apiRequest('PUT', `/api/milestones/${milestone.id}`, {
        billingStatus: milestone.billingStatus,
        name: milestone.name,
        description: milestone.description,
        feeAmount: milestone.feeAmount,
        expectedInvoiceDate: milestone.expectedInvoiceDate,
        expectedCollectionDate: milestone.expectedCollectionDate
      });
      
      // Refresh the milestones data
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'milestones'] });
      
      toast({
        title: "Success",
        description: `Milestone updated successfully`,
      });
    } catch (error: any) {
      console.error('Error updating milestone:', error);
      toast({
        title: "Error",
        description: "Failed to update milestone",
        variant: "destructive",
      });
    }
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
                onClick={() => {
                  setEditingProject(project);
                }}
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
                    <span className="font-medium">Start:</span> {new Date(project.startDate).toLocaleDateString()} - <span className="font-medium">End:</span> {new Date(project.endDate).toLocaleDateString()}
                  </span>
                </div>

                {/* Project Duration */}
                <div className="flex items-center text-sm">
                  <Clock className="h-4 w-4 mr-2 text-gray-400" />
                  <span>
                    <span className="font-medium">Duration:</span> {
                      (() => {
                        const start = new Date(project.startDate);
                        const end = new Date(project.endDate);
                        const diffTime = Math.abs(end.getTime() - start.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return `${diffDays} days`;
                      })()
                    }
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Contract Value:</span>
                  <span className="font-medium">
                    KSh {(() => {
                      const totalProjectValue = milestones.length > 0 && milestones.some((m: any) => m.feeAmount) 
                        ? milestones.reduce((total: number, milestone: any) => {
                            return total + (milestone.feeAmount ? Number(milestone.feeAmount) : 0);
                          }, 0)
                        : (project.budget ? Number(project.budget) : 0);
                      return totalProjectValue > 0 ? totalProjectValue.toLocaleString() : 
                             (project.budget ? Number(project.budget).toLocaleString() : '0');
                    })()}
                  </span>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Financial Status</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Contract Value:</span>
                    <span className="font-medium">
                      KSh {(() => {
                        const totalProjectValue = milestones.length > 0 && milestones.some((m: any) => m.feeAmount) 
                          ? milestones.reduce((total: number, milestone: any) => {
                              return total + (milestone.feeAmount ? Number(milestone.feeAmount) : 0);
                            }, 0)
                          : (project.budget ? Number(project.budget) : 0);
                        return totalProjectValue > 0 ? totalProjectValue.toLocaleString() : 
                               (project.budget ? Number(project.budget).toLocaleString() : '0');
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Paid Amount:</span>
                    <span className="font-medium text-green-600">KSh {(() => {
                      const paidAmount = milestones.reduce((total: number, milestone: any) => {
                        if (milestone.billingStatus === 'paid' && milestone.feeAmount) {
                          return total + Number(milestone.feeAmount);
                        }
                        return total;
                      }, 0);
                      return paidAmount.toLocaleString();
                    })()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Outstanding:</span>
                    <span className="font-medium">KSh {(() => {
                      const totalProjectValue = milestones.length > 0 && milestones.some((m: any) => m.feeAmount) 
                        ? milestones.reduce((total: number, milestone: any) => {
                            return total + (milestone.feeAmount ? Number(milestone.feeAmount) : 0);
                          }, 0)
                        : (project.budget ? Number(project.budget) : 0);
                      const paidAmount = milestones.reduce((total: number, milestone: any) => {
                        if (milestone.billingStatus === 'paid' && milestone.feeAmount) {
                          return total + Number(milestone.feeAmount);
                        }
                        return total;
                      }, 0);
                      return (totalProjectValue - paidAmount).toLocaleString();
                    })()}</span>
                  </div>
                </div>
                <Progress 
                  value={(() => {
                    const totalProjectValue = milestones.length > 0 && milestones.some((m: any) => m.feeAmount) 
                      ? milestones.reduce((total: number, milestone: any) => {
                          return total + (milestone.feeAmount ? Number(milestone.feeAmount) : 0);
                        }, 0)
                      : (project.budget ? Number(project.budget) : 0);
                    const paidAmount = milestones.reduce((total: number, milestone: any) => {
                      if (milestone.billingStatus === 'paid' && milestone.feeAmount) {
                        return total + Number(milestone.feeAmount);
                      }
                      return total;
                    }, 0);
                    return totalProjectValue > 0 ? (paidAmount / totalProjectValue) * 100 : 0;
                  })()} 
                  className="h-2" 
                />
                <p className="text-xs text-gray-500">
                  {(() => {
                    const totalProjectValue = milestones.length > 0 && milestones.some((m: any) => m.feeAmount) 
                      ? milestones.reduce((total: number, milestone: any) => {
                          return total + (milestone.feeAmount ? Number(milestone.feeAmount) : 0);
                        }, 0)
                      : (project.budget ? Number(project.budget) : 0);
                    const paidAmount = milestones.reduce((total: number, milestone: any) => {
                      if (milestone.billingStatus === 'paid' && milestone.feeAmount) {
                        return total + Number(milestone.feeAmount);
                      }
                      return total;
                    }, 0);
                    return totalProjectValue > 0 ? Math.round((paidAmount / totalProjectValue) * 100) : 0;
                  })()}% paid
                </p>
              </div>

              {/* Module Summary */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Module Progress</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Weight-Based Progress:</span>
                    <span className="font-medium text-blue-600">{(() => {
                      return calculateWeightBasedProgress(modules);
                    })()}%</span>
                  </div>
                  <Progress 
                    value={(() => {
                      return calculateWeightBasedProgress(modules);
                    })()} 
                    className="h-2" 
                  />
                  <div className="text-xs text-gray-500 mb-3">
                    Progress calculated by module priority weights and status progression (Critical=4, High=3, Medium=2, Low=1)
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Total:</span>
                    <span className="font-medium">{modules.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Completed:</span>
                    <span className="font-medium text-green-600">{modules.filter((m: any) => m.status === 'completed').length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>In Progress:</span>
                    <span className="font-medium text-blue-600">{modules.filter((m: any) => m.status === 'in_progress' || m.status === 'fc_review' || m.status === 'qa' || m.status === 'client_review').length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Pending:</span>
                    <span className="font-medium">{modules.filter((m: any) => m.status === 'not_started' || m.status === 'on_hold').length}</span>
                  </div>
                </div>
                <Progress 
                  value={(() => {
                    const total = modules.length;
                    const done = modules.filter((m: any) => m.status === 'completed').length;
                    return total > 0 ? (done / total) * 100 : 0;
                  })()} 
                  className="h-2" 
                />
                <p className="text-xs text-gray-500">Count-based progress: {(() => {
                  const total = modules.length;
                  const done = modules.filter((m: any) => m.status === 'completed').length;
                  return total > 0 ? Math.round((done / total) * 100) : 0;
                })()}%</p>
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

        {/* Project Tabs */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <nav className="flex" aria-label="Tabs">
              {[
                { id: 'modules', name: 'Modules', description: 'Track project modules and tasks' },
                { id: 'phases', name: 'Phases', description: 'Manage project phases and workflow' },
                { id: 'gantt', name: 'Gantt Chart', description: 'Visualize project timeline' },
                { id: 'milestones', name: 'Milestones', description: 'Manage billing milestones' }
              ].map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                  className={`flex-1 px-6 py-4 text-left transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-blue-50 border-b-2 border-blue-500 text-blue-700'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                  } ${index === 0 ? 'rounded-l-lg' : ''} ${index === 3 ? 'rounded-r-lg' : ''}`}
                >
                  <div className="font-semibold text-sm mb-1">{tab.name}</div>
                  <div className={`text-xs ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-500'}`}>
                    {tab.description}
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'phases' && projectId && (
          <div className="space-y-6">
            {phasesLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle>Phases</CardTitle>
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
            ) : phasesError ? (
              <Card>
                <CardHeader>
                  <CardTitle>Phases</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-red-600">Error loading phases: {phasesError?.message || 'Unknown error'}</p>
                  </div>
                </CardContent>
              </Card>
            ) : phases.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Phases</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-gray-600">No phases found for this project.</p>
                    <p className="text-sm text-gray-500 mt-2">Phases will be created automatically based on milestones.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <PhaseOverview 
                projectId={projectId!}
                phases={phases}
                modules={modules}
                projectTeam={project.team}
                onPhaseUpdate={handlePhaseUpdate}
                onPhaseComplete={handlePhaseComplete}
              />
            )}
          </div>
        )}

        {activeTab === 'gantt' && (
          <div className="space-y-6">
            {ganttLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle>Gantt Chart</CardTitle>
                  <CardDescription>Project timeline and phase visualization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading Gantt chart data...</p>
                  </div>
                </CardContent>
              </Card>
            ) : ganttError ? (
              <Card>
                <CardHeader>
                  <CardTitle>Gantt Chart</CardTitle>
                  <CardDescription>Project timeline and phase visualization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-red-600">Error loading Gantt chart: {ganttError?.message || 'Unknown error'}</p>
                  </div>
                </CardContent>
              </Card>
            ) : !ganttData ? (
              <Card>
                <CardHeader>
                  <CardTitle>Gantt Chart</CardTitle>
                  <CardDescription>Project timeline and phase visualization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-gray-600">No Gantt chart data available.</p>
                    <p className="text-sm text-gray-500 mt-2">Gantt chart will be generated based on project phases and milestones.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <GanttChart 
                data={ganttData}
                onPhaseClick={(phaseId) => setActiveTab('phases')}
                onTaskClick={(taskId) => setActiveTab('modules')}
              />
            )}
          </div>
        )}



        {activeTab === 'modules' && (
          <div className="space-y-6">
            {/* Modules Table */}
            {modulesLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle>Modules</CardTitle>
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
              <ModuleTable 
                modules={modules}
                projectSegment={project.segment || 'private'}
                projectTeam={project.team}
                onEdit={handleEditMilestone}
                initiallyExpandedModule={expandedMilestone}
              />
            )}
          </div>
        )}

        {activeTab === 'milestones' && (
          <div className="space-y-6">
            {milestonesLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle>Billing Milestones</CardTitle>
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
              <MilestonesTable 
                milestones={milestones}
                projectSegment={project.segment || 'private'}
                onEdit={handleEditMilestone}
                onDelete={(milestoneId) => {
                  // TODO: Implement milestone deletion
                  console.log('Delete milestone:', milestoneId);
                }}
              />
            )}
          </div>
        )}

        {/* Edit Project Modal */}
        {editingProject && (
          <CreateProjectModal 
            project={editingProject} 
            onClose={() => setEditingProject(null)}
          />
        )}
      </div>
    </div>
  );
}
