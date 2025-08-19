import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Search, Filter, CalendarDays, DollarSign, User, Clock, AlertTriangle, UserCheck, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';

interface Milestone {
  id: string;
  name: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in_progress' | 'review' | 'done';
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
          throw new Error('Cannot move completed milestone back to "To Do" status');
        }
        // Prevent setting to 'done' without going through 'review'
        if (status === 'done' && currentMilestone.status !== 'review') {
          throw new Error('Milestone must go through review before being marked as done');
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

  // Handle sorting
  const handleSort = (field: keyof Milestone) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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
      if (newStatus === 'done' && milestone.status !== 'review') {
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
      case 'review': return 'bg-yellow-100 text-yellow-800';
      case 'done': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'none': return 'bg-gray-100 text-gray-800';
      case 'to_send': return 'bg-orange-100 text-orange-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <AlertTriangle className="h-4 w-4" />;
      case 'review': return <UserCheck className="h-4 w-4" />;
      case 'done': return <CheckCircle className="h-4 w-4" />;
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
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="review">Review</SelectItem>
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
                            <SelectItem value="todo">To Do</SelectItem>
                          )}
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
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
                    <span>Milestone Name</span>
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
                    <span>Budget</span>
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
                    <span>Billing Status</span>
                    {sortField === 'billingStatus' && (
                      <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMilestones.map((milestone) => (
                <tr key={milestone.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <Checkbox
                      checked={selectedMilestones.includes(milestone.id)}
                      disabled={bulkStatusUpdateMutation.isPending}
                      onCheckedChange={(checked) => handleSelectMilestone(milestone.id, checked as boolean)}
                    />
                  </td>
                  <td className="p-3">
                    <div>
                      <div className="font-medium text-gray-900">{milestone.name}</div>
                      {milestone.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {milestone.description}
                        </div>
                      )}
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
                       } ${milestone.status === 'done' ? 'bg-green-50 border-green-200' : milestone.status === 'review' ? 'bg-yellow-50 border-yellow-200' : milestone.status === 'in_progress' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
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
                           <SelectItem value="todo">To Do</SelectItem>
                         )}
                         <SelectItem value="in_progress">In Progress</SelectItem>
                         <SelectItem value="review">Review</SelectItem>
                         <SelectItem value="done">Done</SelectItem>
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
                         <SelectItem value="none">None</SelectItem>
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
                {formatCurrency(milestones.filter(m => m.billingStatus === 'paid').reduce((sum, m) => sum + parseFloat(m.feeAmount || '0'), 0).toString())}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
