import { useEffect, useState } from "react";
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

      // Make API request to generate export
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reportType: apiReportType,
          format: 'excel',
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
      const filename = filenameMatch?.[1] || `AppKings-Solutions-${apiReportType}-${new Date().toISOString().split('T')[0]}.xlsx`;

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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h2 className="text-3xl font-medium text-gray-900 mb-2" data-testid="text-title">Reports & Analytics</h2>
            <p className="text-gray-600" data-testid="text-subtitle">Generate comprehensive reports and analyze team performance</p>
          </div>
          <div className="flex space-x-3 mt-4 md:mt-0">
            <Button 
              onClick={() => handleExportReport('Complete')}
              className="flex items-center"
              disabled={exportingStates.complete}
              data-testid="button-export-all"
            >
              {exportingStates.complete ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {exportingStates.complete ? 'Generating...' : 'Export All'}
            </Button>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Export Reports
                </CardTitle>
                <CardDescription>Generate and download detailed reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => handleExportReport('Project Summary')}
                    className="flex items-center justify-center h-20 flex-col"
                    disabled={exportingStates.project_summary}
                    data-testid="button-export-projects"
                  >
                    {exportingStates.project_summary ? (
                      <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                    ) : (
                      <BarChart3 className="h-6 w-6 mb-2" />
                    )}
                    {exportingStates.project_summary ? 'Generating...' : 'Project Summary'}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => handleExportReport('Task List')}
                    className="flex items-center justify-center h-20 flex-col"
                    disabled={exportingStates.task_list}
                    data-testid="button-export-tasks"
                  >
                    {exportingStates.task_list ? (
                      <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                    ) : (
                      <FileText className="h-6 w-6 mb-2" />
                    )}
                    {exportingStates.task_list ? 'Generating...' : 'Milestone List'}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => handleExportReport('Team Performance')}
                    className="flex items-center justify-center h-20 flex-col"
                    disabled={exportingStates.team_performance}
                    data-testid="button-export-performance"
                  >
                    {exportingStates.team_performance ? (
                      <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                    ) : (
                      <TrendingUp className="h-6 w-6 mb-2" />
                    )}
                    {exportingStates.team_performance ? 'Generating...' : 'Team Performance'}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => handleExportReport('Workload Analysis')}
                    className="flex items-center justify-center h-20 flex-col"
                    disabled={exportingStates.workload_analysis}
                    data-testid="button-export-workload"
                  >
                    {exportingStates.workload_analysis ? (
                      <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                    ) : (
                      <Users className="h-6 w-6 mb-2" />
                    )}
                    {exportingStates.workload_analysis ? 'Generating...' : 'Workload Analysis'}
                  </Button>
                </div>
                
                {/* Add Financial Report Button */}
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => handleExportReport('Financial Report')}
                    className="flex items-center justify-center h-20 flex-col w-full md:w-auto"
                    disabled={exportingStates.financial_report}
                    data-testid="button-export-financial"
                  >
                    {exportingStates.financial_report ? (
                      <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                    ) : (
                      <Calendar className="h-6 w-6 mb-2" />
                    )}
                    {exportingStates.financial_report ? 'Generating...' : 'Financial Report'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Overview Metrics */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Project Completion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold" data-testid="text-completion-rate">{completionRate}%</span>
                    <Badge variant="outline" className="text-success">
                      {projects.filter((p: any) => p.status === 'completed').length} completed
                    </Badge>
                  </div>
                  <Progress value={completionRate} className="h-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Average Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold" data-testid="text-avg-progress">{avgProgress}%</span>
                    <Badge variant="outline" className="text-primary">
                      {projects.length} projects
                    </Badge>
                  </div>
                  <Progress value={avgProgress} className="h-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold" data-testid="text-total-tasks">{tasks.length}</span>
                    <Badge variant="outline" className="text-success">
                      {tasksByStatus.done} completed
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {tasksByStatus.in_progress} in progress, {tasksByStatus.todo} pending
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Team Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold" data-testid="text-team-count">{metrics?.teamMembers || 0}</span>
                    <Badge variant="outline" className="text-primary">
                      Active
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {workload.length} with assigned subtasks
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Task Analysis */}
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Tasks by Priority</CardTitle>
                  <CardDescription>Distribution of task priorities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(tasksByPriority).map(([priority, count]) => {
                      const percentage = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                      const priorityColors = {
                        critical: 'bg-error',
                        high: 'bg-warning',
                        medium: 'bg-primary',
                        low: 'bg-success'
                      };
                      
                      return (
                        <div key={priority} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium capitalize" data-testid={`text-priority-${priority}`}>
                              {priority} Priority
                            </span>
                            <span className="text-sm text-gray-600">{count} tasks ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${priorityColors[priority as keyof typeof priorityColors]}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tasks by Status</CardTitle>
                  <CardDescription>Current task distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(tasksByStatus).map(([status, count]) => {
                      const percentage = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                      const statusColors = {
                        todo: 'bg-gray-500',
                        in_progress: 'bg-primary',
                        client_review: 'bg-warning',
                        done: 'bg-success'
                      };
                      const statusLabels = {
                        todo: 'Not Started',
                        in_progress: 'In Progress',
                        client_review: 'Client Review',
                        done: 'Done'
                      };
                      
                      return (
                        <div key={status} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium" data-testid={`text-status-${status}`}>
                              {statusLabels[status as keyof typeof statusLabels]}
                            </span>
                            <span className="text-sm text-gray-600">{count} tasks ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${statusColors[status as keyof typeof statusColors]}`}
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
            <Card>
              <CardHeader>
                <CardTitle>Team Performance Overview</CardTitle>
                <CardDescription>Individual team member workload and performance</CardDescription>
              </CardHeader>
              <CardContent>
                {workload.length === 0 ? (
                  <div className="text-center py-8 text-gray-500" data-testid="text-no-workload">
                    No team performance data available
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workload.map((member: any) => (
                      <div key={member.userId} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`member-${member.userId}`}>
                        <div className="flex items-center space-x-3">
                          {member.user.profileImageUrl && (
                            <img 
                              src={member.user.profileImageUrl} 
                              alt="Profile" 
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium" data-testid={`text-member-name-${member.userId}`}>
                              {member.user.firstName && member.user.lastName 
                                ? `${member.user.firstName} ${member.user.lastName}`
                                : member.user.email
                              }
                            </p>
                            <p className="text-sm text-gray-600" data-testid={`text-member-role-${member.userId}`}>
                              {member.user.role}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                                                    <p className="text-sm font-medium" data-testid={`text-member-tasks-${member.userId}`}>
                          {member.completedTasks}/{member.totalTasks} subtasks
                        </p>
                            <p className="text-xs text-gray-600">
                              {member.workloadPercentage}% completion rate
                            </p>
                          </div>
                          <div className="w-24">
                            <Progress value={member.workloadPercentage} className="h-2" />
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
