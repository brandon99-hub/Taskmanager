import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Calendar, Target, ArrowUpRight, ArrowDownRight, BarChart, Table, Users, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Line, 
  Legend,
  Area,
  ComposedChart
} from 'recharts';
import GanttChart from "@/components/projects/gantt-chart";

export default function ProjectManagementHub() {
  const auth = useAuth() as any;
  const { user, getDashboardType, getSegment, isAdminRole } = auth;
  const dashboardType = getDashboardType();
  const segment = getSegment();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [timelineViewMode, setTimelineViewMode] = useState<'table' | 'chart'>('chart');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Show project management hub for project managers
  const shouldShowProjectHub = () => {
    return dashboardType === 'project_manager' || 
           isAdminRole();
  };

  if (!shouldShowProjectHub()) {
    return null;
  }

  const { data: projectData, isLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/project-performance', selectedYear, selectedMonth],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedYear) params.append('year', selectedYear.toString());
      if (selectedMonth) params.append('month', selectedMonth.toString());
      
      const url = `/api/dashboard/project-performance${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch project performance data');
      }
      
      return response.json();
    },
    enabled: !!user,
  });

  // Get projects for Gantt chart fallback
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['/api/projects'],
    enabled: !!user,
  });

  // Fetch Gantt chart data for timeline view
  const { data: ganttData, isLoading: ganttLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/gantt', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      const res = await fetch(`/api/dashboard/gantt/${selectedProjectId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch Gantt chart data');
      return res.json();
    },
    enabled: !!user && !!selectedProjectId,
  });

  // Auto-select first project when switching to chart view, clear when switching to table
  useEffect(() => {
    if (timelineViewMode === 'chart' && !selectedProjectId && projects.length > 0) {
      const activeProjects = projects.filter(p => p.status === 'active');
      if (activeProjects.length > 0) {
        setSelectedProjectId(activeProjects[0].id);
      }
    } else if (timelineViewMode === 'table') {
      setSelectedProjectId('');
    }
  }, [timelineViewMode, selectedProjectId, projects]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  // Use real data from API
  const data = projectData || {
    projects: [],
    ganttData: null,
    performanceMetrics: {
      totalProjects: 0,
      moduleProgress: 0,
      teamCapacity: 0,
      timelineHealth: 0
    }
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-500';
      case 'planning': return 'bg-blue-500';
      case 'on_hold': return 'bg-yellow-500';
      case 'completed': return 'bg-purple-500';
      case 'on_support': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return '🚀';
      case 'planning': return '📋';
      case 'on_hold': return '⏸️';
      case 'completed': return '✅';
      case 'on_support': return '🏆';
      default: return '📊';
    }
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Project Timeline & Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-32 bg-gray-200 rounded-lg"></div>
            <div className="h-48 bg-gray-200 rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Target className="h-6 w-6 text-blue-600" />
              Project Timeline & Performance
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Project management overview for {selectedYear}
              {selectedMonth ? ` - ${months.find(m => m.value === selectedMonth)?.label}` : ''}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={selectedMonth?.toString() || 'all'} 
              onValueChange={(value) => setSelectedMonth(value === 'all' ? undefined : parseInt(value))}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {months.map(month => (
                  <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-700">Total Projects</p>
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-900 mb-1">
                {data.performanceMetrics.totalProjects}
              </p>
              <p className="text-sm text-blue-600">
                Active projects in portfolio
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-green-500 bg-green-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-green-700">Module Progress</p>
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-900 mb-1">
                {formatPercentage(data.performanceMetrics.moduleProgress)}
              </p>
              <p className="text-sm text-green-600">
                Overall completion rate
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-orange-500 bg-orange-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-orange-700">Team Capacity</p>
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-orange-900 mb-1">
                {formatPercentage(data.performanceMetrics.teamCapacity)}
              </p>
              <p className="text-sm text-orange-600">
                Resource utilization
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 bg-purple-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-purple-700">Timeline Health</p>
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-purple-900 mb-1">
                {formatPercentage(data.performanceMetrics.timelineHealth)}
              </p>
              <p className="text-sm text-purple-600">
                On-time delivery rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Timeline & Performance */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
              <Calendar className="h-5 w-5 text-blue-600" />
              Project Timeline & Status
              {selectedMonth && (
                <span className="text-sm font-normal text-gray-600">
                  - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                </span>
              )}
            </h3>
            
            {/* Project Selector and View Toggle */}
            <div className="flex items-center gap-4">
              {/* Project Selector for Gantt Chart */}
              {timelineViewMode === 'chart' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Project:</span>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a project for timeline view" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.filter(p => p.status === 'active').map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* View Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">View:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setTimelineViewMode('table')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    timelineViewMode === 'table' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Table className="h-4 w-4" />
                  Table
                </button>
                                 <button
                   onClick={() => setTimelineViewMode('chart')}
                   className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                     timelineViewMode === 'chart' 
                       ? 'bg-white text-gray-900 shadow-sm' 
                       : 'text-gray-600 hover:text-gray-900'
                   }`}
                 >
                   <BarChart className="h-4 w-4" />
                   Timeline
                 </button>
                 </div>
               </div>
             </div>
           </div>
          
          {!data.projects || data.projects.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-500">
                  <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No projects available</p>
                  <p className="text-sm">Project timeline will appear here once projects are created.</p>
                </div>
              </CardContent>
            </Card>
          ) : timelineViewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-3 font-semibold text-gray-700 bg-gray-50">Project</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-blue-50">Status</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-green-50">Progress</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-purple-50">Team</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-yellow-50">Budget</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-indigo-50">Manager</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-orange-50">Timeline</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-red-50">Risk Level</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-gray-50">Segment</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((project: any, index: number) => (
                    <tr key={project.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 border-b border-gray-100">
                        <div>
                          <p className="font-medium text-gray-900">{project.name}</p>
                          <p className="text-sm text-gray-500">{project.client || 'No client'}</p>
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <Badge variant="outline" className="flex items-center gap-1 w-fit mx-auto">
                          <span>{getStatusIcon(project.status)}</span>
                          {project.status}
                        </Badge>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <div className="flex items-center gap-2">
                          <Progress value={project.progress || 0} className="flex-1" />
                          <span className="text-sm font-medium">{project.progress || 0}%</span>
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <span className="text-sm font-medium">{project.team?.name || 'Unassigned'}</span>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            {project.budget ? `KSh ${Number(project.budget).toLocaleString()}` : 'Not set'}
                          </p>
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            {project.manager?.firstName && project.manager?.lastName 
                              ? `${project.manager.firstName} ${project.manager.lastName}`
                              : project.manager?.email || 'Unassigned'
                            }
                          </p>
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <div className="text-sm">
                          <p className="text-gray-600">
                            {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'No start'}
                          </p>
                          <p className="text-gray-600">
                            {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'No deadline'}
                          </p>
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <Badge 
                          variant={project.progress > 80 ? "default" : project.progress > 50 ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {project.progress > 80 ? 'Low' : project.progress > 50 ? 'Medium' : 'High'}
                        </Badge>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <Badge variant="outline" className="text-xs">
                          {project.segment ? project.segment.charAt(0).toUpperCase() + project.segment.slice(1) : 'Private'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // Gantt Chart View
            <div className="min-h-96">
              {ganttLoading ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-lg font-medium">Loading Timeline...</p>
                      <p className="text-sm">Fetching project timeline data</p>
                    </div>
                  </CardContent>
                </Card>
              ) : !selectedProjectId ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">Select a Project</p>
                      <p className="text-sm">Choose a project from the dropdown above to view its timeline.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : ganttData && (ganttData.phases.length > 0 || ganttData.tasks.length > 0) ? (
                <GanttChart 
                  data={ganttData}
                  onPhaseClick={(phaseId) => console.log('Phase clicked:', phaseId)}
                  onTaskClick={(taskId) => console.log('Task clicked:', taskId)}
                />
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No Timeline Data Available</p>
                      <p className="text-sm">This project doesn't have phases and modules yet.</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Switch to Table view to see current project status.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}