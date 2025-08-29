import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Search, Filter, CalendarDays, DollarSign, User, Clock, AlertTriangle, UserCheck, CheckCircle, X, ChevronDown, ChevronRight, Bell } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { formatCurrency, calculateSubtaskWeightBasedProgress } from '@/lib/utils';

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
  subtasks?: Subtask[];
}

interface Subtask {
  id: string;
  name: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'fc_review' | 'qa' | 'client_review' | 'completed' | 'overdue' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  estimatedDays?: number;
  actualHours?: number;
  actualDays?: number;
  progressPercent: number;
  assignedDevId?: string;
  assignedConsultantId?: string;
  assignedDev?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  assignedConsultant?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  moduleId: string;
  createdAt: string;
  updatedAt: string;
}

interface ModuleTableProps {
  modules: Module[];
  projectSegment: string;
  onEdit: (module: Module) => void;
  initiallyExpandedModule?: string | null;
}

export default function ModuleTable({ modules, projectSegment, onEdit, initiallyExpandedModule }: ModuleTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof Module>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Auto-expand module if initiallyExpandedModule is provided
  useEffect(() => {
    if (initiallyExpandedModule) {
      setExpandedModules(new Set([initiallyExpandedModule]));
    }
  }, [initiallyExpandedModule]);

  // Toggle module expansion
  const toggleModuleExpansion = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  // Add loading state handling
  if (!modules) {
    return (
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
    );
  }

  // Status update mutation for modules
  const updateModuleStatusMutation = useMutation({
    mutationFn: async ({ moduleId, status }: { moduleId: string; status: string }) => {
      // Find the current module to validate status transition
      const currentModule = modules.find(m => m.id === moduleId);
      if (currentModule) {
        // Allow moving backwards from 'completed' to other statuses, but prevent going back to 'not_started'
        if (currentModule.status === 'completed' && status === 'not_started') {
          throw new Error('Cannot move completed module back to "Not Started" status');
        }
        // Prevent setting to 'completed' without going through 'client_review'
        if (status === 'completed' && currentModule.status !== 'client_review') {
          throw new Error('Module must go through client review before being marked as completed');
        }
      }
      
      const response = await apiRequest('PUT', `/api/modules/${moduleId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: 'Success', description: 'Module status updated' });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({ title: 'Unauthorized', description: 'You are logged out. Logging in again...', variant: 'destructive' });
        setTimeout(() => { window.location.href = '/login'; }, 500);
        return;
      }
      toast({ title: 'Error', description: error?.message || 'Failed to update module status', variant: 'destructive' });
    },
  });

  // Status update mutation for subtasks
  const updateSubtaskStatusMutation = useMutation({
    mutationFn: async ({ subtaskId, status }: { subtaskId: string; status: string }) => {
      const response = await apiRequest('PUT', `/api/subtasks/${subtaskId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: 'Success', description: 'Subtask status updated' });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({ title: 'Unauthorized', description: 'You are logged out. Logging in again...', variant: 'destructive' });
        setTimeout(() => { window.location.href = '/login'; }, 500);
        return;
      }
      toast({ title: 'Error', description: error?.message || 'Failed to update subtask status', variant: 'destructive' });
    },
  });



  // Bulk status update mutation
  const bulkStatusUpdateMutation = useMutation({
    mutationFn: async ({ moduleIds, status }: { moduleIds: string[]; status: string }) => {
      const promises = moduleIds.map(id => 
        apiRequest('PUT', `/api/modules/${id}`, { status })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setSelectedModules([]);
      toast({ title: 'Success', description: `${selectedModules.length} modules updated` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: 'Failed to update modules', variant: 'destructive' });
    },
  });

  // Filter modules based on search and filters
  const filteredModules = modules
    .filter(module => {
      const matchesSearch = module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (module.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || module.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || module.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    });

  // Sorting function
  const handleSort = (field: keyof Module | keyof Subtask) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field as keyof Module);
      setSortDirection('asc');
    }
  };

  // Sort modules and subtasks
  const sortedModules = [...filteredModules].sort((a, b) => {
          const aValue = a[sortField as keyof Module];
      const bValue = b[sortField as keyof Module];
    
    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    const comparison = aValue < bValue ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Handle bulk selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
              setSelectedModules(filteredModules.map(m => m.id));
          } else {
        setSelectedModules([]);
      }
  };

  const handleSelectModule = (moduleId: string, checked: boolean) => {
    if (checked) {
      setSelectedModules(prev => [...prev, moduleId]);
    } else {
      setSelectedModules(prev => prev.filter(id => id !== moduleId));
    }
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = (newStatus: string) => {
    if (selectedModules.length === 0) return;
    
    // Validate bulk status updates
    const invalidModules = selectedModules.filter(moduleId => {
      const module = modules.find(m => m.id === moduleId);
      if (!module) return false;
      
      // Allow moving backwards from 'completed' to other statuses, but prevent going back to 'not_started'
      if (module.status === 'completed' && newStatus === 'not_started') {
        return true;
      }
      // Prevent setting to 'completed' without going through 'client_review'
      if (newStatus === 'completed' && module.status !== 'client_review') {
        return true;
      }
      
      return false;
    });
    
    if (invalidModules.length > 0) {
      toast({ 
        title: 'Validation Error', 
        description: 'Some modules cannot be updated due to status transition rules', 
        variant: 'destructive' 
      });
      return;
    }
    
    bulkStatusUpdateMutation.mutate({ moduleIds: selectedModules, status: newStatus });
  };

  // Utility functions
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };



  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'fc_review': return 'bg-purple-100 text-purple-800';
      case 'qa': return 'bg-purple-100 text-purple-800';
      case 'client_review': return 'bg-indigo-100 text-indigo-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'on_hold': return 'bg-orange-100 text-orange-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <AlertTriangle className="h-4 w-4" />;
      case 'qa': return <UserCheck className="h-4 w-4" />;
      case 'client_review': return <UserCheck className="h-4 w-4" />;
      case 'done': return <CheckCircle className="h-4 w-4" />;
      case 'delayed': return <Clock className="h-4 w-4" />;
      case 'on_hold': return <AlertTriangle className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const calculateCollectionDate = (invoiceDate?: string) => {
    if (!invoiceDate) return 'Not set';
    const date = new Date(invoiceDate);
    date.setDate(date.getDate() + 30);
    return formatDate(date.toISOString());
  };

  const calculateRequiredDays = (startDate?: string, endDate?: string) => {
    if (!startDate || !endDate) return 'Not set';
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  };

  // Get status display text
  const getStatusDisplayText = (status: string) => {
    const statusMap: Record<string, string> = {
      'todo': 'Not Started',
      'not_started': 'Not Started',
      'in_progress': 'In Progress',
      'ongoing': 'Ongoing',
      'qa': 'QA',
      'client_review': 'Client Review',
      'done': 'Completed',
              'completed': 'Completed',
      'overdue': 'Overdue',
      'delayed': 'Delayed',
      'on_hold': 'On Hold',
      'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
  };

  // Smart notification logic for subtasks
  const getSubtaskNotificationStatus = (subtask: Subtask) => {
    const now = new Date();
    const dueDate = subtask.dueDate ? new Date(subtask.dueDate) : null;
    const estimatedDays = subtask.estimatedDays || 1;
    
    if (!dueDate) return { status: 'no_due_date', message: 'No due date set' };
    
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Smart notification timing based on subtask duration
    const notificationThreshold = Math.min(estimatedDays * 0.3, 3); // 30% of estimated time or 3 days, whichever is less
    
    if (daysUntilDue < 0) {
      return { 
        status: 'overdue', 
        message: `Overdue by ${Math.abs(daysUntilDue)} days`,
        shouldNotify: true,
        notificationType: 'overdue'
      };
    } else if (daysUntilDue <= notificationThreshold) {
      return { 
        status: 'due_soon', 
        message: `Due in ${daysUntilDue} days`,
        shouldNotify: true,
        notificationType: 'due_soon'
      };
    } else {
      return { 
        status: 'on_track', 
        message: `Due in ${daysUntilDue} days`,
        shouldNotify: false
      };
    }
  };

    // Calculate accurate progress percentage for modules based on subtasks
  const calculateModuleProgress = (module: Module) => {
    if (!module.subtasks || module.subtasks.length === 0) {
      return 0;
    }
    
    return calculateSubtaskWeightBasedProgress(module.subtasks);
  };

  if (modules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p>No modules found for this project.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modules</CardTitle>
        <p className="text-sm text-gray-600">Track progress across all project modules</p>
      </CardHeader>
      <CardContent>
        {/* Filters and Search */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="todo">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="client_review">Client Review</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>


          </div>

          {/* Bulk Actions */}
          {selectedModules.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-blue-900">
                  {selectedModules.length} module(s) selected
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Select 
                  onValueChange={handleBulkStatusUpdate}
                  disabled={bulkStatusUpdateMutation.isPending}
                >
                  <SelectTrigger className={`w-40 ${
                    bulkStatusUpdateMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''
                  }`}>
                    {bulkStatusUpdateMutation.isPending ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                        <span className="text-sm text-gray-500">Updating {selectedModules.length} items...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Update status" />
                    )}
                  </SelectTrigger>
                  <SelectContent className="bg-blue-50 border-blue-200">
                    {/* Check if any selected modules are completed to determine available options */}
                    {(() => {
                      const hasCompletedModules = selectedModules.some(moduleId => {
                        const module = modules.find(m => m.id === moduleId);
                        return module?.status === 'completed';
                      });
                      
                      return (
                        <>
                          {/* Only show 'not_started' if no completed modules are selected */}
                          {!hasCompletedModules && (
                            <SelectItem value="not_started">Not Started</SelectItem>
                          )}
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="fc_review">FC Review</SelectItem>
                          <SelectItem value="qa">QA</SelectItem>
                          <SelectItem value="client_review">Client Review</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </>
                      );
                    })()}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkStatusUpdateMutation.isPending}
                  onClick={() => setSelectedModules([])}
                  className={bulkStatusUpdateMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Milestones Table */}
        <div className="overflow-x-auto relative">
          {bulkStatusUpdateMutation.isPending && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-lg p-4 flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                <span className="text-sm font-medium text-gray-700">
                  Processing {selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''}...
                </span>
              </div>
            </div>
          )}
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-3">
                  <Checkbox
                    checked={selectedModules.length === filteredModules.length && filteredModules.length > 0}
                    disabled={bulkStatusUpdateMutation.isPending}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th 
                  className="text-left p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Module</span>
                    {sortField === 'name' && (
                      <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="text-left p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('priority')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Priority</span>
                    {sortField === 'priority' && (
                      <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="text-left p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('startDate')}
                >
                  <div className="flex items-center space-x-1">
                    <CalendarDays className="h-4 w-4" />
                    <span>Start Date</span>
                    {sortField === 'startDate' && (
                      <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="text-left p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center space-x-1">
                    <CalendarDays className="h-4 w-4" />
                    <span>End Date</span>
                    {sortField === 'dueDate' && (
                      <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>

                                 <th className="text-left p-3">Required Days</th>
                 <th className="text-left p-3">Duration</th>
                 <th className="text-left p-3">Segment</th>

                <th 
                  className="text-left p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {sortField === 'status' && (
                      <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>

                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedModules.map((module) => (
                <React.Fragment key={module.id}>
                  {/* Main Module Row */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3">
                      <Checkbox
                        checked={selectedModules.includes(module.id)}
                        disabled={bulkStatusUpdateMutation.isPending}
                        onCheckedChange={(checked) => handleSelectModule(module.id, checked as boolean)}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        {/* Expand/Collapse Button */}
                        {module.subtasks && module.subtasks.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleModuleExpansion(module.id)}
                            className="h-6 w-6 p-0 hover:bg-gray-200"
                          >
                            {expandedModules.has(module.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{module.name}</div>
                          {module.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {module.description}
                            </div>
                          )}
                          {/* Subtask count indicator */}
                          {module.subtasks && module.subtasks.length > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              {module.subtasks.length} subtask{module.subtasks.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  <td className="p-3">
                    <Badge className={getPriorityColor(module.priority)}>
                      {module.priority.charAt(0).toUpperCase() + module.priority.slice(1)}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {formatDate(module.startDate)}
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {formatDate(module.dueDate)}
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {module.assignedUser ? `${module.assignedUser.firstName || ''} ${module.assignedUser.lastName || ''}`.trim() || module.assignedUser.email : 'Unassigned'}
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {module.startDate && module.dueDate ? 
                      Math.ceil((new Date(module.dueDate).getTime() - new Date(module.startDate).getTime()) / (1000 * 60 * 60 * 24)) + ' days' : 
                      'Not set'
                    }
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {projectSegment ? projectSegment.charAt(0).toUpperCase() + projectSegment.slice(1) : 'Private'}
                  </td>
                                     <td className="p-3">
                     <Select
                       value={module.status}
                       disabled={updateModuleStatusMutation.isPending}
                       onValueChange={(value) => updateModuleStatusMutation.mutate({
                         moduleId: module.id,
                         status: value
                       })}
                     >
                       <SelectTrigger className={`w-32 relative ${
                         updateModuleStatusMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''
                       } ${module.status === 'completed' ? 'bg-green-50 border-green-200' : module.status === 'client_review' ? 'bg-yellow-50 border-yellow-200' : module.status === 'in_progress' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                         {updateModuleStatusMutation.isPending ? (
                           <div className="flex items-center">
                             <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                             <span className="text-sm text-gray-500">Processing...</span>
                           </div>
                         ) : (
                           <SelectValue />
                         )}
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="not_started">Not Started</SelectItem>
                         <SelectItem value="in_progress">In Progress</SelectItem>
                         <SelectItem value="fc_review">FC Review</SelectItem>
                         <SelectItem value="qa">QA</SelectItem>
                         <SelectItem value="client_review">Client Review</SelectItem>
                         <SelectItem value="completed">Completed</SelectItem>
                         <SelectItem value="overdue">Overdue</SelectItem>
                         <SelectItem value="on_hold">On Hold</SelectItem>
                         <SelectItem value="cancelled">Cancelled</SelectItem>
                       </SelectContent>
                     </Select>
                   </td>

                  <td className="p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(module)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </td>
                </tr>

                {/* Subtasks for expanded modules */}
                {expandedModules.has(module.id) && module.subtasks && module.subtasks.length > 0 && (
                  <tr className="border-b border-gray-100">
                    <td colSpan={11} className="p-0">
                      <div className="bg-blue-50 border-t border-blue-200">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-blue-200">
                              <th className="text-left p-3">
                                <Checkbox
                                  checked={selectedModules.includes(module.id)}
                                  disabled={bulkStatusUpdateMutation.isPending}
                                  onCheckedChange={(checked) => handleSelectModule(module.id, checked as boolean)}
                                />
                              </th>
                              <th 
                                className="text-left p-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => handleSort('name' as keyof Module)}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Subtask</span>
                                  {sortField === 'name' && (
                                    <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="text-left p-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => handleSort('priority' as keyof Module)}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Priority</span>
                                  {sortField === 'priority' && (
                                    <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="text-left p-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => handleSort('startDate' as keyof Module)}
                              >
                                <div className="flex items-center space-x-1">
                                  <CalendarDays className="h-4 w-4" />
                                  <span>Start Date</span>
                                  {sortField === 'startDate' && (
                                    <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="text-left p-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => handleSort('dueDate' as keyof Module)}
                              >
                                <div className="flex items-center space-x-1">
                                  <CalendarDays className="h-4 w-4" />
                                  <span>End Date</span>
                                  {sortField === 'dueDate' && (
                                    <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>

                              <th className="text-left p-3">
                                <div className="flex items-center space-x-1">
                                  <CalendarDays className="h-4 w-4" />
                                  <span>Estimated Days</span>
                                </div>
                              </th>
                              <th className="text-left p-3">
                                <div className="flex items-center space-x-1">
                                  <User className="h-4 w-4" />
                                  <span>Developer</span>
                                </div>
                              </th>
                              <th className="text-left p-3">
                                <div className="flex items-center space-x-1">
                                  <UserCheck className="h-4 w-4" />
                                  <span>Functional Consultant</span>
                                </div>
                              </th>
                              <th className="text-left p-3">
                                <div className="flex items-center space-x-1">
                                  <UserCheck className="h-4 w-4" />
                                  <span>Progress</span>
                                </div>
                              </th>
                              <th 
                                className="text-left p-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => handleSort('status' as keyof Module)}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Status</span>
                                  {sortField === 'status' && (
                                    <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>

                              <th className="text-left p-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {module.subtasks.map((subtask) => (
                              <tr key={subtask.id} className="border-b border-blue-100 hover:bg-blue-50">
                                <td className="p-3">
                                  <Checkbox
                                    checked={selectedModules.includes(module.id)}
                                    disabled={bulkStatusUpdateMutation.isPending}
                                    onCheckedChange={(checked) => handleSelectModule(module.id, checked as boolean)}
                                  />
                                </td>
                                <td className="p-3">
                                  <div>
                                    <div className="font-medium text-gray-900">{subtask.name}</div>
                                    {subtask.description && (
                                      <div className="text-sm text-gray-500 truncate max-w-xs">
                                        {subtask.description}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <Badge className={getPriorityColor(subtask.priority)}>
                                    {subtask.priority.charAt(0).toUpperCase() + subtask.priority.slice(1)}
                                  </Badge>
                                </td>
                                <td className="p-3 text-sm text-gray-600">
                                  {formatDate(subtask.startDate)}
                                </td>
                                <td className="p-3 text-sm text-gray-600">
                                  {formatDate(subtask.dueDate)}
                                </td>

                                <td className="p-3 text-sm text-gray-600">
                                  {subtask.estimatedDays || 'N/A'}
                                </td>
                                <td className="p-3 text-sm text-gray-600">
                                  {subtask.assignedDev ? (
                                    <div className="flex items-center space-x-2">
                                      <User className="h-4 w-4 text-gray-500" />
                                      <span className="font-medium">
                                        {subtask.assignedDev.firstName && subtask.assignedDev.lastName 
                                          ? `${subtask.assignedDev.firstName} ${subtask.assignedDev.lastName}`
                                          : subtask.assignedDev.email
                                        }
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">Unassigned</span>
                                  )}
                                </td>
                                <td className="p-3 text-sm text-gray-600">
                                  {subtask.assignedConsultant ? (
                                    <div className="flex items-center space-x-2">
                                      <UserCheck className="h-4 w-4 text-gray-500" />
                                      <span className="font-medium">
                                        {subtask.assignedConsultant.firstName && subtask.assignedConsultant.lastName 
                                          ? `${subtask.assignedConsultant.firstName} ${subtask.assignedConsultant.lastName}`
                                          : subtask.assignedConsultant.email
                                        }
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">Unassigned</span>
                                  )}
                                </td>
                                <td className="p-3 text-sm text-gray-600">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-16 bg-gray-200 rounded-full h-2">
                                      <div 
                                        className={`h-2 rounded-full ${
                                          subtask.progressPercent >= 100 ? 'bg-green-500' :
                                          subtask.progressPercent >= 75 ? 'bg-blue-500' :
                                          subtask.progressPercent >= 50 ? 'bg-yellow-500' :
                                          subtask.progressPercent >= 25 ? 'bg-orange-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${Math.min(subtask.progressPercent, 100)}%` }}
                                      ></div>
                                    </div>
                                    <span className="font-medium">{subtask.progressPercent}%</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <Select
                                    value={subtask.status}
                                    disabled={updateSubtaskStatusMutation.isPending}
                                    onValueChange={(value) => updateSubtaskStatusMutation.mutate({
                                      subtaskId: subtask.id,
                                      status: value
                                    })}
                                  >
                                    <SelectTrigger className={`w-32 relative ${
                                      updateSubtaskStatusMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''
                                    } ${subtask.status === 'completed' ? 'bg-green-50 border-green-200' : subtask.status === 'in_progress' ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                                      {updateSubtaskStatusMutation.isPending ? (
                                        <div className="flex items-center">
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                          <span className="text-sm text-gray-500">Processing...</span>
                                        </div>
                                      ) : (
                                        <SelectValue />
                                      )}
                                    </SelectTrigger>
                                    <SelectContent className="bg-blue-50 border-blue-200">
                                      <SelectItem value="not_started">Not Started</SelectItem>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="fc_review">FC Review</SelectItem>
                                      <SelectItem value="qa">QA</SelectItem>
                                      <SelectItem value="client_review">Client Review</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                      <SelectItem value="overdue">Overdue</SelectItem>
                                      <SelectItem value="on_hold">On Hold</SelectItem>
                                      <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>

                                <td className="p-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onEdit({ ...module, subtasks: module.subtasks?.map(s => s.id === subtask.id ? subtask : s) || [] })}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-6 flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing {filteredModules.length} of {modules.length} modules
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
