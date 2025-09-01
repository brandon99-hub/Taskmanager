import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Target, 
  Calendar, 
  Search, 
  Download, 
  ZoomIn, 
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface GanttData {
  project: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  phases: Array<{
    id: string;
    phaseNumber: number;
    name: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
    progress: number;
  }>;
  tasks: Array<{
    id: string;
    name: string;
    startDate: string | null;
    dueDate: string | null;
    status: string;
    progress: number;
    priority: string;
    phaseNumber?: number;
    subtasks?: Array<{
      id: string;
      name: string;
      startDate: string | null;
      dueDate: string | null;
      status: string;
    }>;
  }>;
}

interface GanttChartProps {
  data: GanttData;
  onTaskClick?: (taskId: string) => void;
  onPhaseClick?: (phaseId: string) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
    case 'done':
      return 'bg-emerald-500';
    case 'in_progress':
      return 'bg-blue-500';
    case 'on_hold':
      return 'bg-amber-500';
    case 'overdue':
      return 'bg-red-500';
    case 'todo':
    case 'not_started':
      return 'bg-slate-400';
    default:
      return 'bg-indigo-500';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical':
      return 'border-red-500 bg-red-50 text-red-700';
    case 'high':
      return 'border-orange-500 bg-orange-50 text-orange-700';
    case 'medium':
      return 'border-blue-500 bg-blue-50 text-blue-700';
    case 'low':
      return 'border-gray-500 bg-gray-50 text-gray-700';
    default:
      return 'border-indigo-500 bg-indigo-50 text-indigo-700';
  }
};

export default function GanttChart({ data, onTaskClick, onPhaseClick }: GanttChartProps) {
  const { toast } = useToast();
  const [zoom, setZoom] = useState(0.5);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedView, setSelectedView] = useState<'timeline' | 'list'>('timeline');
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [exportLoading, setExportLoading] = useState(false);

  const toggleMilestoneExpansion = (milestoneId: string) => {
    setExpandedMilestones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(milestoneId)) {
        newSet.delete(milestoneId);
      } else {
        newSet.add(milestoneId);
      }
      return newSet;
    });
  };

  // Export Gantt chart to Excel
  const handleExportGantt = async () => {
    try {
      setExportLoading(true);
      
      toast({
        title: "Export Started",
        description: "Generating Gantt chart timeline export...",
      });

      // Make API request to generate export
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reportType: 'gantt',
          format: 'excel',
          filters: {
            projectId: data.project.id
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Export failed');
      }

      // Get the filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/); 
      const filename = filenameMatch?.[1] || `Gantt-Timeline-${data.project.name}-${new Date().toISOString().split('T')[0]}.xlsx`;

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
        description: "Gantt chart timeline downloaded successfully!",
      });

    } catch (error: any) {
      console.error('Export error:', error);
      
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export Gantt chart",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

  // Get phase name for a task
  const getPhaseName = (phaseNumber: number | undefined) => {
    if (!phaseNumber) return 'Unassigned';
    const phase = data.phases.find(p => p.phaseNumber === phaseNumber);
    return phase ? phase.name : `Phase ${phaseNumber}`;
  };

  // Get phase color for visual distinction
  const getPhaseColor = (phaseNumber: number | undefined) => {
    if (!phaseNumber) return 'bg-gray-100 text-gray-600';
    
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-green-100 text-green-700', 
      'bg-purple-100 text-purple-700',
      'bg-orange-100 text-orange-700',
      'bg-pink-100 text-pink-700',
      'bg-indigo-100 text-indigo-700'
    ];
    
    return colors[(phaseNumber - 1) % colors.length];
  };

  // Calculate timeline dimensions
  const timelineData = useMemo(() => {
    if (!data.project.startDate || !data.project.endDate) return null;

    const projectStart = new Date(data.project.startDate);
    const projectEnd = new Date(data.project.endDate);
    
    if (isNaN(projectStart.getTime()) || isNaN(projectEnd.getTime())) {
      return null;
    }

    const totalDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
    const dayWidth = 40 * zoom; // Base width per day, adjustable with zoom

    return {
      projectStart,
      projectEnd,
      totalDays,
      dayWidth,
      containerWidth: totalDays * dayWidth + 400 + (7 * dayWidth), // 400px for wider milestone labels + offset
      weekWidth: 7 * dayWidth, // Width of each week column
      timelineOffset: 7 * dayWidth // Offset to move Week 1 to where Week 2 currently is
    };
  }, [data.project.startDate, data.project.endDate, zoom]) as {
    projectStart: Date;
    projectEnd: Date;
    totalDays: number;
    dayWidth: number;
    containerWidth: number;
    weekWidth: number;
    timelineOffset: number;
  } | null;

  // Filter tasks based on search and status
  const filteredTasks = useMemo(() => {
    let tasks = data.tasks;
    
    if (statusFilter !== 'all') {
      tasks = tasks.filter(task => task.status === statusFilter);
    }
    
    if (searchTerm) {
      tasks = tasks.filter(task => 
        task.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return tasks;
  }, [data.tasks, statusFilter, searchTerm]);

  // Get position for a date on the timeline
  const getDatePosition = (date: string | null) => {
    if (!date || !timelineData) return 0;
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) return 0;
    
    const daysDiff = Math.ceil((targetDate.getTime() - timelineData.projectStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysDiff * timelineData.dayWidth);
  };

  // Get start position for milestone - SIMPLE positioning
  const getMilestoneStartPosition = (milestone: GanttData['tasks'][0]) => {
    if (milestone.startDate) {
      return getDatePosition(milestone.startDate);
    }
    // If no start date, position based on phase number
    if (milestone.phaseNumber && timelineData) {
      const phaseIndex = milestone.phaseNumber - 1;
      const daysPerPhase = Math.ceil(timelineData.totalDays / 6);
      const startDays = phaseIndex * daysPerPhase;
      return startDays * timelineData.dayWidth;
    }
    // Default to 0 for proper alignment with week headers
    return 0;
  };

  // Get width for a task based on start and due dates
  const getTaskWidth = (startDate: string | null, dueDate: string | null) => {
    if (!startDate || !dueDate || !timelineData) {
      // Default width for milestones without dates - make them visible
      return 120;
    }
    
    const start = new Date(startDate);
    const end = new Date(dueDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 120; // Default width for invalid dates
    }
    
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(30, daysDiff * timelineData.dayWidth);
  };

  // Generate timeline markers (weeks) - FIXED to align with timeline bars
  const timelineMarkers = useMemo(() => {
    if (!timelineData) return [];
    
    const markers: Array<{
      week: number;
      date: Date;
      position: number;
    }> = [];
    const totalWeeks = Math.ceil(timelineData.totalDays / 7);
    
    for (let i = 0; i <= totalWeeks; i++) {
      const weekStart = new Date(timelineData.projectStart);
      weekStart.setDate(weekStart.getDate() + (i * 7));
      markers.push({
        week: i + 1,
        date: weekStart,
        // Week 1 starts at the offset position (where Week 2 currently is)
        position: (i * 7 * timelineData.dayWidth) + timelineData.timelineOffset
      });
    }
    
    return markers;
  }, [timelineData]);

  // Generate daily markers for detailed timeline
  const dailyMarkers = useMemo(() => {
    if (!timelineData) return [];
    
    const markers: Array<{
      day: number;
      date: Date;
      position: number;
      isWeekend: boolean;
    }> = [];
    
    for (let i = 0; i <= timelineData.totalDays; i++) {
      const dayDate = new Date(timelineData.projectStart);
      dayDate.setDate(dayDate.getDate() + i);
      
      markers.push({
        day: i + 1,
        date: dayDate,
        position: (i * timelineData.dayWidth) + timelineData.timelineOffset,
        isWeekend: dayDate.getDay() === 0 || dayDate.getDay() === 6 // Sunday or Saturday
      });
    }
    
    return markers;
  }, [timelineData]);

  if (!timelineData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gantt Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Cannot render Gantt chart: Invalid project dates</p>
            <p className="text-sm mt-2">Please ensure the project has valid start and end dates.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Project Timeline - Gantt Chart
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Visualize project timeline and milestones
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* View Toggle */}
            <Select value={selectedView} onValueChange={(value: 'timeline' | 'list') => setSelectedView(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timeline">Timeline View</SelectItem>
                <SelectItem value="list">List View</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Completed</SelectItem>
              </SelectContent>
            </Select>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600 px-2">{Math.round(zoom * 100)}%</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom(prev => Math.min(2, prev + 0.2))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(1)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Button 
              size="sm" 
              variant="outline"
              onClick={handleExportGantt}
              disabled={exportLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              {exportLoading ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-4 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search milestones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="text-sm text-gray-600">
            <span className="font-medium">Start:</span> {timelineData.projectStart.toLocaleDateString()}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">End:</span> {timelineData.projectEnd.toLocaleDateString()}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Duration:</span> {timelineData.totalDays} days
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {selectedView === 'timeline' ? (
          /* Timeline View */
          <div className="overflow-x-auto">
            <div 
              className="relative min-w-full"
              style={{ width: timelineData.containerWidth }}
            >
              {/* Timeline Header */}
              <div className="sticky top-0 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 z-10 shadow-sm">
                <div className="flex">
                  {/* Labels Column - WIDER to cover milestone names completely */}
                  <div className="w-96 bg-gradient-to-b from-blue-50 to-white border-r border-gray-200 p-3">
                    <div className="text-sm font-semibold text-blue-700">Milestones</div>
                  </div>
                  
                  {/* Timeline Grid - Starts exactly where milestone bars begin */}
                  <div className="flex-1 relative">
                    {/* Weekly Markers - Top row with week numbers and dates */}
                    <div className="flex" style={{ height: '44px' }}>
                      {timelineMarkers.map((marker) => (
                        <div
                          key={marker.week}
                          className="border-r border-gray-200 text-center text-xs text-gray-600 p-1 bg-gradient-to-b from-gray-50 to-white flex flex-col justify-center"
                          style={{ 
                            width: 7 * timelineData.dayWidth,
                            minWidth: 7 * timelineData.dayWidth,
                            position: 'relative'
                          }}
                        >
                          <div className="font-semibold text-gray-800">Week {marker.week}</div>
                          <div className="text-gray-500">{marker.date.toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Daily Markers - Bottom row with day numbers */}
                    <div className="flex" style={{ height: '24px' }}>
                      {dailyMarkers.map((marker) => (
                        <div
                          key={`day-${marker.day}`}
                          className={`text-center text-xs border-r border-gray-100 flex items-center justify-center ${
                            marker.isWeekend ? 'bg-gray-100 text-gray-500' : 'bg-white text-gray-700'
                          }`}
                          style={{ 
                            width: timelineData.dayWidth,
                            minWidth: timelineData.dayWidth,
                            position: 'relative'
                          }}
                        >
                          <div className="font-medium">{marker.date.getDate()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Content */}
              <div className="space-y-0">
                {filteredTasks.map((task) => {
                  const x = getMilestoneStartPosition(task);
                  const width = getTaskWidth(task.startDate, task.dueDate);
                  
                  return (
                    <div key={task.id}>
                      {/* Main Milestone Row */}
                      <div className="flex items-center h-16 border-b border-gray-100">
                        {/* Task Label - WIDER to match header */}
                        <div className="w-96 bg-white border-r border-gray-200 p-3 flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleMilestoneExpansion(task.id)}
                              className={`transition-colors ${
                                task.subtasks && task.subtasks.length > 0 
                                  ? 'text-gray-500 hover:text-gray-700' 
                                  : 'text-gray-300 cursor-not-allowed'
                              }`}
                              disabled={!task.subtasks || task.subtasks.length === 0}
                            >
                              {expandedMilestones.has(task.id) ? '▼' : '▶'}
                            </button>
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(task.status)} shadow-sm`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {task.name}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getPhaseColor(task.phaseNumber)}`}
                              >
                                {getPhaseName(task.phaseNumber)}
                              </Badge>
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getPriorityColor(task.priority)}`}
                          >
                            {task.priority || 'Medium'}
                          </Badge>
                        </div>
                        
                        {/* Timeline Bar */}
                        <div className="flex-1 relative">
                          <div className="relative h-full">
                            {/* Task Bar */}
                            <div
                              className={`absolute top-2 h-10 rounded-lg cursor-pointer transition-all hover:opacity-80 hover:scale-105 shadow-lg ${getStatusColor(task.status)} border-2 border-white`}
                              style={{
                                left: `${x}px`,
                                width: `${Math.max(20, width)}px`,
                                minWidth: '20px',
                                zIndex: 10,
                              }}
                              onClick={() => onTaskClick?.(task.id)}
                              title={`${task.name} - ${task.status} (${task.progress}%)`}
                            />
                            
                            {/* Progress Overlay */}
                            {task.progress > 0 && (
                              <div
                                className="absolute top-2 h-10 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-l transition-all shadow-sm"
                                style={{
                                  left: `${x}px`,
                                  width: `${(width * task.progress) / 100}px`,
                                }}
                              />
                            )}

                            {/* Progress Text */}
                            {task.progress > 0 && (
                              <div
                                className="absolute top-2 h-10 flex items-center justify-center text-white text-xs font-medium"
                                style={{
                                  left: `${x}px`,
                                  width: `${(width * task.progress) / 100}px`,
                                }}
                              >
                                {task.progress}%
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Subtasks - Much better spaced and less crowded */}
                      {expandedMilestones.has(task.id) && task.subtasks && task.subtasks.length > 0 && (
                        <div className="bg-gray-50 border-b border-gray-100">
                          {task.subtasks.map((subtask: NonNullable<typeof task.subtasks>[0], index: number) => (
                            <div key={subtask.id} className="flex items-center h-20 border-b border-gray-100 last:border-b-0 bg-gray-50/50">
                              {/* Subtask Label - Much better indented and spaced */}
                              <div className="w-96 bg-gray-50/50 border-r border-gray-200 p-6 flex items-center space-x-4">
                                <div className="flex items-center space-x-4 ml-16">
                                  <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-700 truncate mb-2">
                                      {subtask.name}
                                    </div>
                                    <div className="flex items-center space-x-4">
                                      <Badge variant="outline" className="text-xs">
                                        {subtask.status}
                                      </Badge>
                                      {subtask.startDate && (
                                        <span className="text-gray-500 text-xs">
                                          {new Date(subtask.startDate).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Subtask Timeline Bar - Properly aligned */}
                              <div className="flex-1 relative">
                                <div className="relative h-full">
                                  {/* Subtask Bar - Better positioned and sized */}
                                  <div
                                    className="absolute top-6 h-6 bg-gray-400 rounded cursor-pointer transition-all hover:opacity-80 shadow-sm border border-gray-300"
                                    style={{
                                      left: `${getDatePosition(subtask.startDate)}px`,
                                      width: `${Math.max(20, getTaskWidth(subtask.startDate, subtask.dueDate))}px`,
                                      minWidth: '20px',
                                      zIndex: 5,
                                    }}
                                    title={`${subtask.name} - ${subtask.status}`}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
             
            {/* Legend */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Legend</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-gray-600">Completed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600">In Progress</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                  <span className="text-gray-600">To Do</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-gray-600">On Hold</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(task.status)}`} />
                    <div>
                      <h4 className="font-medium text-gray-900">{task.name}</h4>
                      <p className="text-sm text-gray-600">
                        Phase {task.phaseNumber || 'N/A'} • {task.status}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline" className={getPhaseColor(task.phaseNumber)}>
                      {getPhaseName(task.phaseNumber)}
                    </Badge>
                    
                    <Badge variant="outline" className={getPriorityColor(task.priority)}>
                      {task.priority || 'Medium'}
                    </Badge>
                    
                    <div className="text-sm text-gray-600">
                      <div>Start: {task.startDate ? new Date(task.startDate).toLocaleDateString() : 'Not set'}</div>
                      <div>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm font-medium">{task.progress || 0}%</div>
                      <Progress value={task.progress || 0} className="w-20 h-2" />
                    </div>
                  </div>
                </div>

                {/* Subtasks Section for List View */}
                {expandedMilestones.has(task.id) && task.subtasks && task.subtasks.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                    <div className="text-sm font-medium text-gray-700 mb-2">Subtasks:</div>
                    <div className="space-y-2">
                      {task.subtasks.map((subtask: NonNullable<typeof task.subtasks>[0]) => (
                        <div key={subtask.id} className="flex items-center space-x-3 text-sm">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-gray-700">{subtask.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {subtask.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {filteredTasks.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Target className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No milestones found</p>
                <p className="text-sm">Try adjusting your search or status filters</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
