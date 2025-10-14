import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, BarChart3, TrendingUp, Users, Calendar, Loader2 } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";

export default function Reports() {
  const [, setLocation] = useLocation();
  const auth = useAuth() as any;
  const { isAuthenticated, isLoading } = auth;
  const { toast } = useToast();
  
  // Loading states for exports
  const [exportingStates, setExportingStates] = useState<Record<string, boolean>>({});

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

  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery<any>({
    queryKey: ['/api/dashboard/metrics'],
    enabled: !!isAuthenticated,
  });

  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useQuery<any[]>({
    queryKey: ['/api/projects'],
    enabled: !!isAuthenticated,
  });

  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useQuery<any[]>({
    queryKey: ['/api/tasks'],
    enabled: !!isAuthenticated,
  });

  const { data: workload = [], isLoading: workloadLoading, error: workloadError } = useQuery<any[]>({
    queryKey: ['/api/dashboard/workload'],
    enabled: !!isAuthenticated,
  });

  useEffect(() => {
    const errors = [metricsError, projectsError, tasksError, workloadError].filter(Boolean);
    errors.forEach(error => {
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
    });
  }, [metricsError, projectsError, tasksError, workloadError, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isDataLoading = metricsLoading || projectsLoading || tasksLoading || workloadLoading;

  const handleViewReport = (reportType: string) => {
    // Map display names to URL report types
    const reportTypeMap: Record<string, string> = {
      'Project Summary': 'projects',
      'Task List': 'milestones', 
      'Team Performance': 'performance',
      'Workload Analysis': 'workload',
      'Financial Report': 'financial',
      'Complete': 'complete',
      'Gantt Chart': 'gantt'
    };

    const urlReportType = reportTypeMap[reportType] || reportType.toLowerCase();
    setLocation(`/reports/detail?type=${urlReportType}`);
  };

  const handleExportReport = async (reportType: string) => {
    const exportKey = reportType.toLowerCase().replace(/\s+/g, '_');
    
    try {
      setExportingStates(prev => ({ ...prev, [exportKey]: true }));
      
      toast({
        title: "Export Started",
        description: `Generating ${reportType} report...`,
      });

      // Map display names to API report types
      const reportTypeMap: Record<string, string> = {
        'Project Summary': 'projects',
        'Task List': 'milestones', 
        'Team Performance': 'performance',
        'Workload Analysis': 'workload',
        'Financial Report': 'financial',
        'Complete': 'complete',
        'Gantt Chart': 'gantt'
      };

      const apiReportType = reportTypeMap[reportType] || reportType.toLowerCase();
      
      // Use PDF format for all reports except Gantt Chart
      const exportFormat = reportType === 'Gantt Chart' ? 'excel' : 'pdf';
      const fileExtension = exportFormat === 'pdf' ? 'pdf' : 'xlsx';

      // Make API request to generate export
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reportType: apiReportType,
          format: exportFormat,
          filters: {}
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Export failed');
      }

      // Get the filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `AppKings-Solutions-${apiReportType}-${new Date().toISOString().split('T')[0]}.${fileExtension}`;

      // Convert response to blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `${reportType} report downloaded successfully!`,
      });

    } catch (error: any) {
      console.error('Export error:', error);
      
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
        title: "Export Failed",
        description: error.message || `Failed to export ${reportType} report`,
        variant: "destructive",
      });
    } finally {
      setExportingStates(prev => ({ ...prev, [exportKey]: false }));
    }
  };

  // Calculate additional metrics
  const completionRate = projects.length > 0 
    ? Math.round((projects.filter((p: any) => p.status === 'completed').length / projects.length) * 100)
    : 0;

  const avgProgress = projects.length > 0
    ? Math.round(projects.reduce((sum: number, p: any) => sum + p.progress, 0) / projects.length)
    : 0;

  const tasksByPriority = {
    critical: tasks.filter((t: any) => t.priority === 'critical').length,
    high: tasks.filter((t: any) => t.priority === 'high').length,
    medium: tasks.filter((t: any) => t.priority === 'medium').length,
    low: tasks.filter((t: any) => t.priority === 'low').length,
  };

  const tasksByStatus = {
    todo: tasks.filter((t: any) => t.status === 'todo').length,
    in_progress: tasks.filter((t: any) => t.status === 'in_progress').length,
                            client_review: tasks.filter((t: any) => t.status === 'client_review').length,
    done: tasks.filter((t: any) => t.status === 'done').length,
  };

  return (
    <div className="min-h-screen bg-background-page">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 rounded-2xl mb-8">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative px-8 py-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div className="text-white">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <BarChart3 className="h-8 w-8 text-white" />
                  </div>
          <div>
                    <h2 className="text-4xl font-bold mb-2" data-testid="text-title">Reports & Analytics</h2>
                    <p className="text-blue-100 text-lg" data-testid="text-subtitle">Generate comprehensive reports and analyze team performance</p>
                  </div>
                </div>
          </div>
              <div className="flex space-x-3 mt-6 md:mt-0">
            <Button 
              onClick={() => handleExportReport('Complete')}
                  className="flex items-center bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
              disabled={exportingStates.complete}
              data-testid="button-export-all"
            >
              {exportingStates.complete ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
                  {exportingStates.complete ? 'Generating...' : 'Export All Reports'}
            </Button>
              </div>
            </div>
          </div>
        </div>

        {isDataLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-8 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Export Options */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
                <CardTitle className="flex items-center text-2xl font-bold text-gray-800">
                  <div className="p-2 bg-primary/10 rounded-lg mr-3">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  Report Generation Center
                </CardTitle>
                <CardDescription className="text-gray-600 text-base mt-2">
                  Choose a report type to view detailed data or export to professional PDF format
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="group relative bg-white rounded-xl border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all duration-300 overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-center justify-center mb-4">
                        <div className="p-3 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                          <BarChart3 className="h-8 w-8 text-blue-600" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Project Summary</h3>
                      <p className="text-sm text-gray-600 text-center mb-4">Overview of all projects and their status</p>
                      <div className="space-y-2">
                        <Button 
                          onClick={() => handleViewReport('Project Summary')}
                          className="w-full bg-primary hover:bg-primary/90 text-white font-medium"
                          data-testid="button-view-projects"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                  <Button 
                    variant="outline" 
                          size="sm"
                    onClick={() => handleExportReport('Project Summary')}
                          className="w-full border-gray-300 hover:border-primary hover:bg-primary/5"
                    disabled={exportingStates.project_summary}
                    data-testid="button-export-projects"
                  >
                    {exportingStates.project_summary ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                            <Download className="h-4 w-4 mr-2" />
                    )}
                          {exportingStates.project_summary ? 'Exporting...' : 'Export PDF'}
                  </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="group relative bg-white rounded-xl border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all duration-300 overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-center justify-center mb-4">
                        <div className="p-3 bg-green-100 rounded-full group-hover:bg-green-200 transition-colors">
                          <FileText className="h-8 w-8 text-green-600" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Milestone List</h3>
                      <p className="text-sm text-gray-600 text-center mb-4">Detailed list of all project milestones</p>
                      <div className="space-y-2">
                        <Button 
                          onClick={() => handleViewReport('Task List')}
                          className="w-full bg-primary hover:bg-primary/90 text-white font-medium"
                          data-testid="button-view-tasks"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                  <Button 
                    variant="outline" 
                          size="sm"
                    onClick={() => handleExportReport('Task List')}
                          className="w-full border-gray-300 hover:border-primary hover:bg-primary/5"
                    disabled={exportingStates.task_list}
                    data-testid="button-export-tasks"
                  >
                    {exportingStates.task_list ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                            <Download className="h-4 w-4 mr-2" />
                    )}
                          {exportingStates.task_list ? 'Exporting...' : 'Export PDF'}
                  </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="group relative bg-white rounded-xl border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all duration-300 overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-center justify-center mb-4">
                        <div className="p-3 bg-purple-100 rounded-full group-hover:bg-purple-200 transition-colors">
                          <TrendingUp className="h-8 w-8 text-purple-600" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Team Performance</h3>
                      <p className="text-sm text-gray-600 text-center mb-4">Individual team member performance metrics</p>
                      <div className="space-y-2">
                        <Button 
                          onClick={() => handleViewReport('Team Performance')}
                          className="w-full bg-primary hover:bg-primary/90 text-white font-medium"
                          data-testid="button-view-performance"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                  <Button 
                    variant="outline" 
                          size="sm"
                    onClick={() => handleExportReport('Team Performance')}
                          className="w-full border-gray-300 hover:border-primary hover:bg-primary/5"
                    disabled={exportingStates.team_performance}
                    data-testid="button-export-performance"
                  >
                    {exportingStates.team_performance ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                            <Download className="h-4 w-4 mr-2" />
                    )}
                          {exportingStates.team_performance ? 'Exporting...' : 'Export PDF'}
                  </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="group relative bg-white rounded-xl border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all duration-300 overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-center justify-center mb-4">
                        <div className="p-3 bg-orange-100 rounded-full group-hover:bg-orange-200 transition-colors">
                          <Users className="h-8 w-8 text-orange-600" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Workload Analysis</h3>
                      <p className="text-sm text-gray-600 text-center mb-4">Team workload distribution and analysis</p>
                      <div className="space-y-2">
                        <Button 
                          onClick={() => handleViewReport('Workload Analysis')}
                          className="w-full bg-primary hover:bg-primary/90 text-white font-medium"
                          data-testid="button-view-workload"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                  <Button 
                    variant="outline" 
                          size="sm"
                    onClick={() => handleExportReport('Workload Analysis')}
                          className="w-full border-gray-300 hover:border-primary hover:bg-primary/5"
                    disabled={exportingStates.workload_analysis}
                    data-testid="button-export-workload"
                  >
                    {exportingStates.workload_analysis ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                            <Download className="h-4 w-4 mr-2" />
                    )}
                          {exportingStates.workload_analysis ? 'Exporting...' : 'Export PDF'}
                  </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Financial Report Card */}
                <div className="mt-8">
                  <div className="group relative bg-white rounded-xl border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all duration-300 overflow-hidden max-w-md mx-auto">
                    <div className="p-6">
                      <div className="flex items-center justify-center mb-4">
                        <div className="p-3 bg-emerald-100 rounded-full group-hover:bg-emerald-200 transition-colors">
                          <Calendar className="h-8 w-8 text-emerald-600" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Financial Report</h3>
                      <p className="text-sm text-gray-600 text-center mb-4">Financial overview and milestone billing</p>
                      <div className="space-y-2">
                        <Button 
                          onClick={() => handleViewReport('Financial Report')}
                          className="w-full bg-primary hover:bg-primary/90 text-white font-medium"
                          data-testid="button-view-financial"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                  <Button 
                    variant="outline" 
                          size="sm"
                    onClick={() => handleExportReport('Financial Report')}
                          className="w-full border-gray-300 hover:border-primary hover:bg-primary/5"
                    disabled={exportingStates.financial_report}
                    data-testid="button-export-financial"
                  >
                    {exportingStates.financial_report ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                            <Download className="h-4 w-4 mr-2" />
                    )}
                          {exportingStates.financial_report ? 'Exporting...' : 'Export PDF'}
                  </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overview Metrics */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-blue-800">Project Completion Rate</CardTitle>
                    <div className="p-2 bg-blue-200 rounded-lg">
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl font-bold text-blue-900" data-testid="text-completion-rate">{completionRate}%</span>
                    <Badge variant="secondary" className="bg-blue-200 text-blue-800 border-blue-300">
                      {projects.filter((p: any) => p.status === 'completed').length} completed
                    </Badge>
                  </div>
                  <Progress value={completionRate} className="h-3 bg-blue-200" />
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-green-800">Average Progress</CardTitle>
                    <div className="p-2 bg-green-200 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl font-bold text-green-900" data-testid="text-avg-progress">{avgProgress}%</span>
                    <Badge variant="secondary" className="bg-green-200 text-green-800 border-green-300">
                      {projects.length} projects
                    </Badge>
                  </div>
                  <Progress value={avgProgress} className="h-3 bg-green-200" />
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-purple-800">Total Tasks</CardTitle>
                    <div className="p-2 bg-purple-200 rounded-lg">
                      <FileText className="h-4 w-4 text-purple-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl font-bold text-purple-900" data-testid="text-total-tasks">{tasks.length}</span>
                    <Badge variant="secondary" className="bg-purple-200 text-purple-800 border-purple-300">
                      {tasksByStatus.done} completed
                    </Badge>
                  </div>
                  <div className="text-sm text-purple-700">
                    {tasksByStatus.in_progress} in progress, {tasksByStatus.todo} pending
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-orange-800">Team Members</CardTitle>
                    <div className="p-2 bg-orange-200 rounded-lg">
                      <Users className="h-4 w-4 text-orange-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl font-bold text-orange-900" data-testid="text-team-count">{metrics?.teamMembers || 0}</span>
                    <Badge variant="secondary" className="bg-orange-200 text-orange-800 border-orange-300">
                      Active
                    </Badge>
                  </div>
                  <div className="text-sm text-orange-700">
                    {workload.length} with assigned subtasks
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Task Analysis */}
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
                  <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg mr-3">
                      <BarChart3 className="h-5 w-5 text-red-600" />
                    </div>
                    Tasks by Priority
                  </CardTitle>
                  <CardDescription className="text-gray-600">Distribution of task priorities across all projects</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {Object.entries(tasksByPriority).map(([priority, count]) => {
                      const percentage = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                      const priorityColors = {
                        critical: 'bg-red-500',
                        high: 'bg-orange-500',
                        medium: 'bg-blue-500',
                        low: 'bg-green-500'
                      };
                      const priorityLabels = {
                        critical: 'Critical',
                        high: 'High',
                        medium: 'Medium',
                        low: 'Low'
                      };
                      
                      return (
                        <div key={priority} className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-700 capitalize" data-testid={`text-priority-${priority}`}>
                              {priorityLabels[priority as keyof typeof priorityLabels]} Priority
                            </span>
                            <span className="text-sm font-bold text-gray-600">{count} tasks ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                              className={`h-3 rounded-full transition-all duration-500 ${priorityColors[priority as keyof typeof priorityColors]}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
                  <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                    Tasks by Status
                  </CardTitle>
                  <CardDescription className="text-gray-600">Current task distribution across all projects</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {Object.entries(tasksByStatus).map(([status, count]) => {
                      const percentage = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                      const statusColors = {
                        todo: 'bg-gray-500',
                        in_progress: 'bg-blue-500',
                        client_review: 'bg-yellow-500',
                        done: 'bg-green-500'
                      };
                      const statusLabels = {
                        todo: 'Not Started',
                        in_progress: 'In Progress',
                        client_review: 'Client Review',
                        done: 'Done'
                      };
                      
                      return (
                        <div key={status} className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-700" data-testid={`text-status-${status}`}>
                              {statusLabels[status as keyof typeof statusLabels]}
                            </span>
                            <span className="text-sm font-bold text-gray-600">{count} tasks ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                              className={`h-3 rounded-full transition-all duration-500 ${statusColors[status as keyof typeof statusColors]}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Team Performance */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
                <CardTitle className="text-2xl font-bold text-gray-800 flex items-center">
                  <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                    <Users className="h-6 w-6 text-indigo-600" />
                  </div>
                  Team Performance Overview
                </CardTitle>
                <CardDescription className="text-gray-600 text-base">Individual team member workload and performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {workload.length === 0 ? (
                  <div className="text-center py-12 text-gray-500" data-testid="text-no-workload">
                    <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Users className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-lg font-medium">No team performance data available</p>
                    <p className="text-sm">Team members will appear here once they have assigned subtasks</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workload.map((member: any) => (
                      <div key={member.userId} className="group flex items-center justify-between p-6 border border-gray-200 rounded-xl hover:border-primary/30 hover:shadow-lg transition-all duration-300 bg-white" data-testid={`member-${member.userId}`}>
                        <div className="flex items-center space-x-4">
                          {member.user.profileImageUrl ? (
                            <img 
                              src={member.user.profileImageUrl} 
                              alt="Profile" 
                              className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 group-hover:border-primary/30 transition-colors"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-300">
                              <span className="text-lg font-bold text-primary">
                                {member.user.firstName?.charAt(0) || member.user.email?.charAt(0) || '?'}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900 text-lg" data-testid={`text-member-name-${member.userId}`}>
                              {member.user.firstName && member.user.lastName 
                                ? `${member.user.firstName} ${member.user.lastName}`
                                : member.user.email
                              }
                            </p>
                            <p className="text-sm text-gray-600 font-medium" data-testid={`text-member-role-${member.userId}`}>
                              {member.user.role}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900" data-testid={`text-member-tasks-${member.userId}`}>
                              {member.totalTasks || 0}
                            </p>
                            <p className="text-sm text-gray-600">Total Tasks</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">
                              {member.completedTasks || 0}
                            </p>
                            <p className="text-sm text-gray-600">Completed</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-primary">
                              {member.workloadPercentage || 0}%
                            </p>
                            <p className="text-sm text-gray-600">Complete</p>
                          </div>
                          <div className="w-24">
                            <Progress value={member.workloadPercentage} className="h-3 bg-gray-200" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
