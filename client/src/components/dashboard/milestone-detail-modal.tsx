import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useScreenSize } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, DollarSign, User, AlertTriangle, CheckCircle, Clock, TrendingUp, FileText, ExternalLink, Building, Filter, X } from "lucide-react";
import { useState } from "react";

interface MilestoneDetailModalProps {
  type: "completed" | "overdue";
  trigger: React.ReactNode;
}

export default function MilestoneDetailModal({ type, trigger }: MilestoneDetailModalProps) {
  const auth = useAuth() as any;
  const { user, getDashboardType } = auth;
  const { isMobile, isTablet } = useScreenSize();
  const [isOpen, setIsOpen] = useState(false);
  const [filterConfig, setFilterConfig] = useState({
    showMilestones: true,
    showSubtasks: true,
    statusFilter: 'all',
    priorityFilter: 'all',
    projectSegment: 'all'
  });
  const dashboardType = getDashboardType();

  // Determine API endpoint and terminology based on dashboard type
  const getApiEndpoint = () => {
    if (dashboardType === 'project_manager') {
      return type === "completed" ? '/api/dashboard/completed-modules' : '/api/dashboard/overdue-modules';
    } else if (dashboardType === 'employee') {
      return type === "completed" ? '/api/dashboard/completed-subtasks' : '/api/dashboard/overdue-breakdown';
    } else {
      return type === "completed" ? '/api/dashboard/completed-milestones' : '/api/dashboard/overdue-combined';
    }
  };

  const getTerminology = () => {
    if (dashboardType === 'project_manager') {
      return { singular: 'module', plural: 'modules', title: 'Modules' };
    } else if (dashboardType === 'employee') {
      return { singular: 'subtask', plural: 'subtasks', title: 'Subtasks' };
    } else {
      return { singular: 'milestone', plural: 'milestones', title: 'Milestones' };
    }
  };

  const terms = getTerminology();
  const isProjectManager = dashboardType === 'project_manager';
  const isEmployee = dashboardType === 'employee';

  const { data: data, isLoading } = useQuery<any>({
    queryKey: [getApiEndpoint()],
    enabled: isOpen && !!user,
  });

  // Handle different response formats
  const isCombinedData = Array.isArray(data) && data.length > 0 && data[0]?.project && (data[0]?.milestones || data[0]?.subtasks);
  const isCompletedMilestonesResponse = data && typeof data === 'object' && 'milestones' in data && 'systemTotalMilestones' in data;
  const items = isCombinedData ? data : 
    (isCompletedMilestonesResponse ? data.milestones : 
    (Array.isArray(data) ? data : (data?.completedSubtasks || data?.overdueSubtasks || data?.overdueModules || [])));
  const systemTotalMilestones = isCompletedMilestonesResponse ? data.systemTotalMilestones : 0;


  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'client_review': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'to_send': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Group items by project
  const itemsByProject = isCombinedData ? 
    // For combined data, items are already grouped by project
    items.reduce((acc: any, projectGroup: any) => {
      acc[projectGroup.project.id] = {
        project: projectGroup.project,
        items: [
          ...projectGroup.milestones.map((milestone: any) => ({ ...milestone, type: 'milestone' })),
          ...projectGroup.subtasks.map((subtask: any) => ({ ...subtask, type: 'subtask' }))
        ]
      };
      return acc;
    }, {}) :
    // For regular data, group items by project
    items.reduce((acc: any, item: any) => {
      const projectId = item.project?.id || 'unknown';
      if (!acc[projectId]) {
        acc[projectId] = {
          project: item.project,
          items: []
        };
      }
      acc[projectId].items.push(item);
      return acc;
    }, {});


  // Calculate metrics based on type (completed vs overdue)
  const overdueMilestones = type === "overdue" ? (isCombinedData ? 
    items.reduce((sum: number, projectGroup: any) => sum + (projectGroup.milestones?.length || 0), 0) :
    items.length) : 0;
  const overdueSubtasks = type === "overdue" ? (isCombinedData ? 
    items.reduce((sum: number, projectGroup: any) => sum + (projectGroup.subtasks?.length || 0), 0) :
    0) : 0;
  
  const totalItems = type === "overdue" ? (overdueMilestones + overdueSubtasks) : items.length;
  
  // Calculate payment values for overdue milestones only
  const totalValue = type === "overdue" ? (isCombinedData ? 
    items.reduce((sum: number, projectGroup: any) => 
      sum + (projectGroup.milestones?.reduce((milSum: number, milestone: any) => 
        milSum + parseFloat(milestone.feeAmount || '0'), 0) || 0), 0) : 
    0) : 0;
  
  const paidValue = type === "overdue" ? (isCombinedData ? 
    items.reduce((sum: number, projectGroup: any) => 
      sum + (projectGroup.milestones?.reduce((milSum: number, milestone: any) => 
        milSum + (milestone.billingStatus === 'paid' ? parseFloat(milestone.feeAmount || '0') : 0), 0) || 0), 0) : 
    0) : 0;
  
  const pendingValue = totalValue - paidValue;

  // Calculate metrics for completed milestones
  const completedMilestones = type === "completed" ? items.length : 0;
  const totalMilestones = type === "completed" ? systemTotalMilestones : 0;
  const paidCompletedValue = type === "completed" ? 
    items.reduce((sum: number, item: any) => 
      sum + (item.billingStatus === 'paid' ? parseFloat(item.feeAmount || '0') : 0), 0) : 0;
  const sentButNotPaidValue = type === "completed" ? 
    items.reduce((sum: number, item: any) => 
      sum + (item.billingStatus === 'sent' ? parseFloat(item.feeAmount || '0') : 0), 0) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
             <DialogContent className={`max-w-6xl max-h-[90vh] flex flex-col ${isMobile ? 'w-[95vw]' : ''}`}>
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2">
            {type === "completed" ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Completed {terms.title}
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Overdue {terms.title}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {type === "completed" 
              ? `Detailed view of all completed ${terms.plural} across projects`
              : `${terms.title} that are past their due date and require attention`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-32 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Conditional Summary Cards */}
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : isProjectManager ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {type === "completed" ? (
                  <>
                    {/* Completed Milestones Summary Cards */}
                    <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-600">Completed {terms.title}</p>
                            <p className="text-2xl font-bold text-blue-900">{completedMilestones}</p>
                            <p className="text-xs text-blue-600 mt-1">{totalMilestones} total {terms.plural}</p>
                          </div>
                          <CheckCircle className="h-8 w-8 text-blue-600" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-r from-green-50 to-green-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-600">Invoices Paid</p>
                            <p className="text-2xl font-bold text-green-900">{formatCurrency(paidCompletedValue)}</p>
                            <p className="text-xs text-green-600 mt-1">Amount collected</p>
                          </div>
                          <DollarSign className="h-8 w-8 text-green-600" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-r from-orange-50 to-orange-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-orange-600">Invoices Sent but Not Paid</p>
                            <p className="text-2xl font-bold text-orange-900">{formatCurrency(sentButNotPaidValue)}</p>
                            <p className="text-xs text-orange-600 mt-1">Pending collection</p>
                          </div>
                          <Clock className="h-8 w-8 text-orange-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <>
                    {/* Overdue Milestones Summary Cards */}
                <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">Overdue Milestones</p>
                        <p className="text-2xl font-bold text-blue-900">{overdueMilestones}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-r from-red-50 to-red-100">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                        <p className="text-sm font-medium text-red-600">Overdue Subtasks</p>
                        <p className="text-2xl font-bold text-red-900">{overdueSubtasks}</p>
                        </div>
                      <Clock className="h-8 w-8 text-red-600" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-r from-orange-50 to-orange-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-orange-600">Pending Payment</p>
                            <p className="text-2xl font-bold text-orange-900">{formatCurrency(pendingValue)}</p>
                          </div>
                      <DollarSign className="h-8 w-8 text-orange-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              {/* Projects and Items */}
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">All Projects ({Object.keys(itemsByProject).length})</TabsTrigger>
                  <TabsTrigger value="by-project">By Project</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="space-y-4">
                  {/* Compact Filter section */}
                  <Card className="p-3">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Filters:</span>
                      </div>
                      
                      {/* Item Type Checkboxes */}
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={filterConfig.showMilestones}
                            onChange={(e) => setFilterConfig(prev => ({ ...prev, showMilestones: e.target.checked }))}
                            className="rounded h-3 w-3"
                          />
                          <span className="text-xs">Milestones</span>
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={filterConfig.showSubtasks}
                            onChange={(e) => setFilterConfig(prev => ({ ...prev, showSubtasks: e.target.checked }))}
                            className="rounded h-3 w-3"
                          />
                          <span className="text-xs">Subtasks</span>
                        </label>
                      </div>

                      {/* Priority Dropdown */}
                      <select
                        value={filterConfig.priorityFilter}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, priorityFilter: e.target.value }))}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="all">All Priorities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>

                      {/* Segment Dropdown */}
                      <select
                        value={filterConfig.projectSegment}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, projectSegment: e.target.value }))}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="all">All Segments</option>
                        <option value="private">Private</option>
                        <option value="academic">Academic</option>
                        <option value="parastatal">Parastatal</option>
                      </select>

                      {/* Time-based filter for completed milestones */}
                      {type === "completed" && (
                        <select
                          value={filterConfig.statusFilter}
                          onChange={(e) => setFilterConfig(prev => ({ ...prev, statusFilter: e.target.value }))}
                          className="text-xs border rounded px-2 py-1"
                        >
                          <option value="all">All Time</option>
                          <option value="last_week">Last 7 Days</option>
                          <option value="last_month">Last 30 Days</option>
                          <option value="last_quarter">Last 90 Days</option>
                        </select>
                      )}
                      
                      {/* Clear Filters */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilterConfig({
                          showMilestones: true,
                          showSubtasks: true,
                          statusFilter: 'all',
                          priorityFilter: 'all',
                          projectSegment: 'all'
                        })}
                        className="text-xs h-6 px-2 flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </Button>
                    </div>
                  </Card>

                  {/* Filtered Projects */}
                  {Object.values(itemsByProject).filter((projectGroup: any) => {
                    if (filterConfig.projectSegment !== 'all') {
                      if (projectGroup.project?.segment !== filterConfig.projectSegment) {
                        return false;
                      }
                    }
                    
                    // Time-based filtering for completed milestones
                    if (type === "completed" && filterConfig.statusFilter !== 'all') {
                      const now = new Date();
                      const filterDate = new Date();
                      
                      switch (filterConfig.statusFilter) {
                        case 'last_week':
                          filterDate.setDate(now.getDate() - 7);
                          break;
                        case 'last_month':
                          filterDate.setDate(now.getDate() - 30);
                          break;
                        case 'last_quarter':
                          filterDate.setDate(now.getDate() - 90);
                          break;
                      }
                      
                      // Filter items based on completion date
                      const filteredItems = projectGroup.items.filter((item: any) => {
                        const completionDate = item.paymentReceivedAt || item.endDate || item.updatedAt;
                        if (!completionDate) return false;
                        return new Date(completionDate) >= filterDate;
                      });
                      
                      // Only show project if it has items matching the time filter
                      if (filteredItems.length === 0) {
                        return false;
                      }
                    }
                    
                    return true;
                  }).map((projectGroup: any) => {
                    // Apply time-based filtering to items within each project
                    let filteredItems = projectGroup.items;
                    
                    if (type === "completed" && filterConfig.statusFilter !== 'all') {
                      const now = new Date();
                      const filterDate = new Date();
                      
                      switch (filterConfig.statusFilter) {
                        case 'last_week':
                          filterDate.setDate(now.getDate() - 7);
                          break;
                        case 'last_month':
                          filterDate.setDate(now.getDate() - 30);
                          break;
                        case 'last_quarter':
                          filterDate.setDate(now.getDate() - 90);
                          break;
                      }
                      
                      filteredItems = projectGroup.items.filter((item: any) => {
                        const completionDate = item.paymentReceivedAt || item.endDate || item.updatedAt;
                        if (!completionDate) return false;
                        return new Date(completionDate) >= filterDate;
                      });
                    }
                    
                    return { ...projectGroup, items: filteredItems };
                  }).filter((projectGroup: any) => projectGroup.items.length > 0).map((projectGroup: any) => (
                    <Card key={projectGroup.project?.id} className="overflow-hidden">
                      <CardHeader className={type === "completed" ? "bg-green-50" : "bg-gray-50"}>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{projectGroup.project?.name}</span>
                            <Badge variant="outline" className="capitalize">
                              {projectGroup.project?.segment || 'private'}
                            </Badge>
                            <Badge className={getStatusColor(projectGroup.project?.status)}>
                              {projectGroup.project?.status}
                            </Badge>
                            {type === "completed" && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Completed
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">
                            {projectGroup.items.length} {terms.singular}{projectGroup.items.length !== 1 ? 's' : ''}
                          </span>
                            {type === "completed" && (
                              <span className="text-sm font-medium text-green-600">
                                {formatCurrency(projectGroup.items.reduce((sum: number, item: any) => 
                                  sum + parseFloat(item.feeAmount || '0'), 0))}
                              </span>
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {isCombinedData ? (
                          <div className="space-y-6">
                            {/* Milestones Section */}
                            {filterConfig.showMilestones && projectGroup.items.filter((item: any) => 
                              item.type === 'milestone' && 
                              (filterConfig.priorityFilter === 'all' || item.priority === filterConfig.priorityFilter)
                            ).length > 0 && (
                              <div>
                                <div className={`px-4 py-2 border-b ${type === "completed" ? "bg-green-50" : "bg-blue-50"}`}>
                                  <h4 className={`font-medium ${type === "completed" ? "text-green-900" : "text-blue-900"}`}>
                                    {type === "completed" ? "Completed Milestones" : "Overdue Milestones"}
                                  </h4>
                                </div>
                                <div className="divide-y divide-gray-200">
                                  {projectGroup.items.filter((item: any) => 
                                    item.type === 'milestone' && 
                                    (filterConfig.priorityFilter === 'all' || item.priority === filterConfig.priorityFilter)
                                  ).map((item: any) => (
                                    <div key={item.id} className={`p-4 hover:bg-gray-50 ${type === "completed" ? "border-l-4 border-l-green-500" : ""}`}>
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1 space-y-2">
                                          <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-gray-900">{item.name}</h4>
                                            <Badge className={getPriorityColor(item.priority)}>
                                              {item.priority}
                                            </Badge>
                                            <Badge className={getBillingStatusColor(item.billingStatus)}>
                                              {item.billingStatus}
                                            </Badge>
                                            {type === "completed" && (
                                              <Badge className="bg-green-100 text-green-800">
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                Completed
                                              </Badge>
                                            )}
                                          </div>
                                          
                                          {item.description && (
                                            <p className="text-sm text-gray-600">{item.description}</p>
                                          )}
                                          
                                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                            {type === "completed" ? (
                                              <>
                                                <div className="flex items-center gap-1">
                                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                                  <span>Completed: {formatDate(item.paymentReceivedAt || item.endDate)}</span>
                                                </div>
                                                {item.startDate && (
                                                  <div className="flex items-center gap-1">
                                                    <Calendar className="h-4 w-4" />
                                                    <span>Started: {formatDate(item.startDate)}</span>
                                                  </div>
                                                )}
                                                {item.endDate && item.startDate && (
                                                  <div className="flex items-center gap-1">
                                                    <Clock className="h-4 w-4" />
                                                    <span>Duration: {Math.ceil((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (1000 * 60 * 60 * 24))} days</span>
                                                  </div>
                                                )}
                                              </>
                                            ) : (
                                            <div className="flex items-center gap-1">
                                              <Calendar className="h-4 w-4" />
                                              <span>Due: {formatDate(item.endDate)}</span>
                                            </div>
                                            )}
                                    
                                    {item.paymentReceivedAt && (
                                      <div className="flex items-center gap-1">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span>Paid: {formatDate(item.paymentReceivedAt)}</span>
                                      </div>
                                    )}
                                    
                                    {!isProjectManager && !isEmployee && (
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="h-4 w-4" />
                                        <span>{formatCurrency(item.feeAmount)}</span>
                                      </div>
                                    )}
                                    
                                    {isEmployee && item.module && (
                                      <div className="flex items-center gap-1">
                                        <FileText className="h-4 w-4" />
                                        <span>Module: {item.module.name}</span>
                                      </div>
                                    )}
                                    
                                    {isEmployee && item.estimatedHours && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        <span>{item.estimatedHours}h estimated</span>
                                      </div>
                                    )}
                                    
                                    {isEmployee && item.actualHours && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        <span>{item.actualHours}h actual</span>
                                      </div>
                                    )}
                                    
                                    {item.createdBy && (
                                      <div className="flex items-center gap-1">
                                        <User className="h-4 w-4" />
                                        <span>{item.createdBy.firstName || item.createdBy.email}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(`/projects/${item.projectId}`, '_blank')}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    View Project
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Subtasks Section */}
                    {filterConfig.showSubtasks && projectGroup.items.filter((item: any) => 
                      item.type === 'subtask' && 
                      (filterConfig.priorityFilter === 'all' || item.priority === filterConfig.priorityFilter)
                    ).length > 0 && (
                      <div>
                        <div className={`px-4 py-2 border-b ${type === "completed" ? "bg-green-50" : "bg-orange-50"}`}>
                          <h4 className={`font-medium ${type === "completed" ? "text-green-900" : "text-orange-900"}`}>
                            {type === "completed" ? "Completed Subtasks" : "Overdue Subtasks"}
                          </h4>
                        </div>
                        <div className="divide-y divide-gray-200">
                          {projectGroup.items.filter((item: any) => 
                            item.type === 'subtask' && 
                            (filterConfig.priorityFilter === 'all' || item.priority === filterConfig.priorityFilter)
                          ).map((item: any) => (
                            <div key={item.id} className={`p-4 hover:bg-gray-50 ${type === "completed" ? "border-l-4 border-l-green-500" : ""}`}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-gray-900">{item.name}</h4>
                                    <Badge className={getPriorityColor(item.priority)}>
                                      {item.priority}
                                    </Badge>
                                    <Badge variant="outline" className={type === "completed" ? "text-green-600" : "text-orange-600"}>
                                      Subtask
                                    </Badge>
                                    {type === "completed" && (
                                      <Badge className="bg-green-100 text-green-800">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Completed
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {item.description && (
                                    <p className="text-sm text-gray-600">{item.description}</p>
                                  )}
                                  
                                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                    {type === "completed" ? (
                                      <>
                                        <div className="flex items-center gap-1">
                                          <CheckCircle className="h-4 w-4 text-green-600" />
                                          <span>Completed: {formatDate(item.updatedAt || item.dueDate)}</span>
                                        </div>
                                        {item.startDate && (
                                          <div className="flex items-center gap-1">
                                            <Calendar className="h-4 w-4" />
                                            <span>Started: {formatDate(item.startDate)}</span>
                                          </div>
                                        )}
                                        {item.dueDate && item.startDate && (
                                          <div className="flex items-center gap-1">
                                            <Clock className="h-4 w-4" />
                                            <span>Duration: {Math.ceil((new Date(item.dueDate).getTime() - new Date(item.startDate).getTime()) / (1000 * 60 * 60 * 24))} days</span>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4" />
                                      <span>Due: {formatDate(item.dueDate)}</span>
                                    </div>
                                    )}
                                    
                                    {item.module && (
                                      <div className="flex items-center gap-1">
                                        <FileText className="h-4 w-4" />
                                        <span>Module: {item.module.name}</span>
                                      </div>
                                    )}
                                    
                                    {item.estimatedHours && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        <span>{item.estimatedHours}h estimated</span>
                                      </div>
                                    )}
                                    
                                    {item.actualHours && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        <span>{item.actualHours}h actual</span>
                                      </div>
                                    )}
                                    
                                    {item.assignedUser && (
                                      <div className="flex items-center gap-1">
                                        <User className="h-4 w-4" />
                                        <span>{item.assignedUser.firstName || item.assignedUser.email}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(`/projects/${item.project.id}`, '_blank')}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    View Project
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {projectGroup.items.map((item: any) => (
                      <div key={item.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900">{item.name}</h4>
                              <Badge className={getPriorityColor(item.priority)}>
                                {item.priority}
                              </Badge>
                              {!isProjectManager && !isEmployee && (
                                <Badge className={getBillingStatusColor(item.billingStatus)}>
                                  {item.billingStatus}
                                </Badge>
                              )}
                            </div>
                            
                            {item.description && (
                              <p className="text-sm text-gray-600">{item.description}</p>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>Due: {formatDate(item.endDate || item.dueDate)}</span>
                              </div>
                              
                              {item.paymentReceivedAt && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span>Paid: {formatDate(item.paymentReceivedAt)}</span>
                                </div>
                              )}
                              
                              {!isProjectManager && !isEmployee && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-4 w-4" />
                                  <span>{formatCurrency(item.feeAmount)}</span>
                                </div>
                              )}
                              
                              {isEmployee && item.module && (
                                <div className="flex items-center gap-1">
                                  <FileText className="h-4 w-4" />
                                  <span>Module: {item.module.name}</span>
                                </div>
                              )}
                              
                              {isEmployee && item.estimatedHours && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  <span>{item.estimatedHours}h estimated</span>
                                </div>
                              )}
                              
                              {isEmployee && item.actualHours && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  <span>{item.actualHours}h actual</span>
                                </div>
                              )}
                              
                              {item.createdBy && (
                                <div className="flex items-center gap-1">
                                  <User className="h-4 w-4" />
                                  <span>{item.createdBy.firstName || item.createdBy.email}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`/projects/${item.projectId || item.project?.id}`, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View Project
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
                
        <TabsContent value="by-project" className="space-y-4">
                  <div className="grid gap-4">
                    {Object.values(itemsByProject).map((projectGroup: any) => {
                      const milestones = projectGroup.items || [];
                      const subtasks: any[] = [];
                      
                      return (
                      <Card key={projectGroup.project?.id}>
                        <CardHeader className={type === "completed" ? "bg-green-50" : ""}>
                            <CardTitle className="text-lg flex items-center justify-between">
                              <div className="flex items-center gap-3">
                              {projectGroup.project?.name}
                              <Badge variant="outline" className="capitalize">
                                {projectGroup.project?.segment || 'private'}
                              </Badge>
                              <Badge className={getStatusColor(projectGroup.project?.status)}>
                                {projectGroup.project?.status}
                              </Badge>
                                {type === "completed" && (
                                  <Badge className="bg-green-100 text-green-800">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Completed
                                  </Badge>
                                )}
                              </div>
                              {type === "completed" && (
                                <div className="text-right">
                                  <div className="text-sm text-gray-600">
                                    {milestones.length} of {projectGroup.project?.totalMilestones || 0} milestones
                                  </div>
                                  <div className="text-xs text-gray-500 mb-1">
                                    {projectGroup.project?.totalMilestones ? 
                                      Math.round((milestones.length / projectGroup.project.totalMilestones) * 100) : 0}% completion
                                  </div>
                                  {projectGroup.project?.totalMilestones && (
                                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-green-500 transition-all duration-300"
                                        style={{ 
                                          width: `${Math.min((milestones.length / projectGroup.project.totalMilestones) * 100, 100)}%` 
                                        }}
                                      ></div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                              {/* Project Information */}
                              {type === "completed" && (
                                <div className="p-3 bg-gray-50 rounded-lg">
                                  <h4 className="font-medium text-gray-900 mb-2">Project Information</h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-600">Client:</span>
                                      <span className="ml-2 font-medium">{projectGroup.project?.client || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Contact:</span>
                                      <span className="ml-2 font-medium">{projectGroup.project?.contactEmail || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Total Project Value:</span>
                                      <span className="ml-2 font-medium">
                                        {formatCurrency(projectGroup.project?.totalProjectValue || 0)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Completion Rate:</span>
                                      <span className="ml-2 font-medium text-green-600">
                                        {projectGroup.project?.totalMilestones ? 
                                          Math.round((milestones.length / projectGroup.project.totalMilestones) * 100) : 0}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Milestone Metrics */}
                              {milestones.length > 0 && (
                                <div className={`p-3 rounded-lg ${type === "completed" ? "bg-green-50" : "bg-blue-50"}`}>
                                  <h4 className={`font-medium mb-2 ${type === "completed" ? "text-green-900" : "text-blue-900"}`}>
                                    {type === "completed" ? "Completed Milestones" : "Overdue Milestones"}
                                  </h4>
                                  <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                      <span>Count:</span>
                                      <span className="font-medium">{milestones.length}</span>
                            </div>
                                {type === "completed" ? (
                                  <>
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Invoices Paid:</span>
                                      <span className="font-medium text-green-600">
                                        {formatCurrency(milestones.reduce((sum: number, m: any) => 
                                          sum + (m.billingStatus === 'paid' ? parseFloat(m.feeAmount || '0') : 0), 0
                                        ))}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Invoices Sent but Not Paid:</span>
                                      <span className="font-medium text-orange-600">
                                        {formatCurrency(milestones.reduce((sum: number, m: any) => 
                                          sum + (m.billingStatus === 'sent' ? parseFloat(m.feeAmount || '0') : 0), 0
                                        ))}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                <div className="flex items-center justify-between text-sm">
                                  <span>Total Value:</span>
                                  <span className="font-medium">
                                        {formatCurrency(milestones.reduce((sum: number, m: any) => 
                                      sum + parseFloat(m.feeAmount || '0'), 0
                                    ))}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                      <span>Pending Payment:</span>
                                      <span className="font-medium text-orange-600">
                                        {formatCurrency(milestones.reduce((sum: number, m: any) => 
                                          sum + (m.billingStatus !== 'paid' ? parseFloat(m.feeAmount || '0') : 0), 0
                                    ))}
                                  </span>
                                </div>
                                  </>
                                )}
                                  </div>
                                </div>
                              )}

                              {/* Completion Timeline for Completed Milestones */}
                              {type === "completed" && milestones.length > 0 && (
                                <div className="p-3 bg-blue-50 rounded-lg">
                                  <h4 className="font-medium text-blue-900 mb-2">Completion Timeline</h4>
                                  <div className="space-y-2">
                                    {milestones
                                      .sort((a: any, b: any) => new Date(b.paymentReceivedAt || b.endDate).getTime() - new Date(a.paymentReceivedAt || a.endDate).getTime())
                                      .slice(0, 3)
                                      .map((milestone: any, index: number) => (
                                        <div key={milestone.id} className="flex items-center justify-between text-sm">
                                          <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="font-medium">{milestone.name}</span>
                                          </div>
                                          <div className="text-gray-600">
                                            {formatDate(milestone.paymentReceivedAt || milestone.endDate)}
                                          </div>
                                        </div>
                                      ))}
                                    {milestones.length > 3 && (
                                      <div className="text-xs text-gray-500 text-center">
                                        +{milestones.length - 3} more milestones
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                               {/* Subtask Metrics - Not applicable for completed milestones */}
                               {false && (
                                <div className={`p-3 rounded-lg ${type === "completed" ? "bg-green-50" : "bg-red-50"}`}>
                                  <h4 className={`font-medium mb-2 ${type === "completed" ? "text-green-900" : "text-red-900"}`}>
                                    {type === "completed" ? "Completed Subtasks" : "Overdue Subtasks"}
                                  </h4>
                                  <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                      <span>Count:</span>
                                      <span className="font-medium">{subtasks.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                      <span>By Priority:</span>
                                      <div className="flex gap-1">
                                        {['critical', 'high', 'medium', 'low'].map(priority => {
                                          const count = subtasks.filter((s: any) => s.priority === priority).length;
                                          if (count > 0) {
                                            return (
                                              <Badge key={priority} variant="outline" className="text-xs">
                                                {priority}: {count}
                                              </Badge>
                                            );
                                          }
                                          return null;
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Client/Project Info */}
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span>Client Email:</span>
                                    <span className="font-medium text-sm">{projectGroup.project?.contactEmail || projectGroup.project?.client}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span>Total Items:</span>
                                    <span className="font-medium">{milestones.length + subtasks.length}</span>
                                  </div>
                                </div>
                              </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                </TabsContent>
                
                <TabsContent value="summary" className="space-y-4">
                  <div className="grid gap-4">
                    {/* Overdue Overview */}
                      <Card>
                        <CardHeader>
                        <CardTitle>Overdue Overview</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {isCombinedData && (
                            <>
                              {/* Overview for Combined Data */}
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="p-3 bg-blue-50 rounded-lg">
                                  <h4 className="font-medium text-blue-900 mb-2">Milestone Summary</h4>
                                  <div className="space-y-2">
                                    {items.reduce((sum: number, projectGroup: any) => sum + (projectGroup.milestones?.length || 0), 0) > 0 && (
                                      <>
                                        <div className="flex items-center justify-between text-sm">
                                          <span>Count:</span>
                                          <span className="font-medium text-blue-900">
                                            {items.reduce((sum: number, projectGroup: any) => sum + (projectGroup.milestones?.length || 0), 0)}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                          <span>Total Value:</span>
                                          <span className="font-medium">
                                            {formatCurrency(items.reduce((sum: number, projectGroup: any) => 
                                              sum + (projectGroup.milestones?.reduce((milSum: number, m: any) => 
                                                milSum + parseFloat(m.feeAmount || '0'), 0) || 0), 0)
                                            )}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                          <span>Pending Payment:</span>
                                          <span className="font-medium text-orange-600">
                                            {formatCurrency(pendingValue)}
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                <div className={`p-3 rounded-lg ${type === "completed" ? "bg-green-50" : "bg-red-50"}`}>
                                  <h4 className={`font-medium mb-2 ${type === "completed" ? "text-green-900" : "text-red-900"}`}>
                                    {type === "completed" ? "Completed Subtask Summary" : "Overdue Subtask Summary"}
                                  </h4>
                                  <div className="space-y-2">
                                    {items.reduce((sum: number, projectGroup: any) => sum + (projectGroup.subtasks?.length || 0), 0) > 0 && (
                                      <>
                                        <div className="flex items-center justify-between text-sm">
                                          <span>Count:</span>
                                          <span className="font-medium text-red-900">
                                            {items.reduce((sum: number, projectGroup: any) => sum + (projectGroup.subtasks?.length || 0), 0)}
                                          </span>
                                        </div>
                                        {['critical', 'high', 'medium', 'low'].map((priority) => {
                                          const count = items.reduce((sum: number, projectGroup: any) => 
                                            sum + (projectGroup.subtasks?.filter((s: any) => s.priority === priority).length || 0), 0);
                                          if (count > 0) {
                                            return (
                                              <div key={priority} className="flex items-center justify-between text-xs">
                                                <span className="capitalize">{priority}:</span>
                                                <span className="font-medium">{count}</span>
                                              </div>
                                            );
                                          }
                                          return null;
                                        })}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Payment Status Analysis */}
                              <Card className="bg-gray-50">
                                <CardHeader>
                                  <CardTitle className="text-lg">
                                    {type === "completed" ? "Payment Collection Analysis" : "Payment Analysis"}
                                  </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {['paid', 'sent', 'to_send', 'none'].map((status) => {
                                      const count = items.reduce((totalSum: number, projectGroup: any) => 
                                        totalSum + (projectGroup.milestones?.filter((m: any) => m.billingStatus === status).length || 0), 0);
                                      const value = items.reduce((totalValue: number, projectGroup: any) => 
                                        totalValue + (projectGroup.milestones?.filter((m: any) => m.billingStatus === status)
                                          .reduce((milSum: number, m: any) => milSum + parseFloat(m.feeAmount || '0'), 0) || 0), 0);
                              
                              return (
                                <div key={status} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge className={getBillingStatusColor(status)}>
                                      {status.replace('_', ' ')}
                                    </Badge>
                                            <span className="text-sm text-gray-600">{count} milestones</span>
                                  </div>
                                  <span className="font-medium">{formatCurrency(value)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                            </>
                          )}
                          
                          {!isCombinedData && (
                            <>
                              <div className={`p-3 rounded-lg ${type === "completed" ? "bg-green-50" : "bg-gray-100"}`}>
                                <h4 className={`font-medium mb-2 ${type === "completed" ? "text-green-900" : ""}`}>
                                  {type === "completed" ? "Completion Summary" : "General Summary"}
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span>{type === "completed" ? "Total Completed:" : "Total Items:"}</span>
                                    <span className="font-medium">{totalItems}</span>
                                  </div>
                                  {type === "completed" && !isProjectManager && !isEmployee && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Invoices Paid:</span>
                                      <span className="font-medium text-green-600">{formatCurrency(paidCompletedValue)}</span>
                                    </div>
                                  )}
                                  {type === "completed" && !isProjectManager && !isEmployee && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Invoices Sent but Not Paid:</span>
                                      <span className="font-medium text-orange-600">{formatCurrency(sentButNotPaidValue)}</span>
                                    </div>
                                  )}
                                  {type === "overdue" && !isProjectManager && !isEmployee && (
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Pending Payment:</span>
                                      <span className="font-medium text-orange-600">{formatCurrency(pendingValue)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {isEmployee && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Time Tracking Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Total Estimated Hours:</span>
                              <span className="font-medium">
                                {items.reduce((sum: number, m: any) => sum + (parseFloat(m.estimatedHours || '0')), 0)}h
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Total Actual Hours:</span>
                              <span className="font-medium text-blue-600">
                                {items.reduce((sum: number, m: any) => sum + (parseFloat(m.actualHours || '0')), 0)}h
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Efficiency:</span>
                              <span className="font-medium">
                                {(() => {
                                  const estimated = items.reduce((sum: number, m: any) => sum + (parseFloat(m.estimatedHours || '0')), 0);
                                  const actual = items.reduce((sum: number, m: any) => sum + (parseFloat(m.actualHours || '0')), 0);
                                  return estimated > 0 ? Math.round((actual / estimated) * 100) : 0;
                                })()}%
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Priority Distribution */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Priority Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {['critical', 'high', 'medium', 'low'].map((priority) => {
                            let count = 0;
                            if (isCombinedData) {
                              count = items.reduce((totalSum: number, projectGroup: any) => 
                                totalSum + (
                                  (projectGroup.milestones?.filter((item: any) => item.priority === priority).length || 0) +
                                  (projectGroup.subtasks?.filter((item: any) => item.priority === priority).length || 0)
                                ), 0);
                            } else {
                              count = items.filter((m: any) => m.priority === priority).length;
                            }
                            const percentage = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
                            
                            return (
                              <div key={priority} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge className={getPriorityColor(priority)}>
                                    {priority}
                                  </Badge>
                                  <span className="text-sm text-gray-600">{count} items</span>
                                </div>
                                <span className="font-medium">{percentage}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
