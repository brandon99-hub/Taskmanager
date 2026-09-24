import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams, useSearch } from "wouter";
import CreateProjectModal from "@/components/projects/create-project-modal";
import MilestonesTable from "@/components/projects/milestones-table";
import GanttChart from "@/components/projects/gantt-chart";
import ProjectCharter from "@/components/projects/project-charter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TicketDetailDialog from "@/components/tickets/ticket-detail-dialog";
import { STATUS_LABELS, STATUS_VARIANTS, PRIORITY_VARIANTS, TYPE_LABELS, TYPE_VARIANTS } from "@/lib/ticket-constants";
import { 
  Calendar, 
  Users, 
  DollarSign, 
  ArrowLeft, 
  Edit, 
  Trash2, 
  CheckCircle, 
  Clock,
  Building2,
  Mail,
  Phone,
  Ticket,
  MapPin,
  Eye
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { batchQuery } from "@/lib/queryBatcher";
import { formatCurrency, calculateWeightBasedProgress, calculateSubtaskWeightBasedProgress, calculateProjectProgress } from "@/lib/utils";
import { useScreenSize } from "@/hooks/use-mobile";

export default function ProjectDetail() {
  // Type definitions
  interface Module {
    id: string;
    name: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'not_started' | 'in_progress' | 'fc_review' | 'qa' | 'client_review' | 'completed' | 'overdue' | 'on_hold' | 'cancelled';
    billingStatus?: 'none' | 'to_send' | 'sent' | 'paid' | 'overdue' | 'processing';
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
    // Phase 3 specific fields
    milestoneId?: string; // For modules under milestones
    feeAmount?: number; // For milestones (billing entities)
    expectedInvoiceDate?: string; // For milestones
    expectedCollectionDate?: string; // For milestones
    isMilestone?: boolean; // Flag to identify if this is a milestone
    modules?: Module[]; // Nested modules for milestones
  }

  interface Milestone {
    id: string;
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    feeAmount: number;
    billingStatus: string;
    expectedInvoiceDate: string;
    expectedCollectionDate: string;
    invoiceSentAt?: string;
    paymentReceivedAt?: string;
    overdueFlag: boolean;
    createdAt: string;
    updatedAt: string;
    modules?: Module[];
    subtasks?: any[]; // Direct subtasks under milestone
  }

  const auth = useAuth() as any;
  const { isAuthenticated, isLoading, user } = auth;
  const canEditProject = auth.hasPermission?.('projects.edit') || auth.isAdminRole?.();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = params.id;
  const { isMobile } = useScreenSize();

  const [editingProject, setEditingProject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('tickets');
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Enhanced cache invalidation function for immediate table refresh
  const invalidateProjectCaches = async (projectId: string) => {
    try {
      // Force remove cached queries to bypass staleTime
      await queryClient.removeQueries({ queryKey: ['/api/projects', projectId, 'milestones'] });

      // Invalidate all project-related queries to ensure immediate refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'milestones'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'gantt'] }),
      ]);

      // Force immediate refetch from server
      await queryClient.refetchQueries({ queryKey: ['/api/projects', projectId, 'milestones'] });
    } catch (error) {
      console.error('Error invalidating project caches:', error);
    }
  };
  
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

  // Fetch milestones directly from the milestones API
  const { data: milestones = [], isLoading: milestonesLoading } = useQuery<Milestone[]>({
    queryKey: ['/api/projects', projectId, 'milestones'],
    queryFn: async () => {
      if (!projectId) return [];
      return batchQuery(`/api/projects/${projectId}/milestones`);
    },
    enabled: !!isAuthenticated && !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  // Auto-expand milestone if task parameter is present in URL
  useEffect(() => {
    if (taskIdFromUrl && milestones.length > 0) {
      setExpandedMilestone(taskIdFromUrl);
      // Ensure we're on the milestones tab
      setActiveTab('milestones');
    }
  }, [taskIdFromUrl, milestones]);


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
      
      // Force fresh data with cache-busting timestamp
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/projects/${projectId}/gantt?t=${timestamp}`, { 
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch Gantt data');
      const data = await response.json();
      console.log('[DEBUG] Gantt data received from direct endpoint:', data);
      return data;
    },
    enabled: !!isAuthenticated && !!projectId,
    staleTime: 0, // Force fresh data to get updated phases - no cache
    refetchOnWindowFocus: true,
  });

  // Fetch segment leader based on project segment
  const { data: segmentLeader } = useQuery<any>({
    queryKey: ['/api/segment-leaders', project?.segmentId],
    queryFn: async () => {
      if (!project?.segmentId) return null;
      const res = await fetch(`/api/segment-leaders/${project.segmentId}`, {
        credentials: 'include'
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!isAuthenticated && !!project?.segmentId,
  });

  // Fetch tickets specifically logged for this project
  const { data: projectTickets = [], isLoading: ticketsLoading } = useQuery<any[]>({
    queryKey: ['/api/tickets', 'project', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      try {
        const res = await fetch(`/api/tickets?projectId=${projectId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) return data;
        }
        const allRes = await fetch('/api/tickets', { credentials: 'include' });
        if (allRes.ok) {
          const allData = await allRes.json();
          if (Array.isArray(allData)) {
            return allData.filter((t: any) => t.projectId === projectId || t.project?.id === projectId);
          }
        }
      } catch (err) {
        console.error('Error fetching project tickets:', err);
      }
      return [];
    },
    enabled: !!isAuthenticated && !!projectId,
  });

  // Query companies to enrich company details if not joined
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/companies', { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query segments to show sector name
  const { data: segments = [] } = useQuery<any[]>({
    queryKey: ['/api/segments'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/segments', { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    staleTime: 20 * 60 * 1000,
  });

  const company = project?.company || (project?.companyId ? (Array.isArray(companies) ? companies.find((c: any) => c.id === project.companyId) : null) : null);
  const sectorName = project?.segmentId ? (Array.isArray(segments) ? segments.find((s: any) => s.id === project.segmentId)?.name : null) : null;

  const getSupportState = (p: any): 'on_support' | 'expired' | 'closed' => {
    if (!p) return 'on_support';
    if (p.status === 'support_closed') return 'closed';
    if (p.endDate && new Date(p.endDate) < new Date()) return 'expired';
    return 'on_support';
  };

  const formatSupportStatus = (state: 'on_support' | 'expired' | 'closed') => {
    switch (state) {
      case 'on_support':
        return 'On Support';
      case 'expired':
        return 'Expired - Pending Renewal';
      case 'closed':
        return 'Closed';
    }
  };

  const getSupportStatusBadgeClass = (state: 'on_support' | 'expired' | 'closed') => {
    switch (state) {
      case 'on_support':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'expired':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'closed':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'planning':
        return 'bg-gray-100 text-primary';
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
      // Enhanced cache invalidation for immediate table refresh
      if (project.id) {
        await invalidateProjectCaches(project.id);
      }
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

  const handleCloseSupport = async () => {
    if (!project) return;

    const confirmed = window.confirm(`Close support for "${project.name}"? This is a deliberate action distinct from the support period's end date just passing - it marks the project as no longer under support.`);
    if (!confirmed) return;

    try {
      await apiRequest('PUT', `/api/projects/${project.id}/close-support`);
      if (project.id) {
        await invalidateProjectCaches(project.id);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Success",
        description: "Project support closed",
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
      console.error('Error closing project support:', error);
      toast({
        title: "Error",
        description: "Failed to close project support",
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
      // Enhanced cache invalidation for immediate table refresh
      await invalidateProjectCaches(projectId);
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
      
      // Enhanced cache invalidation for immediate table refresh
      if (projectId) {
        await invalidateProjectCaches(projectId);
      }
      
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
      
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {/* Header with breadcrumb and actions */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/projects')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
            <div className="text-xs sm:text-sm text-gray-500">
              Projects / {project.client || project.name}
            </div>
          </div>
          
          {canEditProject && (
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
                onClick={handleCloseSupport}
                disabled={project?.status === 'support_closed'}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {project?.status === 'support_closed' ? 'Support Closed' : 'Close Support'}
              </Button>
              <Button
                variant="outline"
                onClick={handleDeactivateProject}
                disabled={project?.status === 'inactive'}
                className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {project?.status === 'inactive' ? 'Inactive' : 'Deactivate'}
              </Button>
            </div>
          )}
        </div>

        {/* Project Header Card */}
        <Card className="mb-6 sm:mb-8 border border-gray-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <CardTitle className="text-2xl font-bold text-gray-900">{project.client || project.name}</CardTitle>
                  <Badge className={getSupportStatusBadgeClass(getSupportState(project))}>
                    {formatSupportStatus(getSupportState(project))}
                  </Badge>
                  {sectorName && (
                    <Badge variant="outline" className="border-gray-300 text-gray-700 bg-gray-50">
                      {sectorName}
                    </Badge>
                  )}
                </div>
                {project.description && (
                  <CardDescription className="text-sm text-gray-600">
                    {project.description}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Column 1: Support Period & Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Support Agreement</h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-700">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                    <span>
                      <span className="font-medium text-gray-900">Period:</span> {new Date(project.startDate).toLocaleDateString()} – {new Date(project.endDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center text-gray-700">
                    <Clock className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                    <span>
                      <span className="font-medium text-gray-900">Duration:</span> {
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

                  <div className="flex items-center text-gray-700">
                    <Ticket className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                    <span>
                      <span className="font-medium text-gray-900">Support Status:</span>{" "}
                      <span className="capitalize">{formatSupportStatus(getSupportState(project))}</span>
                    </span>
                  </div>

                  <div className="flex items-center text-gray-700">
                    <CheckCircle className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                    <span>
                      <span className="font-medium text-gray-900">Logged Tickets:</span> {projectTickets.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Column 2: Company Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Company Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-900 font-medium">
                    <Building2 className="h-4 w-4 mr-2 text-primary shrink-0" />
                    <span className="truncate">{company?.name || project.client || 'No company specified'}</span>
                  </div>

                  {(company?.primaryContactName || project.client) && (
                    <div className="flex items-center text-gray-700">
                      <Users className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                      <span className="truncate">{company?.primaryContactName || project.client}</span>
                    </div>
                  )}

                  {(company?.primaryContactEmail || project.clientEmail) && (
                    <div className="flex items-center text-gray-700">
                      <Mail className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                      <a href={`mailto:${company?.primaryContactEmail || project.clientEmail}`} className="text-primary hover:underline truncate">
                        {company?.primaryContactEmail || project.clientEmail}
                      </a>
                    </div>
                  )}

                  {company?.primaryContactPhone && (
                    <div className="flex items-center text-gray-700">
                      <Phone className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                      <span>{company.primaryContactPhone}</span>
                    </div>
                  )}

                  {company?.address && (
                    <div className="flex items-center text-gray-700">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                      <span className="truncate">{company.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Team Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Account & Support Lead</h4>
                
                <div className="space-y-2">
                  {segmentLeader && (
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(segmentLeader.leaderName || 'SL')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {segmentLeader.leaderName}
                        </p>
                        <p className="text-xs text-gray-500">Sector Leader</p>
                      </div>
                    </div>
                  )}

                  {project.manager && !segmentLeader && (
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(project.manager.firstName ? `${project.manager.firstName} ${project.manager.lastName || ''}` : project.manager.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {project.manager.firstName ? `${project.manager.firstName} ${project.manager.lastName || ''}` : project.manager.email}
                        </p>
                        <p className="text-xs text-gray-500">Project Manager</p>
                      </div>
                    </div>
                  )}

                  {project.team && (
                    <div className="text-sm pt-1">
                      <span className="text-xs text-gray-500">Assigned Team:</span>
                      <p className="font-medium text-gray-800">{project.team.name}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Tabs */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <nav className="flex" aria-label="Tabs">
              {[
                { id: 'tickets', name: 'Tickets', description: `Support tickets logged for this project (${projectTickets.length})` },
                { id: 'milestones', name: 'Milestones', description: 'Track and manage project milestones' },
                { id: 'gantt', name: 'Gantt Chart', description: 'Visualize project timeline' },
              ].map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                  className={`flex-1 px-6 py-4 text-left transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-gray-50 border-b-2 border-accent-brand text-primary'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                  } ${index === 0 ? 'rounded-l-lg' : ''} ${index === 2 ? 'rounded-r-lg' : ''}`}
                >
                  <div className="font-semibold text-sm mb-1">{tab.name}</div>
                  <div className={`text-xs ${activeTab === tab.id ? 'text-primary' : 'text-gray-500'}`}>
                    {tab.description}
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Project Support Tickets</CardTitle>
                  <CardDescription>Support issues and tickets logged for this project</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {projectTickets.length} Total
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                    {projectTickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length} Resolved
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                    {projectTickets.filter((t: any) => t.status !== 'resolved' && t.status !== 'closed').length} Open
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {ticketsLoading ? (
                  <div className="p-6 space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : projectTickets.length === 0 ? (
                  <div className="text-center py-12">
                    <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-gray-900 mb-1">No Tickets Logged</h3>
                    <p className="text-sm text-gray-500">There are currently no support tickets logged for this project.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket #</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requester</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectTickets.map((ticket: any) => (
                        <TableRow 
                          key={ticket.id} 
                          className="hover:bg-gray-50/80 cursor-pointer"
                          onClick={() => setSelectedTicketId(ticket.id)}
                        >
                          <TableCell className="font-mono text-xs text-gray-600">
                            {ticket.ticketNumber || `#${ticket.id.slice(0, 8)}`}
                          </TableCell>
                          <TableCell className="font-medium text-gray-900 max-w-xs truncate">
                            {ticket.subject}
                          </TableCell>
                          <TableCell>
                            <Badge variant={TYPE_VARIANTS[ticket.type] || "outline"} className="text-xs">
                              {TYPE_LABELS[ticket.type] || ticket.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={PRIORITY_VARIANTS[ticket.priority] || "outline"} className="capitalize text-xs">
                              {ticket.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[ticket.status] || "outline"} className="text-xs">
                              {STATUS_LABELS[ticket.status] || ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {ticket.contactName || (ticket.createdBy ? `${ticket.createdBy.firstName || ''} ${ticket.createdBy.lastName || ''}`.trim() : '—')}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                            {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTicketId(ticket.id);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1 text-gray-500" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {selectedTicketId && (
              <TicketDetailDialog ticketId={selectedTicketId} onClose={() => setSelectedTicketId(null)} />
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
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
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
                onPhaseClick={(phaseId) => setActiveTab('milestones')}
                onTaskClick={(taskId) => setActiveTab('milestones')}
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
                projectSegment={project.segmentId || ''}
                onEdit={handleEditMilestone}
                onDelete={async (milestoneId) => {
                  if (confirm('Are you sure you want to delete this milestone?')) {
                    try {
                      await apiRequest('DELETE', `/api/milestones/${milestoneId}`);
                      // Enhanced cache invalidation for immediate table refresh
                      await invalidateProjectCaches(project.id);
                      toast({ title: 'Success', description: 'Milestone deleted' });
                    } catch (error) {
                      toast({ title: 'Error', description: 'Failed to delete milestone', variant: 'destructive' });
                    }
                  }
                }}
              />
            )}
          </div>
        )}

        {/* Edit Project Modal */}
        {editingProject && (
          <CreateProjectModal 
            project={editingProject} 
            key={`edit-${editingProject.id}-${editingProject.updatedAt || Date.now()}`}
            onClose={() => setEditingProject(null)}
          />
        )}
      </div>
    </div>
  );
}
