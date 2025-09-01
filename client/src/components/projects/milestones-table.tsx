import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DollarSign, 
  Calendar, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Edit,
  Trash2,
  Search
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Milestone {
  id: string;
  name: string;
  description?: string;
  feeAmount: number;
  billingStatus: string;
  expectedInvoiceDate: string;
  expectedCollectionDate: string;
  invoiceSentAt?: string;
  paymentReceivedAt?: string;
  overdueFlag: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MilestonesTableProps {
  milestones: Milestone[];
  projectSegment: string;
  onEdit?: (milestone: Milestone) => void;
  onDelete?: (milestoneId: string) => void;
}

export default function MilestonesTable({ 
  milestones, 
  projectSegment, 
  onEdit, 
  onDelete 
}: MilestonesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([]);

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'none': return 'bg-gray-100 text-gray-800';
      case 'to_send': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBillingStatusText = (status: string) => {
    switch (status) {
      case 'none': return 'Not Sent';
      case 'to_send': return 'To Send';
      case 'sent': return 'Invoice Sent';
      case 'paid': return 'Paid';
      case 'overdue': return 'Overdue';
      case 'processing': return 'Processing';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateDaysUntilDue = (dateString: string) => {
    if (!dateString) return null;
    const dueDate = new Date(dateString);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysUntilDueColor = (days: number) => {
    if (days < 0) return 'text-red-600'; // Overdue
    if (days <= 7) return 'text-orange-600'; // Due soon
    if (days <= 30) return 'text-yellow-600'; // Due this month
    return 'text-green-600'; // Due later
  };

  const getDaysUntilDueText = (days: number) => {
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days <= 7) return `Due in ${days} days`;
    if (days <= 30) return `Due in ${days} days`;
    return `Due in ${days} days`;
  };

  const totalFeeAmount = milestones.reduce((sum, milestone) => {
    const fee = milestone.feeAmount || 0;
    // Ensure we're working with valid numbers
    return sum + (typeof fee === 'number' ? fee : parseFloat(fee) || 0);
  }, 0);
  
  const paidAmount = milestones
    .filter(m => m.billingStatus === 'paid')
    .reduce((sum, milestone) => {
      const fee = milestone.feeAmount || 0;
      // Ensure we're working with valid numbers
      return sum + (typeof fee === 'number' ? fee : parseFloat(fee) || 0);
    }, 0);
  const pendingAmount = totalFeeAmount - paidAmount;

  // Filter milestones based on search and status
  const filteredMilestones = milestones.filter(milestone => {
    const matchesSearch = milestone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (milestone.description && milestone.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || milestone.billingStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle milestone selection
  const toggleMilestoneSelection = (milestoneId: string) => {
    setSelectedMilestones(prev => 
      prev.includes(milestoneId) 
        ? prev.filter(id => id !== milestoneId)
        : [...prev, milestoneId]
    );
  };

  // Handle bulk selection
  const toggleAllMilestones = () => {
    if (selectedMilestones.length === filteredMilestones.length) {
      setSelectedMilestones([]);
    } else {
      setSelectedMilestones(filteredMilestones.map(m => m.id));
    }
  };

  if (milestones.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Billing Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No billing milestones found for this project.</p>
            <p className="text-sm">Milestones will appear here once they are created.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(totalFeeAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Paid Amount</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(paidAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Amount</p>
                <p className="text-xl font-bold text-gray-900">
                                        {formatCurrency(pendingAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestones Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Milestone Details
          </CardTitle>
          <p className="text-sm text-gray-600">Manage billing milestones and invoice status</p>
        </CardHeader>
        <CardContent>
          {/* Filters and Search */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <SelectItem value="none">Not Sent</SelectItem>
                  <SelectItem value="to_send">To Send</SelectItem>
                  <SelectItem value="sent">Invoice Sent</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedMilestones.length === filteredMilestones.length && filteredMilestones.length > 0}
                  onChange={toggleAllMilestones}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">
                  {selectedMilestones.length} of {filteredMilestones.length} selected
                </span>
              </div>
            </div>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedMilestones.length === filteredMilestones.length && filteredMilestones.length > 0}
                    onChange={toggleAllMilestones}
                    className="rounded border-gray-300"
                  />
                </TableHead>
                <TableHead>Milestone</TableHead>
                <TableHead>Fee Amount</TableHead>
                <TableHead>Billing Status</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Collection Date</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMilestones.map((milestone) => {
              const daysUntilDue = calculateDaysUntilDue(milestone.expectedCollectionDate);

              return (
                  <TableRow key={milestone.id} className="hover:bg-gray-50">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedMilestones.includes(milestone.id)}
                        onChange={() => toggleMilestoneSelection(milestone.id)}
                        className="rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">{milestone.name}</div>
                        {milestone.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {milestone.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(milestone.feeAmount)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select 
                          value={milestone.billingStatus} 
                          onValueChange={(newStatus) => {
                            // Update milestone status
                            if (onEdit) {
                              onEdit({ ...milestone, billingStatus: newStatus });
                            }
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not Sent</SelectItem>
                            <SelectItem value="to_send">To Send</SelectItem>
                            <SelectItem value="sent">Invoice Sent</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                          {milestone.overdueFlag && (
                            <Badge className="bg-red-100 text-red-800">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                        </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">
                              {formatDate(milestone.expectedInvoiceDate)}
                          </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">
                                {formatDate(milestone.expectedCollectionDate)}
                              {daysUntilDue !== null && (
                          <div className={`text-xs ${getDaysUntilDueColor(daysUntilDue)}`}>
                                  {getDaysUntilDueText(daysUntilDue)}
                          </div>
                        )}
                            </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Created: {formatDate(milestone.createdAt)}</div>
                        {milestone.invoiceSentAt && (
                          <div>Invoice: {formatDate(milestone.invoiceSentAt)}</div>
                        )}
                        {milestone.paymentReceivedAt && (
                          <div>Paid: {formatDate(milestone.paymentReceivedAt)}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(milestone)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(milestone.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
