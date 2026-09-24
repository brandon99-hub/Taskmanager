import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useScreenSize, useResponsiveDesign, useTouchInteractions } from "@/hooks/use-mobile";
import CreateProjectModal from "@/components/projects/create-project-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Users, DollarSign, MoreHorizontal, ExternalLink, AlertTriangle, Search, Filter, Grid3X3, Table, Clock, FolderOpen, Building2 } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { batchQuery } from "@/lib/queryBatcher";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateWeightBasedProgress, calculateProjectProgress } from "@/lib/utils";

export default function Projects() {
  const auth = useAuth() as any;
  const { isAuthenticated, isLoading, user, isAdminRole } = auth;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isMobile, isTablet } = useScreenSize();
  const responsive = useResponsiveDesign();
  const { onTouchStart, onTouchMove, onTouchEnd } = useTouchInteractions();

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

  // Use batched queries to reduce API calls
  const { data: projects = [], isLoading: projectsLoading, error } = useQuery<any[]>({
    queryKey: ['/api/projects'],
    enabled: !!isAuthenticated,
  });

  const { data: segments = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/segments'],
    enabled: !!isAuthenticated,
  });
  const segmentNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of segments) map[s.id] = s.name;
    return map;
  }, [segments]);

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['/api/companies'],
    enabled: !!isAuthenticated,
  });
  const companyNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of companies) map[c.id] = c.name;
    return map;
  }, [companies]);

  // Fetch milestone data for each project using batch loading for better performance
  const { data: projectMilestoneData = [], isLoading: milestonesLoading } = useQuery<Record<string, any[]>>({
    queryKey: ['/api/projects/milestones-data'],
    queryFn: async () => {
      const projectMilestones: Record<string, any[]> = {};
      if (!projects.length) return projectMilestones;
      
      try {
        // Use batch loading for better performance
        const batchPromises = projects.map(project => 
          batchQuery(`/api/projects/${project.id}/milestones`)
        );
        
        const results = await Promise.allSettled(batchPromises);
        
        results.forEach((result, index) => {
          const project = projects[index];
          if (result.status === 'fulfilled') {
            projectMilestones[project.id] = Array.isArray(result.value) ? result.value : [];
          } else {
            console.error(`Error fetching milestones for project ${project.id}:`, result.reason);
            projectMilestones[project.id] = [];
          }
        });
      } catch (error) {
        console.error('Error fetching project milestones:', error);
      }
      return projectMilestones;
    },
    enabled: !!isAuthenticated && projects.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false,
  });

  // Fetch subtasks for all projects to calculate comprehensive progress
  const { data: allSubtasks = [], isLoading: subtasksLoading } = useQuery<any[]>({
    queryKey: ['/api/dashboard/kanban-subtasks'],
    queryFn: async () => {
      try {
        const grouped = await batchQuery('/api/dashboard/kanban-subtasks');
        
        // Ensure grouped is an object
        if (!grouped || typeof grouped !== 'object') {
          console.warn('Invalid subtasks data received:', grouped);
          return [];
        }
        
        // Flatten the grouped subtasks into a single array
        const keys = ['overdue', 'review', 'recentlyDone', 'highPriorityTodo', 'fcReview'];
        const flat: any[] = [];
        for (const k of keys) {
          const arr = Array.isArray(grouped?.[k]) ? grouped[k] : [];
          for (const item of arr) flat.push({ ...item, type: 'subtask' });
        }
        return flat;
      } catch (error) {
        console.error('Error fetching subtasks:', error);
        return [];
      }
    },
    enabled: !!isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  // Support/SLA state: this app only tracks projects during their SLA/support period, so the
  // filter is about that state rather than the full project lifecycle status. "On Support" and
  // "Expired - Pending Renewal" are purely computed from the project's own start/end dates;
  // "Closed" is a deliberate action (the support_closed status) set via the project detail page,
  // not just the date lapsing.
  const getSupportState = (project: any): 'on_support' | 'expired' | 'closed' => {
    if (project.status === 'support_closed') return 'closed';
    if (project.endDate && new Date(project.endDate) < new Date()) return 'expired';
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

  const filteredProjects = useMemo(() => {
    // Ensure projects is an array
    const safeProjects = Array.isArray(projects) ? projects : [];
    let filtered = safeProjects;
    
    // Apply search query filter
    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((p: any) => (
        (p.name || "").toLowerCase().includes(q) ||
        (p.client || "").toLowerCase().includes(q)
      ));
    }
    
    // Apply support-state filter (On Support / Expired - Pending Renewal / Closed)
    if (statusFilter !== "all") {
      filtered = filtered.filter((p: any) => getSupportState(p) === statusFilter);
    }
    
    // Apply segment filter
    if (segmentFilter !== "all") {
      filtered = filtered.filter((p: any) => p.segmentId === segmentFilter);
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

  // Auto-switch to grid view on mobile for better readability
  useEffect(() => {
    if (isMobile && viewMode !== "grid") setViewMode("grid");
  }, [isMobile]);

  // Handle swipe gestures for mobile
  const handleSwipe = () => {
    if (!responsive.swipeEnabled) return;
    
    const swipeResult = onTouchEnd();
    if (swipeResult?.isLeftSwipe) {
      // Swipe left - next page
      goToNextPage();
    } else if (swipeResult?.isRightSwipe) {
      // Swipe right - previous page
      goToPrevPage();
    }
  };

  const { data: overdueCombinedData = [] } = useQuery<any[]>({
    queryKey: ['/api/dashboard/overdue-combined'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/dashboard/overdue-combined', { 
          credentials: 'include', 
          cache: 'no-store' 
        });
        if (!res.ok) throw new Error('Failed to fetch combined overdue data');
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching combined overdue data:', error);
        return [];
      }
    },
    enabled: !!isAuthenticated,
  });

  // Get overdue data for a project
  const getProjectOverdueData = (projectId: string) => {
    const safeOverdueData = Array.isArray(overdueCombinedData) ? overdueCombinedData : [];
    const projectOverdue = safeOverdueData.find((item: any) => 
      item.project?.id === projectId || item.projectId === projectId
    );
    
    if (!projectOverdue) return { milestones: 0, subtasks: 0, total: 0 };
    
    const milestoneCount = Array.isArray(projectOverdue.milestones) ? projectOverdue.milestones.length : 0;
    const subtaskCount = Array.isArray(projectOverdue.subtasks) ? projectOverdue.subtasks.length : 0;
    
    return {
      milestones: milestoneCount,
      subtasks: subtaskCount,
      total: milestoneCount + subtaskCount
    };
  };

  // Get overdue tasks count for each project (keep for backward compatibility)
  const getProjectOverdueCount = (projectId: string) => {
    const { total } = getProjectOverdueData(projectId);
    return total;
  };

  // Calculate comprehensive project progress using both milestones and subtasks
  const getProjectWeightBasedProgress = (projectId: string) => {
    // Use project-specific milestone data now
    const projectMilestoneDataRecord = projectMilestoneData as Record<string, any[]>;
    const projectMilestones = Array.isArray(projectMilestoneDataRecord[projectId]) ? 
      projectMilestoneDataRecord[projectId] : [];

    // Get subtasks from the milestone data like project detail does
    const directSubtasks = projectMilestones.flatMap((m: any) => m.subtasks || []);
    const moduleSubtasks = projectMilestones.flatMap((m: any) => 
      (m.modules || []).flatMap((module: any) => module.subtasks || [])
    );
    const allSubtasks = [...directSubtasks, ...moduleSubtasks];
    
    return calculateProjectProgress(projectMilestones, allSubtasks);
  };

  // Memoized project progress calculations to prevent excessive re-computation
  const projectProgressMap = useMemo(() => {
    const progressMap: Record<string, number> = {};
    projects.forEach(project => {
      progressMap[project.id] = getProjectWeightBasedProgress(project.id);
    });
    return progressMap;
  }, [projects, projectMilestoneData]);

  const handleDeactivateProject = async (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    
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

  if (isLoading || milestonesLoading || !isAuthenticated) {
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
      case 'on_support': return 'bg-purple-500 text-white';
      case 'support_closed': return 'bg-gray-700 text-white';
      case 'inactive': return 'bg-gray-500 text-white';
      case 'cancelled': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'planning': 'Planning',
      'active': 'Active',
      'on_hold': 'On Hold',
      'completed': 'Completed',
      'on_support': 'On Support',
      'support_closed': 'Support Closed',
      'inactive': 'Inactive'
    };
    
    return statusMap[status] || status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="min-h-screen bg-background-page">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <PageHeader
          icon={FolderOpen}
          title="Projects"
          description="Manage and track all your active projects"
          titleBadge={
            <Badge variant="outline" data-testid="badge-project-count">
              ({filteredProjects.length})
            </Badge>
          }
          actions={isAdminRole() && <CreateProjectModal />}
          filters={
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="lg:w-56" data-testid="select-status">
                  <SelectValue placeholder="Support state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Support States</SelectItem>
                  <SelectItem value="on_support">On Support</SelectItem>
                  <SelectItem value="expired">Expired - Pending Renewal</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="lg:w-48" data-testid="select-segment">
                  <SelectValue placeholder="Filter by segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Segments</SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search projects..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>

              <div className="flex bg-gray-100 rounded-lg p-1 shrink-0">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    viewMode === "grid"
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  data-testid="button-view-grid"
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
                  data-testid="button-view-table"
                >
                  <Table className="h-4 w-4" />
                  Table
                </button>
              </div>
            </>
          }
        />

        {(statusFilter !== "all" || segmentFilter !== "all") && (
          <div className="flex items-center justify-end mb-4">
            <Badge variant="secondary" className="text-xs">
              Filtered
            </Badge>
          </div>
        )}

        {/* Projects Display */}
        {projectsLoading ? (
          <div className={`grid gap-6 ${responsive.gridCols} md:grid-cols-2 lg:grid-cols-3`}>
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
          </Card>        ) : viewMode === "table" ? (
          /* Table View */
          <div className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
            <table className="w-full text-left border-collapse bg-white">
              <thead>
                <tr className="border-b border-gray-200 text-xs md:text-sm bg-gray-50/75">
                  <th className="text-left p-3 min-w-[200px] font-semibold text-gray-700">Project Title</th>
                  <th className="text-left p-3 min-w-[130px] font-semibold text-gray-700">Company</th>
                  <th className="text-left p-3 min-w-[180px] font-semibold text-gray-700">Contact Person</th>
                  <th className="text-left p-3 hidden md:table-cell min-w-[130px] font-semibold text-gray-700">Sector</th>
                  <th className="text-left p-3 min-w-[130px] font-semibold text-gray-700">Status</th>
                  <th className="text-left p-3 hidden xl:table-cell min-w-[160px] font-semibold text-gray-700">Timeline</th>
                  <th className="text-left p-3 min-w-[110px] font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs md:text-sm">
                {currentProjects.map((project: any) => {
                  const supportState = getSupportState(project);
                  const companyName = project.company?.name || companyNameById[project.companyId] || project.client || '—';
                  const contactPersonName = project.contactPerson || project.company?.primaryContactName || project.client || '—';
                  const contactEmail = project.contactEmail || project.company?.primaryContactEmail || project.clientEmail || '—';

                  return (
                    <tr 
                      key={project.id}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => setLocation(`/projects/${project.id}`)}
                    >
                      {/* Project Title */}
                      <td className="px-4 py-3 md:py-4">
                        <div className="font-semibold text-gray-900">{project.name || project.client}</div>
                        {project.description && project.description.trim() !== '' && project.description !== (project.name || project.client) && (
                          <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{project.description}</div>
                        )}
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3 md:py-4 font-medium text-gray-800">
                        {companyName}
                      </td>

                      {/* Contact Person (Column 3) */}
                      <td className="px-4 py-3 md:py-4">
                        <div className="font-medium text-gray-900">{contactPersonName}</div>
                        {contactEmail !== '—' && (
                          <div className="text-xs text-gray-500 font-mono mt-0.5 truncate max-w-[220px]">
                            {contactEmail}
                          </div>
                        )}
                      </td>

                      {/* Sector (Column 4) */}
                      <td className="px-4 py-3 md:py-4 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100/90 text-slate-700 border border-slate-200/80 whitespace-nowrap shadow-none">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          {segmentNameById[project.segmentId] || 'Unassigned'}
                        </span>
                      </td>

                      {/* Status (Column 5) */}
                      <td className="px-4 py-3 md:py-4">
                        <Badge variant="outline" className={`text-xs font-medium whitespace-nowrap ${getSupportStatusBadgeClass(supportState)}`}>
                          {formatSupportStatus(supportState)}
                        </Badge>
                      </td>

                      {/* Timeline */}
                      <td className="px-4 py-3 md:py-4 hidden xl:table-cell">
                        {project.startDate && project.endDate ? (() => {
                          const start = new Date(project.startDate);
                          const end = new Date(project.endDate);
                          const diffTime = Math.abs(end.getTime() - start.getTime());
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return (
                            <div>
                              <div className="text-xs text-gray-800 font-medium">
                                {start.toLocaleDateString()} – {end.toLocaleDateString()}
                              </div>
                              <div className="text-[11px] text-gray-500">{diffDays} days support</div>
                            </div>
                          );
                        })() : (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 md:py-4">
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
                          {isAdminRole() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={project.status === 'support_closed'}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeactivateProject(e, project);
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {project.status === 'support_closed' ? 'Closed' : 'Close'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div 
            className={`grid gap-6 ${responsive.gridCols} md:grid-cols-2 lg:grid-cols-3`}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={handleSwipe}
          >
            {currentProjects.map((project: any) => {
              const supportState = getSupportState(project);
              const companyName = project.company?.name || companyNameById[project.companyId] || project.client || '—';
              const clientEmail = project.contactEmail || project.company?.primaryContactEmail || '—';

              return (
                <Card 
                  key={project.id} 
                  className="hover:shadow-md transition-all cursor-pointer border border-gray-200/80 rounded-xl overflow-hidden bg-white" 
                  data-testid={`card-project-${project.id}`}
                  onClick={() => handleProjectClick(project.id)}
                >
                  <CardHeader className="pb-3 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold text-gray-900 truncate" data-testid={`text-project-name-${project.id}`}>
                          {project.name || project.client}
                        </CardTitle>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 truncate">
                          <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-700">{companyName}</span>
                        </p>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProjectClick(project.id);
                              }}
                              data-testid={`button-project-view-${project.id}`}
                            >
                              <ExternalLink className="h-4 w-4 text-gray-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View project details</p>
                          </TooltipContent>
                        </Tooltip>
                        {isAdminRole() && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 text-xs text-gray-600"
                            onClick={(e) => handleEditProject(e, project)}
                            data-testid={`button-project-edit-${project.id}`}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {/* Status & Sector Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={`text-xs font-medium ${getSupportStatusBadgeClass(supportState)}`} data-testid={`badge-project-status-${project.id}`}>
                        {formatSupportStatus(supportState)}
                      </Badge>
                      <Badge variant="outline" className="capitalize text-xs font-normal text-gray-600" data-testid={`badge-project-segment-${project.id}`}>
                        {segmentNameById[project.segmentId] || 'Unassigned'}
                      </Badge>
                    </div>

                    {project.description && project.description.trim() !== '' && project.description !== (project.name || project.client) && (
                      <p className="text-xs text-gray-500 line-clamp-2" data-testid={`text-project-description-${project.id}`}>
                        {project.description}
                      </p>
                    )}

                    {/* Metadata lines */}
                    <div className="space-y-1.5 text-xs text-gray-600 pt-2 border-t border-gray-100">
                      {/* Timeline */}
                      <div className="flex items-center" data-testid={`text-project-dates-${project.id}`}>
                        <Calendar className="h-3.5 w-3.5 mr-2 text-gray-400 shrink-0" />
                        <span>
                          {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'} – {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>

                      {/* Duration */}
                      {project.startDate && project.endDate && (
                        <div className="flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-2 text-gray-400 shrink-0" />
                          <span>
                            {(() => {
                              const start = new Date(project.startDate);
                              const end = new Date(project.endDate);
                              const diffTime = Math.abs(end.getTime() - start.getTime());
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              return `${diffDays} days support`;
                            })()}
                          </span>
                        </div>
                      )}

                      {/* Email */}
                      {clientEmail !== '—' && (
                        <div className="flex items-center truncate">
                          <Users className="h-3.5 w-3.5 mr-2 text-gray-400 shrink-0" />
                          <span className="truncate">{clientEmail}</span>
                        </div>
                      )}

                      {/* Manager */}
                      {project.manager && (
                        <div className="flex items-center" data-testid={`text-project-manager-${project.id}`}>
                          <Users className="h-3.5 w-3.5 mr-2 text-gray-400 shrink-0" />
                          <span>Manager: {project.manager?.firstName ? `${project.manager.firstName} ${project.manager.lastName || ''}` : project.manager?.email}</span>
                        </div>
                      )}
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
