import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, BarChart3, TrendingUp, Users, Ticket, Loader2 } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import PageHeader from "@/components/layout/page-header";
import ReportCard from "@/components/reports/report-card";

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

  const { data: teamPerformance = [], isLoading: teamPerformanceLoading, error: teamPerformanceError } = useQuery<any[]>({
    queryKey: ['/api/dashboard/team-performance'],
    enabled: !!isAuthenticated,
  });

  useEffect(() => {
    const errors = [metricsError, projectsError, teamPerformanceError].filter(Boolean);
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
  }, [metricsError, projectsError, teamPerformanceError, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isDataLoading = metricsLoading || projectsLoading || teamPerformanceLoading;

  const handleViewReport = (reportType: string) => {
    // Map display names to URL report types
    const reportTypeMap: Record<string, string> = {
      'Project Summary': 'projects',
      'Task List': 'milestones',
      'Team Performance': 'performance',
      'Workload Analysis': 'workload',
      'Tickets Report': 'tickets',
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
        'Tickets Report': 'tickets',
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
      const filename = filenameMatch?.[1] || `Ecorenet-Business-Solutions-${apiReportType}-${new Date().toISOString().split('T')[0]}.${fileExtension}`;

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

  return (
    <div className="min-h-screen bg-background-page">
      
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        <PageHeader
          icon={BarChart3}
          title="Reports & Analytics"
          description="Generate comprehensive reports and analyze team performance"
          actions={
            <Button
              onClick={() => handleExportReport('Complete')}
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
          }
        />

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

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ReportCard
                icon={BarChart3}
                title="Project Summary"
                description="Overview of all projects and their status"
                onViewDetails={() => handleViewReport('Project Summary')}
                onExportPdf={() => handleExportReport('Project Summary')}
                isExporting={exportingStates.project_summary}
                testIdSuffix="projects"
              />
              <ReportCard
                icon={TrendingUp}
                title="Team Performance"
                description="Ticket resolution performance by team"
                onViewDetails={() => handleViewReport('Team Performance')}
                onExportPdf={() => handleExportReport('Team Performance')}
                isExporting={exportingStates.team_performance}
                testIdSuffix="performance"
              />
              <ReportCard
                icon={Users}
                title="Workload Analysis"
                description="Individual ticket workload by team member"
                onViewDetails={() => handleViewReport('Workload Analysis')}
                onExportPdf={() => handleExportReport('Workload Analysis')}
                isExporting={exportingStates.workload_analysis}
                testIdSuffix="workload"
              />
              <ReportCard
                icon={Ticket}
                title="Tickets Report"
                description="Support ticket volume, status and resolution times"
                onViewDetails={() => handleViewReport('Tickets Report')}
                onExportPdf={() => handleExportReport('Tickets Report')}
                isExporting={exportingStates.tickets_report}
                testIdSuffix="tickets"
              />
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
                <CardDescription className="text-gray-600 text-base">Ticket resolution performance for each team</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {teamPerformance.length === 0 ? (
                  <div className="text-center py-12 text-gray-500" data-testid="text-no-team-performance">
                    <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Users className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-lg font-medium">No team performance data available</p>
                    <p className="text-sm">Teams will appear here once they exist and have assigned tickets</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {teamPerformance.map((team: any) => (
                      <div key={team.id} className="group flex items-center justify-between p-6 border border-gray-200 rounded-xl hover:border-accent-brand hover:shadow-lg transition-all duration-300 bg-white" data-testid={`team-${team.id}`}>
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-300">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-lg" data-testid={`text-team-name-${team.id}`}>
                              {team.name}
                            </p>
                            <p className="text-sm text-gray-600 font-medium" data-testid={`text-team-members-${team.id}`}>
                              {team.memberCount} member{team.memberCount === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900" data-testid={`text-team-tickets-${team.id}`}>
                              {team.totalTickets || 0}
                            </p>
                            <p className="text-sm text-gray-600">Total Tickets</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">
                              {team.resolvedTickets || 0}
                            </p>
                            <p className="text-sm text-gray-600">Resolved</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-accent-brand">
                              {team.resolutionRate || 0}%
                            </p>
                            <p className="text-sm text-gray-600">Resolution Rate</p>
                          </div>
                          <div className="w-24">
                            <Progress value={team.resolutionRate} className="h-3 bg-gray-200" />
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
