import React, { useState } from 'react';
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

interface Milestone {
  id: string;
  name: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in_progress' | 'client_review' | 'done' | 'not_started' | 'started' | 'ongoing' | 'finished';
  billingStatus: 'none' | 'to_send' | 'sent' | 'paid' | 'overdue' | 'processing';
  startDate?: string;
  dueDate?: string;
  expectedInvoiceDate?: string;
  expectedCollectionDate?: string;
  feeAmount?: string;
  assignedUserId?: string;
  assignedUser?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  projectId: string;
  createdAt: string;
  updatedAt: string;
  subtasks?: Subtask[];
}

interface Subtask {
  id: string;
  name: string;
  description?: string;
  status: 'not_started' | 'started' | 'ongoing' | 'finished';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  estimatedDays?: number;
  actualHours?: number;
  actualDays?: number;
  progressPercent: number;
  assignedUserId?: string;
  assignedUser?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  milestoneId: string;
  createdAt: string;
  updatedAt: string;
}

interface MilestoneTableProps {
  milestones: Milestone[];
  projectSegment: string;
  onEdit: (milestone: Milestone) => void;
}

export default function MilestoneTable({ milestones, projectSegment, onEdit }: MilestoneTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [billingFilter, setBillingFilter] = useState('all');
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof Milestone>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());

  // Toggle milestone expansion
  const toggleMilestoneExpansion = (milestoneId: string) => {
    const newExpanded = new Set(expandedMilestones);
    if (newExpanded.has(milestoneId)) {
      newExpanded.delete(milestoneId);
    } else {
      newExpanded.add(milestoneId);
    }
    setExpandedMilestones(newExpanded);
  };

  // Add loading state handling
  if (!milestones) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
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

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ milestoneId, status }: { milestoneId: string; status: string }) => {
      // Find the current milestone to validate status transition
      const currentMilestone = milestones.find(m => m.id === milestoneId);
      if (currentMilestone) {
        // Allow moving backwards from 'done' to other statuses, but prevent going back to 'todo'
        if (currentMilestone.status === 'done' && status === 'todo') {
          throw new Error('Cannot move completed milestone back to "Not Started" status');
        }
        // Prevent setting to 'done' without going through 'client_review'
        if (status === 'done' && currentMilestone.status !== 'client_review') {
          throw new Error('Milestone must go through client review before being marked as done');
        }
      }
      
      const response = await apiRequest('PUT', `/api/tasks/${milestoneId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: 'Success', description: 'Milestone status updated' });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({ title: 'Unauthorized', description: 'You are logged out. Logging in again...', variant: 'destructive' });
        setTimeout(() => { window.location.href = '/login'; }, 500);
        return;
      }
      toast({ title: 'Error', description: error?.message || 'Failed to update milestone status', variant: 'destructive' });
    },
  });

  // Billing status update mutation
  const updateBillingStatusMutation = useMutation({
    mutationFn: async ({ milestoneId, billingStatus }: { milestoneId: string; billingStatus: string }) => {
      const response = await apiRequest('PUT', `/api/tasks/${milestoneId}/billing-status`, { billingStatus });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: 'Success', description: 'Billing status updated' });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({ title: 'Error', description: 'Failed to update billing status', variant: 'destructive' });
      }
    },
  });

  // Bulk status update mutation
  const bulkStatusUpdateMutation = useMutation({
    mutationFn: async ({ milestoneIds, status }: { milestoneIds: string[]; status: string }) => {
      const promises = milestoneIds.map(id => 
        apiRequest('PUT', `/api/tasks/${id}`, { status })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setSelectedMilestones([]);
      toast({ title: 'Success', description: `${selectedMilestones.length} milestones updated` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: 'Failed to update milestones', variant: 'destructive' });
    },
  });

  // Filter and sort milestones
  const filteredMilestones = milestones
    .filter(milestone => {
      const matchesSearch = milestone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (milestone.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || milestone.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || milestone.priority === priorityFilter;
      const matchesBilling = billingFilter === 'all' || milestone.billingStatus === billingFilter;
      
      return matchesSearch && matchesStatus && matchesPriority && matchesBilling;
    })
    .sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];
      
      // Handle date fields
      if (sortField === 'startDate' || sortField === 'dueDate' || sortField === 'expectedInvoiceDate') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }
      
      // Handle numeric fields
      if (sortField === 'feeAmount') {
        aValue = parseFloat(aValue || '0');
        bValue = parseFloat(bValue || '0');
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Sorting function
  const handleSort = (field: keyof Milestone | keyof Subtask) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field as keyof Milestone);
      setSortDirection('asc');
    }
  };

  // Sort milestones and subtasks
  const sortedMilestones = [...filteredMilestones].sort((a, b) => {
    const aValue = a[sortField as keyof Milestone];
    const bValue = b[sortField as keyof Milestone];
    
    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    const comparison = aValue < bValue ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Handle bulk selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMilestones(filteredMilestones.map(m => m.id));
    } else {
      setSelectedMilestones([]);
    }
  };

  const handleSelectMilestone = (milestoneId: string, checked: boolean) => {
    if (checked) {
      setSelectedMilestones(prev => [...prev, milestoneId]);
    } else {
      setSelectedMilestones(prev => prev.filter(id => id !== milestoneId));
    }
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = (newStatus: string) => {
    if (selectedMilestones.length === 0) return;
    
    // Validate bulk status updates
    const invalidMilestones = selectedMilestones.filter(milestoneId => {
      const milestone = milestones.find(m => m.id === milestoneId);
      if (!milestone) return false;
      
      // Allow moving backwards from 'done' to other statuses, but prevent going back to 'todo'
      if (milestone.status === 'done' && newStatus === 'todo') {
        return true;
      }
      // Prevent setting to 'done' without going through 'review'
              if (newStatus === 'done' && milestone.status !== 'client_review') {
        return true;
      }
      
      return false;
    });
    
    if (invalidMilestones.length > 0) {
      toast({ 
        title: 'Validation Error', 
        description: 'Some milestones cannot be updated due to status transition rules', 
        variant: 'destructive' 
      });
      return;
    }
    
    bulkStatusUpdateMutation.mutate({ milestoneIds: selectedMilestones, status: newStatus });
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

  const formatCurrency = (amount?: string) => {
    if (!amount) return 'KSh 0';
    return `KSh ${parseFloat(amount).toLocaleString()}`;
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
      case 'todo': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'qa': return 'bg-purple-100 text-purple-800';
      case 'client_review': return 'bg-indigo-100 text-indigo-800';
      case 'done': return 'bg-green-100 text-green-800';
      case 'finished': return 'bg-green-100 text-green-800';
      case 'delayed': return 'bg-orange-100 text-orange-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'on_hold': return 'bg-red-100 text-red-800';
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
      'started': 'Started',
      'ongoing': 'Ongoing',
      'qa': 'QA',
      'client_review': 'Client Review',
      'done': 'Completed',
      'finished': 'Finished',
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

  // Calculate accurate progress percentage for milestones based on subtasks
  const calculateMilestoneProgress = (milestone: Milestone) => {
    if (!milestone.subtasks || milestone.subtasks.length === 0) {
      return 0;
    }
    
    const totalSubtasks = milestone.subtasks.length;
    const completedSubtasks = milestone.subtasks.filter(subtask => 
      subtask.status === 'finished'
    ).length;
    
    // Weight by priority for more accurate progress
    const weightedProgress = milestone.subtasks.reduce((total, subtask) => {
      const priorityWeight = {
        'low': 1,
        'medium': 2,
        'high': 3,
        'critical': 4
      }[subtask.priority] || 1;
      
      const progress = subtask.status === 'finished' ? 100 : 
                      subtask.status === 'ongoing' ? 75 :
                      subtask.status === 'started' ? 25 : 0;
      
      return total + (progress * priorityWeight);
    }, 0);
    
    const totalWeight = milestone.subtasks.reduce((total, subtask) => {
      const priorityWeight = {
        'low': 1,
        'medium': 2,
        'high': 3,
        'critical': 4
      }[subtask.priority] || 1;
      return total + priorityWeight;
    }, 0);
    
    return totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
  };

  if (milestones.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p>No milestones found for this project.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Milestones</CardTitle>
        <p className="text-sm text-gray-600">Track progress across all project milestones</p>
      </CardHeader>
      <CardContent>
        {/* Filters and Search */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search milestones..."
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

            <Select value={billingFilter} onValueChange={setBillingFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by billing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Billing Statuses</SelectItem>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="to_send">To Send</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedMilestones.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-blue-900">
                  {selectedMilestones.length} milestone(s) selected
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
                        <span className="text-sm text-gray-500">Updating {selectedMilestones.length} items...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Update status" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {/* Check if any selected milestones are completed to determine available options */}
                    {(() => {
                      const hasCompletedMilestones = selectedMilestones.some(milestoneId => {
                        const milestone = milestones.find(m => m.id === milestoneId);
                        return milestone?.status === 'done';
                      });
                      
                      return (
                        <>
                          {/* Only show 'todo' if no completed milestones are selected */}
                          {!hasCompletedMilestones && (
                            <SelectItem value="todo">Not Started</SelectItem>
                          )}
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="qa">QA</SelectItem>
                          <SelectItem value="client_review">Client Review</SelectItem>
                          <SelectItem value="client_review">Client Review</SelectItem>
                          <SelectItem value="done">Completed</SelectItem>
                          <SelectItem value="delayed">Delayed</SelectItem>
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
                  onClick={() => setSelectedMilestones([])}
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
                  Processing {selectedMilestones.length} milestone{selectedMilestones.length !== 1 ? 's' : ''}...
                </span>
              </div>
            </div>
          )}
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-3">
                  <Checkbox
                    checked={selectedMilestones.length === filteredMilestones.length && filteredMilestones.length > 0}
                    disabled={bulkStatusUpdateMutation.isPending}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th 
                  className="text-left p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Milestone</span>
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
                <th 
                  className="text-left p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('expectedInvoiceDate')}
                >
                  <div className="flex items-center space-x-1">
                    <CalendarDays className="h-4 w-4" />
                    <span>Expected Invoice</span>
                    {sortField === 'expectedInvoiceDate' && (
                      <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                                 <th className="text-left p-3">Expected Collection</th>
                 <th className="text-left p-3">Required Days</th>
                 <th className="text-left p-3">Segment</th>
                <th 
                  className="text-left p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('feeAmount')}
                >
                  <div className="flex items-center space-x-1">
                    <DollarSign className="h-4 w-4" />
                    <span>Amount</span>
                    {sortField === 'feeAmount' && (
                      <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
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
                <th 
                  className="text-left p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('billingStatus')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Invoice Status</span>
                    {sortField === 'billingStatus' && (
                      <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedMilestones.map((milestone) => (
                <React.Fragment key={milestone.id}>
                  {/* Main Milestone Row */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3">
                      <Checkbox
                        checked={selectedMilestones.includes(milestone.id)}
                        disabled={bulkStatusUpdateMutation.isPending}
                        onCheckedChange={(checked) => handleSelectMilestone(milestone.id, checked as boolean)}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        {/* Expand/Collapse Button */}
                        {milestone.subtasks && milestone.subtasks.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMilestoneExpansion(milestone.id)}
                            className="h-6 w-6 p-0 hover:bg-gray-200"
                          >
                            {expandedMilestones.has(milestone.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{milestone.name}</div>
                          {milestone.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {milestone.description}
                            </div>
                          )}
                          {/* Subtask count indicator */}
                          {milestone.subtasks && milestone.subtasks.length > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              {milestone.subtasks.length} subtask{milestone.subtasks.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  <td className="p-3">
                    <Badge className={getPriorityColor(milestone.priority)}>
                      {milestone.priority.charAt(0).toUpperCase() + milestone.priority.slice(1)}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {formatDate(milestone.startDate)}
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {formatDate(milestone.dueDate)}
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {formatDate(milestone.expectedInvoiceDate)}
                  </td>
                                     <td className="p-3 text-sm text-gray-600">
                     {calculateCollectionDate(milestone.expectedInvoiceDate)}
                   </td>
                   <td className="p-3 text-sm text-gray-600">
                     {calculateRequiredDays(milestone.startDate, milestone.dueDate)}
                   </td>
                   <td className="p-3">
                     <Badge variant="outline" className="capitalize">
                       {projectSegment}
                     </Badge>
                   </td>
                  <td className="p-3 text-sm font-medium text-gray-900">
                    {formatCurrency(milestone.feeAmount)}
                  </td>
                                     <td className="p-3">
                     <Select
                       value={milestone.status}
                       disabled={updateStatusMutation.isPending}
                       onValueChange={(value) => updateStatusMutation.mutate({
                         milestoneId: milestone.id,
                         status: value
                       })}
                     >
                       <SelectTrigger className={`w-32 relative ${
                         updateStatusMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''
                       } ${milestone.status === 'done' ? 'bg-green-50 border-green-200' : milestone.status === 'client_review' ? 'bg-yellow-50 border-yellow-200' : milestone.status === 'in_progress' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                         {updateStatusMutation.isPending ? (
                           <div className="flex items-center">
                             <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                             <span className="text-sm text-gray-500">Processing...</span>
                           </div>
                         ) : (
                           <SelectValue />
                         )}
                       </SelectTrigger>
                       <SelectContent>
                         {/* Show all statuses except 'todo' if milestone is completed */}
                         {milestone.status !== 'done' && (
                           <SelectItem value="todo">Not Started</SelectItem>
                         )}
                         <SelectItem value="in_progress">In Progress</SelectItem>
                         <SelectItem value="qa">QA</SelectItem>
                         <SelectItem value="client_review">Client Review</SelectItem>
                         <SelectItem value="done">Completed</SelectItem>
                         <SelectItem value="delayed">Delayed</SelectItem>
                         <SelectItem value="on_hold">On Hold</SelectItem>
                         <SelectItem value="cancelled">Cancelled</SelectItem>
                       </SelectContent>
                     </Select>
                   </td>
                   <td className="p-3">
                     <Select
                       value={milestone.billingStatus}
                       disabled={updateBillingStatusMutation.isPending}
                       onValueChange={(value) => updateBillingStatusMutation.mutate({
                         milestoneId: milestone.id,
                         billingStatus: value
                       })}
                     >
                       <SelectTrigger className={`w-32 relative ${
                         updateBillingStatusMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''
                       } ${milestone.billingStatus === 'paid' ? 'bg-green-50 border-green-200' : milestone.billingStatus === 'sent' ? 'bg-blue-50 border-blue-200' : milestone.billingStatus === 'to_send' ? 'bg-orange-50 border-orange-200' : milestone.billingStatus === 'overdue' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                         {updateBillingStatusMutation.isPending ? (
                           <div className="flex items-center">
                             <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                             <span className="text-sm text-gray-500">Updating...</span>
                           </div>
                         ) : (
                           <SelectValue />
                         )}
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="none">Not Sent</SelectItem>
                         <SelectItem value="to_send">To Send</SelectItem>
                         <SelectItem value="sent">Sent</SelectItem>
                         <SelectItem value="paid">Paid</SelectItem>
                         <SelectItem value="overdue">Overdue</SelectItem>
                         <SelectItem value="processing">Processing</SelectItem>
                       </SelectContent>
                     </Select>
                   </td>
                  <td className="p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(milestone)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </td>
                </tr>

                {/* Subtasks for expanded milestones */}
                {expandedMilestones.has(milestone.id) && milestone.subtasks && milestone.subtasks.length > 0 && (
                  <tr className="border-b border-gray-100">
                    <td colSpan={11} className="p-0">
                      <div className="bg-gray-50 border-t border-gray-200">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left p-3">
                                <Checkbox
                                  checked={selectedMilestones.includes(milestone.id)}
                                  disabled={bulkStatusUpdateMutation.isPending}
                                  onCheckedChange={(checked) => handleSelectMilestone(milestone.id, checked as boolean)}
                                />
                              </th>
                              <th 
                                className="text-left p-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => handleSort('name' as keyof Milestone)}
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
                                onClick={() => handleSort('priority' as keyof Milestone)}
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
                                onClick={() => handleSort('startDate' as keyof Milestone)}
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
                                onClick={() => handleSort('dueDate' as keyof Milestone)}
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
                                  <Clock className="h-4 w-4" />
                                  <span>Estimated Hours</span>
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
                                  <span>Assigned To</span>
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
                                onClick={() => handleSort('status' as keyof Milestone)}
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
                            {milestone.subtasks.map((subtask) => (
                              <tr key={subtask.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="p-3">
                                  <Checkbox
                                    checked={selectedMilestones.includes(milestone.id)}
                                    disabled={bulkStatusUpdateMutation.isPending}
                                    onCheckedChange={(checked) => handleSelectMilestone(milestone.id, checked as boolean)}
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
                                  {subtask.estimatedHours || 'N/A'}
                                </td>
                                <td className="p-3 text-sm text-gray-600">
                                  {subtask.estimatedDays || 'N/A'}
                                </td>
                                <td className="p-3 text-sm text-gray-600">
                                  {subtask.assignedUser ? (
                                    <div className="flex items-center space-x-2">
                                      <User className="h-4 w-4 text-gray-500" />
                                      <span className="font-medium">
                                        {subtask.assignedUser.firstName && subtask.assignedUser.lastName 
                                          ? `${subtask.assignedUser.firstName} ${subtask.assignedUser.lastName}`
                                          : subtask.assignedUser.email
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
                                    disabled={updateStatusMutation.isPending}
                                    onValueChange={(value) => updateStatusMutation.mutate({
                                      milestoneId: milestone.id,
                                      status: value
                                    })}
                                  >
                                    <SelectTrigger className={`w-32 relative ${
                                      updateStatusMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''
                                    } ${subtask.status === 'finished' ? 'bg-green-50 border-green-200' : subtask.status === 'started' ? 'bg-blue-50 border-blue-200' : subtask.status === 'ongoing' ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                                      {updateStatusMutation.isPending ? (
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
                                      <SelectItem value="started">Started</SelectItem>
                                      <SelectItem value="ongoing">Ongoing</SelectItem>
                                      <SelectItem value="finished">Finished</SelectItem>
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
                                    onClick={() => onEdit({ ...milestone, subtasks: milestone.subtasks?.map(s => s.id === subtask.id ? subtask : s) || [] })}
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
            Showing {filteredMilestones.length} of {milestones.length} milestones
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span>Total Value:</span>
              <span className="font-medium">
                {formatCurrency(milestones.reduce((sum, m) => sum + parseFloat(m.feeAmount || '0'), 0).toString())}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span>Paid:</span>
              <span className="font-medium text-green-600">
                {formatCurrency(milestones.filter(m => m.billingStatus === 'sent').reduce((sum, m) => sum + parseFloat(m.feeAmount || '0'), 0).toString())} {/* Changed from 'paid' to 'sent' */}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
