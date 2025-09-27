import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  RefreshCw,
  Maximize2,
  Minimize2
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
    assignedUser?: {
      firstName?: string;
      lastName?: string;
      email: string;
    };
    subtasks?: Array<{
      id: string;
      name: string;
      startDate: string | null;
      dueDate: string | null;
      status: string;
      assignedUser?: {
        firstName?: string;
        lastName?: string;
        email: string;
      };
    }>;
    // New properties for Phase 3 parent-child structure
    isParent?: boolean;
    isChild?: boolean;
    parentMilestoneId?: string;
    isMilestone?: boolean;
    billingStatus?: string;
    originalBillingStatus?: string;
  }>;
}

interface GanttChartProps {
  data: GanttData;
  onTaskClick?: (taskId: string) => void;
  onPhaseClick?: (phaseId: string) => void;
}

// Enhanced status mapping that considers both task status and billing status
const getEffectiveStatus = (task: any) => {
  // Debug logging for understanding the data flow
  if (window.location.search?.includes('debug')) {
    console.log('getEffectiveStatus called with task:', {
      id: task.id,
      name: task.name,
      isMilestone: task.isMilestone,
      billingStatus: task.billingStatus,
      originalBillingStatus: task.originalBillingStatus,
      status: task.status,
    });
  }
  
  // For milestones, prioritize billing status over task status
  if (task.isMilestone && (task.billingStatus || task.originalBillingStatus)) {
    // Check billing status, with fallback to originalBillingStatus for backwards compatibility
    const billingStatus = task.billingStatus || task.originalBillingStatus;
    if (window.location.search?.includes('debug')) {
      console.log('Processing milestone billing status:', billingStatus);
    }
    switch (billingStatus) {
      case 'paid':
        return 'completed';
      case 'sent':
      case 'processing':
        return 'in_progress';
      case 'to_send':
        return 'in_progress';
      case 'overdue':
        return 'overdue';
      case 'none':
        return task.status || 'not_started';
      default:
        return task.status || 'not_started';
    }
  }
  
  // For regular tasks, use task status
  return task.status || 'not_started';
};

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

// Helper function to format dates for tooltip
const formatDateForTooltip = (dateString: string | null) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
};

// Helper function to get assigned personnel info
const getAssignedPersonnelInfo = (task: GanttData['tasks'][0]) => {
  const assigned = [];
  
  // Main assigned user
  if (task.assignedUser) {
    const name = `${task.assignedUser.firstName || ''} ${task.assignedUser.lastName || ''}`.trim();
    assigned.push(name || task.assignedUser.email);
  }
  
  // Check subtasks for assigned users
  if (task.subtasks && task.subtasks.length > 0) {
    const subtaskUsers = task.subtasks
      .filter(subtask => subtask.assignedUser)
      .map(subtask => {
        const name = `${subtask.assignedUser?.firstName || ''} ${subtask.assignedUser?.lastName || ''}`.trim();
        return name || subtask.assignedUser?.email;
      })
      .filter((name, index, arr) => arr.indexOf(name) === index); // Remove duplicates
    
    assigned.push(...subtaskUsers);
  }
  
  return assigned.length > 0 ? assigned.join(', ') : 'Unassigned';
};

// Helper function to generate detailed tooltip content
const generateTooltipContent = (task: GanttData['tasks'][0]) => {
  const startDate = formatDateForTooltip(task.startDate);
  const endDate = formatDateForTooltip(task.dueDate);
  const assignedPersonnel = getAssignedPersonnelInfo(task);
  // Use getEffectiveStatus instead of task.status directly for consistency
  const statusText = getEffectiveStatus(task).replace('_', ' ').replace(/\b\w/g, (char: string) => char.toUpperCase());
  
  return `${task.name}
Status: ${statusText}
Progress: ${task.progress}%
Start: ${startDate}
End: ${endDate}
Assigned: ${assignedPersonnel}`;
};

// Helper function to generate detailed tooltip for subtasks (aligns with milestone tooltip)
const generateSubtaskTooltipContent = (
  subtask: NonNullable<GanttData['tasks'][0]['subtasks']>[number],
  parentTask: GanttData['tasks'][0],
  phaseName: string
) => {
  const startDate = formatDateForTooltip(subtask.startDate);
  const endDate = formatDateForTooltip(subtask.dueDate);
  const statusText = (subtask.status || '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  const assigned = subtask.assignedUser
    ? `${(subtask.assignedUser.firstName || '')} ${(subtask.assignedUser.lastName || '')}`.trim() || subtask.assignedUser.email
    : 'Unassigned';

  return `${subtask.name}
Status: ${statusText}
Start: ${startDate}
End: ${endDate}
Assigned: ${assigned}
Milestone: ${parentTask.name}
Phase: ${phaseName}`;
};

export default function GanttChart({ data, onTaskClick, onPhaseClick }: GanttChartProps) {
  const { toast } = useToast();
  const [zoom, setZoom] = useState(0.5);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedView, setSelectedView] = useState<'timeline' | 'list'>('timeline');
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [exportLoading, setExportLoading] = useState(false);

  // Fullscreen overlay state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [projectTabs, setProjectTabs] = useState<Array<{ id: string; name: string }>>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(data.project.id);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayData, setOverlayData] = useState<GanttData | null>(null);
  const [projectSearch, setProjectSearch] = useState('');

  // Determine which data source to use - overlayData in fullscreen mode when loaded
  const currentData = isFullscreen && overlayData ? overlayData : data;

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

  // Fetch lightweight projects list for tabs when entering fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/projects', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const list = (json || []).map((p: any) => ({ id: p.id, name: p.name || p.client || 'Untitled Project' }));
        setProjectTabs(list);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [isFullscreen]);

  // Load Gantt data for a given project id (used in fullscreen)
  const loadGanttDataForProject = async (projectId: string) => {
    setOverlayLoading(true);
    try {
      // Use the proper Gantt endpoint that handles all project data correctly
      const res = await fetch(`/api/projects/${projectId}/gantt`, { 
        credentials: 'include', 
        cache: 'no-store' 
      });
      if (!res.ok) throw new Error('Failed to load project Gantt data');
      const ganttData = await res.json();
      setOverlayData(ganttData);
    } catch (e: any) {
      toast({ title: 'Load error', description: e?.message || 'Failed to load project', variant: 'destructive' });
    } finally {
      setOverlayLoading(false);
    }
  };

  // When opening fullscreen, seed overlay with current data
  useEffect(() => {
    if (!isFullscreen) return;
    setActiveProjectId(data.project.id);
    setOverlayData(data);
    // Attach Esc handler
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

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
    const phase = currentData.phases.find(p => p.phaseNumber === phaseNumber);
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
    if (!currentData.project.startDate || !currentData.project.endDate) return null;

    const projectStart = new Date(currentData.project.startDate);
    const projectEnd = new Date(currentData.project.endDate);
    
    if (isNaN(projectStart.getTime()) || isNaN(projectEnd.getTime())) {
      return null;
    }

    // Find the earliest start date among all tasks to align timeline properly
    const allStartDates: Date[] = [];
    currentData.tasks.forEach(task => {
      if (task.startDate) {
        const date = new Date(task.startDate);
        if (!isNaN(date.getTime())) {
          allStartDates.push(date);
        }
      }
    });
    
    const earliestStart = allStartDates.length > 0 
      ? new Date(Math.min(...allStartDates.map(d => d.getTime())))
      : projectStart;

    // Start timeline from Monday of the week containing the earliest start date
    const timelineStart = new Date(earliestStart);
    const dayOfWeek = timelineStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to get to Monday
    timelineStart.setDate(timelineStart.getDate() + daysToMonday);

    const totalDays = Math.ceil((projectEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));
    const dayWidth = 40 * zoom; // Base width per day, adjustable with zoom

    return {
      projectStart,
      projectEnd,
      timelineStart, // New: actual start of timeline (Monday)
      totalDays,
      dayWidth,
      containerWidth: totalDays * dayWidth + 400, // 400px for milestone labels
      weekWidth: 7 * dayWidth, // Width of each week column
    };
  }, [currentData.project.startDate, currentData.project.endDate, currentData.tasks, zoom]) as {
    projectStart: Date;
    projectEnd: Date;
    timelineStart: Date;
    totalDays: number;
    dayWidth: number;
    containerWidth: number;
    weekWidth: number;
  } | null;

  // Filter tasks based on search and status
  const filteredTasks = useMemo(() => {
    let tasks = currentData.tasks;
    
    if (statusFilter !== 'all') {
      tasks = tasks.filter(task => task.status === statusFilter);
    }
    
    if (searchTerm) {
      tasks = tasks.filter(task => 
        task.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return tasks;
  }, [currentData.tasks, statusFilter, searchTerm]);

  // Get position for a date on the timeline
  const getDatePosition = (date: string | null) => {
    if (!date || !timelineData) return 0;
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) return 0;
    
    const daysDiff = Math.ceil((targetDate.getTime() - timelineData.timelineStart.getTime()) / (1000 * 60 * 60 * 24));
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
      const weekStart = new Date(timelineData.timelineStart);
      weekStart.setDate(weekStart.getDate() + (i * 7));
      markers.push({
        week: i + 1,
        date: weekStart,
        position: i * 7 * timelineData.dayWidth // This aligns with daily markers at positions 0, 7, 14, etc.
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
      dayLetter: string;
    }> = [];
    
    for (let i = 0; i <= timelineData.totalDays; i++) {
      const dayDate = new Date(timelineData.timelineStart);
      dayDate.setDate(dayDate.getDate() + i);
      
      const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      const dayOfWeek = dayDate.getDay();
      
      markers.push({
        day: dayDate.getDate(),
        date: dayDate,
        position: i * timelineData.dayWidth,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6, // Sunday or Saturday
        dayLetter: dayLetters[dayOfWeek]
      });
    }
    
    return markers;
  }, [timelineData]);

  // Get current date position for indicator
  const getCurrentDatePosition = () => {
    if (!timelineData) return 0;
    const today = new Date();
    return getDatePosition(today.toISOString().split('T')[0]);
  };

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
    <>
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

            {/* Maximize */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFullscreen(true)}
              title="Maximize Gantt"
            >
              <Maximize2 className="h-4 w-4" />
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
                    <div className="relative" style={{ height: '44px' }}>
                      {timelineMarkers.map((marker) => (
                        <div
                          key={marker.week}
                          className="absolute border-r border-gray-200 text-center text-xs text-gray-600 p-1 bg-gradient-to-b from-gray-50 to-white flex flex-col justify-center"
                          style={{ 
                            left: marker.position,
                            width: 7 * timelineData.dayWidth,
                            minWidth: 7 * timelineData.dayWidth,
                            height: '44px'
                          }}
                        >
                          <div className="font-semibold text-gray-800">Week {marker.week}</div>
                          <div className="text-gray-500">{marker.date.toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Day Letters Row - M T W T F S S */}
                    <div className="relative" style={{ height: '20px' }}>
                      {dailyMarkers.map((marker, index) => (
                        <div
                          key={`day-letter-${index}`}
                          className={`absolute text-center text-xs border-r border-gray-100 flex items-center justify-center ${
                            marker.isWeekend ? 'bg-gray-100 text-gray-500' : 'bg-white text-gray-600'
                          }`}
                          style={{ 
                            left: marker.position,
                            width: timelineData.dayWidth,
                            minWidth: timelineData.dayWidth,
                            height: '20px'
                          }}
                        >
                          <div className="font-medium">{marker.dayLetter}</div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Daily Markers - Bottom row with day numbers */}
                    <div className="relative" style={{ height: '24px' }}>
                      {/* Current Date Indicator */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-red-600 z-20 shadow-lg"
                        style={{ 
                          left: getCurrentDatePosition(),
                          boxShadow: '0 0 4px rgba(220, 38, 38, 0.5), 0 0 8px rgba(220, 38, 38, 0.3)'
                        }}
                      />
                      
                      {dailyMarkers.map((marker) => (
                        <div
                          key={`day-${marker.date.toISOString()}`}
                          className={`absolute text-center text-xs border-r border-gray-100 flex items-center justify-center ${
                            marker.isWeekend ? 'bg-gray-100 text-gray-500' : 'bg-white text-gray-700'
                          }`}
                          style={{ 
                            left: marker.position,
                            width: timelineData.dayWidth,
                            minWidth: timelineData.dayWidth,
                            height: '24px'
                          }}
                        >
                          <div className="font-medium">{marker.day}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Content */}
              <div className="space-y-0 relative">
                {/* Current Date Indicator - spans across ALL milestone rows */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-red-600 z-20 shadow-lg"
                  style={{ 
                    left: getCurrentDatePosition() + 384, // 384px = width of milestone labels column (w-96)
                    boxShadow: '0 0 4px rgba(220, 38, 38, 0.5), 0 0 8px rgba(220, 38, 38, 0.3)'
                  }}
                />
                
                {filteredTasks.map((task) => {
                  const x = getMilestoneStartPosition(task);
                  const width = getTaskWidth(task.startDate, task.dueDate);
                  
                  // Check if this task has child modules (Phase 3 structure)
                  const hasChildModules = task.isParent && filteredTasks.some(t => t.parentMilestoneId === task.id);
                  const childModules = hasChildModules ? filteredTasks.filter(t => t.parentMilestoneId === task.id) : [];
                  
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
                                (task.subtasks && task.subtasks.length > 0) || hasChildModules
                                  ? 'text-gray-500 hover:text-gray-700' 
                                  : 'text-gray-300 cursor-not-allowed'
                              }`}
                              disabled={(!task.subtasks || task.subtasks.length === 0) && !hasChildModules}
                            >
                              {expandedMilestones.has(task.id) ? '▼' : '▶'}
                            </button>
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(getEffectiveStatus(task))} shadow-sm`} />
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
                              {task.isParent && (
                                <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
                                  Parent
                                </Badge>
                              )}
                              {task.isChild && (
                                <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                                  Module
                                </Badge>
                              )}
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
                              className={`absolute top-2 h-10 rounded-lg cursor-pointer transition-all hover:opacity-80 hover:scale-105 shadow-lg ${getStatusColor(getEffectiveStatus(task))} border-2 border-white`}
                              style={{
                                left: `${x}px`,
                                width: `${Math.max(20, width)}px`,
                                minWidth: '20px',
                                zIndex: 10,
                              }}
                              onClick={() => onTaskClick?.(task.id)}
                              title={generateTooltipContent(task)}
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
                      
                      {/* Child Modules (Phase 3) - Show modules under milestones */}
                      {expandedMilestones.has(task.id) && hasChildModules && (
                        <div className="bg-blue-50 border-b border-gray-100">
                          {childModules.map((childModule: any, index: number) => {
                            const childX = getMilestoneStartPosition(childModule);
                            const childWidth = getTaskWidth(childModule.startDate, childModule.dueDate);
                            
                            return (
                              <div key={childModule.id} className="flex items-center h-16 border-b border-gray-100 last:border-b-0 bg-blue-50/50">
                                {/* Child Module Label */}
                                <div className="w-96 bg-blue-50/50 border-r border-gray-200 p-3 flex items-center space-x-3">
                                  <div className="flex items-center space-x-2 ml-8">
                                    <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm text-gray-700 truncate">
                                        {childModule.name}
                                      </div>
                                      <div className="flex items-center space-x-2 mt-1">
                                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
                                          Module
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                          {childModule.status}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Child Module Timeline Bar */}
                                <div className="flex-1 relative">
                                  <div className="relative h-full">
                                    <div
                                      className="absolute top-2 h-10 bg-blue-400 rounded cursor-pointer transition-all hover:opacity-80 shadow-sm border border-blue-300"
                                      style={{
                                        left: `${childX}px`,
                                        width: `${Math.max(20, childWidth)}px`,
                                        minWidth: '20px',
                                        zIndex: 5,
                                      }}
                                      onClick={() => onTaskClick?.(childModule.id)}
                                      title={`${childModule.name} - ${childModule.status}`}
                                    />
                                    
                                    {/* Progress Overlay for child modules */}
                                    {childModule.progress > 0 && (
                                      <div
                                        className="absolute top-2 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-l transition-all shadow-sm"
                                        style={{
                                          left: `${childX}px`,
                                          width: `${(childWidth * childModule.progress) / 100}px`,
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
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
                                    title={generateSubtaskTooltipContent(subtask, task, getPhaseName(task.phaseNumber))}
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
            {filteredTasks.map((task) => {
              // Check if this task has child modules (Phase 3 structure)
              const hasChildModules = task.isParent && filteredTasks.some(t => t.parentMilestoneId === task.id);
              const childModules = hasChildModules ? filteredTasks.filter(t => t.parentMilestoneId === task.id) : [];
              
              return (
                <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(getEffectiveStatus(task))}`} />
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
                      
                      {task.isParent && (
                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
                          Parent
                        </Badge>
                      )}
                      {task.isChild && (
                        <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                          Module
                        </Badge>
                      )}
                      
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

                  {/* Child Modules Section for List View (Phase 3) */}
                  {expandedMilestones.has(task.id) && hasChildModules && (
                    <div className="mt-3 p-3 bg-blue-50 rounded border-l-4 border-blue-500">
                      <div className="text-sm font-medium text-gray-700 mb-2">Modules:</div>
                      <div className="space-y-2">
                        {childModules.map((childModule: any) => (
                          <div key={childModule.id} className="flex items-center space-x-3 text-sm">
                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                            <span className="text-gray-700">{childModule.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {childModule.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subtasks Section for List View */}
                  {expandedMilestones.has(task.id) && task.subtasks && task.subtasks.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-gray-400">
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
              );
            })}
            
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

    {isFullscreen ? createPortal(
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
        {/* Main area renders exact same chart UI */}
        <div className="flex-1 overflow-auto p-4">
          <Card className="w-full max-w-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    {currentData?.project?.name || 'Project'} Timeline - Gantt Chart
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Visualize project timeline and milestones
                  </p>
                </div>
                
                <div className="flex items-center space-x-3">
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

                  {/* Minimize in fullscreen */}
                  <Button size="sm" variant="outline" onClick={() => setIsFullscreen(false)} title="Minimize">
                    <Minimize2 className="h-4 w-4" />
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
              {overlayLoading ? (
                /* Loading State */
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-sm text-gray-600">Loading project data...</p>
                  </div>
                </div>
              ) : selectedView === 'timeline' ? (
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
                        <div className="w-96 bg-gradient-to-b from-blue-50 to-white border-r border-gray-200 p-3 shadow-sm">
                          <div className="text-sm font-semibold text-blue-700">Milestones</div>
                        </div>
                        
                        {/* Timeline Grid - Starts exactly where milestone bars begin */}
                        <div className="flex-1 relative">
                          {/* Weekly Markers - Top row with week numbers and dates */}
                          <div className="relative" style={{ height: '44px' }}>
                            {timelineMarkers.map((m: any) => (
                              <div key={m.week} className="absolute border-r border-gray-200 text-center text-xs text-gray-600 p-1 bg-gradient-to-b from-gray-50 to-white flex flex-col justify-center" style={{ left: m.position, width: 7*timelineData.dayWidth, minWidth: 7*timelineData.dayWidth, height: '44px' }}>
                                <div className="font-semibold text-gray-800">Week {m.week}</div>
                                <div className="text-gray-500">{m.date.toLocaleDateString()}</div>
                              </div>
                            ))}
                          </div>
                          <div className="relative" style={{ height: '20px' }}>
                            {dailyMarkers.map((marker: any, idx: number) => (
                              <div key={`day-letter-${idx}`} className={`absolute text-center text-xs border-r border-gray-100 flex items-center justify-center ${marker.isWeekend?'bg-gray-100 text-gray-500':'bg-white text-gray-600'}`} style={{ left: marker.position, width: timelineData.dayWidth, minWidth: timelineData.dayWidth, height: '20px' }}>
                                <div className="font-medium">{marker.dayLetter}</div>
                              </div>
                            ))}
                          </div>
                          <div className="relative" style={{ height: '24px' }}>
                            <div className="absolute top-0 bottom-0 w-1 bg-red-600 z-20 shadow-lg" style={{ left: getCurrentDatePosition(), boxShadow: '0 0 4px rgba(220, 38, 38, 0.5), 0 0 8px rgba(220, 38, 38, 0.3)' }} />
                            {dailyMarkers.map((m: any) => (
                              <div key={`day-${m.date.toISOString()}`} className={`absolute text-center text-xs border-r border-gray-100 flex items-center justify-center ${m.isWeekend?'bg-gray-100 text-gray-500':'bg-white text-gray-700'}`} style={{ left: m.position, width: timelineData.dayWidth, minWidth: timelineData.dayWidth, height: '24px' }}>
                                <div className="font-medium">{m.day}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Content */}
                    <div className="space-y-0 relative">
                      {/* Current Date Indicator - spans across ALL milestone rows */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-red-600 z-20 shadow-lg"
                        style={{ 
                          left: getCurrentDatePosition() + 384, // 384px = width of milestone labels column (w-96)
                          boxShadow: '0 0 4px rgba(220, 38, 38, 0.5), 0 0 8px rgba(220, 38, 38, 0.3)'
                        }}
                      />
                      
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
                                  <div className={`w-3 h-3 rounded-full ${getStatusColor(getEffectiveStatus(task))} shadow-sm`} />
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
                                    className={`absolute top-2 h-10 rounded-lg cursor-pointer transition-all hover:opacity-80 hover:scale-105 shadow-lg ${getStatusColor(getEffectiveStatus(task))} border-2 border-white`}
                                    style={{
                                      left: `${x}px`,
                                      width: `${Math.max(20, width)}px`,
                                      minWidth: '20px',
                                      zIndex: 10,
                                    }}
                                    onClick={() => onTaskClick?.(task.id)}
                                    title={generateTooltipContent(task)}
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
                            
                            {/* Subtasks */}
                            {expandedMilestones.has(task.id) && task.subtasks && task.subtasks.length > 0 && (
                              <div className="bg-gray-50 border-b border-gray-100">
                                {task.subtasks.map((subtask: NonNullable<typeof task.subtasks>[0], index: number) => (
                                  <div key={subtask.id} className="flex items-center h-20 border-b border-gray-100 last:border-b-0 bg-gray-50/50">
                                    {/* Subtask Label */}
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
                                    
                                    {/* Subtask Bar */}
                                    <div className="flex-1 relative">
                                      <div className="relative h-full">
                                        <div
                                          className="absolute top-6 h-6 bg-gray-400 rounded cursor-pointer transition-all hover:opacity-80 shadow-sm border border-gray-300"
                                          style={{
                                            left: `${getDatePosition(subtask.startDate)}px`,
                                            width: `${Math.max(20, getTaskWidth(subtask.startDate, subtask.dueDate))}px`,
                                            minWidth: '20px',
                                            zIndex: 5,
                                          }}
                                          title={generateSubtaskTooltipContent(subtask, task, getPhaseName(task.phaseNumber))}
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
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(getEffectiveStatus(task))}`} />
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
        </div>

        {/* Bottom project tabs */}
        <div className="border-t bg-white p-3 sticky bottom-0 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Input placeholder="Search projects" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} className="pl-3 pr-3 h-9 w-64" />
            </div>
            <div className="flex-1 overflow-x-auto">
              <div className="flex items-center gap-2 whitespace-nowrap">
                {projectTabs
                  .filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                  .map((p) => (
                    <button
                      key={p.id}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors duration-200 ${
                        p.id === activeProjectId 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                      onClick={async () => {
                        if (p.id === activeProjectId) return;
                        setActiveProjectId(p.id);
                        await loadGanttDataForProject(p.id);
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body
    ) : null}
    </>
  );
}
