import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useScreenSize } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, DollarSign, User, AlertTriangle, CheckCircle, Clock, TrendingUp, FileText, ExternalLink } from "lucide-react";
import { useState } from "react";

interface MilestoneDetailModalProps {
  type: "completed" | "overdue";
  trigger: React.ReactNode;
}

export default function MilestoneDetailModal({ type, trigger }: MilestoneDetailModalProps) {
  const auth = useAuth() as any;
  const { user } = auth;
  const { isMobile, isTablet } = useScreenSize();
  const [isOpen, setIsOpen] = useState(false);

  const { data: milestones = [], isLoading } = useQuery<any[]>({
    queryKey: type === "completed" ? ['/api/dashboard/completed-milestones'] : ['/api/dashboard/overdue-tasks'],
    enabled: isOpen && !!user,
  });

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

  // Group milestones by project
  const milestonesByProject = milestones.reduce((acc: any, milestone: any) => {
    const projectId = milestone.project?.id || 'unknown';
    if (!acc[projectId]) {
      acc[projectId] = {
        project: milestone.project,
        milestones: []
      };
    }
    acc[projectId].milestones.push(milestone);
    return acc;
  }, {});

  const totalMilestones = milestones.length;
  const totalValue = milestones.reduce((sum: number, m: any) => sum + (parseFloat(m.feeAmount || '0')), 0);
  const paidValue = milestones.reduce((sum: number, m: any) => 
    sum + (m.billingStatus === 'sent' ? parseFloat(m.feeAmount || '0') : 0), 0 // Changed from 'paid' to 'sent'
  );
  const pendingValue = totalValue - paidValue;

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
                Completed Milestones
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Overdue Milestones
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {type === "completed" 
              ? "Detailed view of all completed milestones across projects"
              : "Milestones that are past their due date and require attention"
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
              {/* Summary Cards */}
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-4'}`}>
                <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">Total Milestones</p>
                        <p className="text-2xl font-bold text-blue-900">{totalMilestones}</p>
                      </div>
                      <FileText className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-r from-green-50 to-green-100">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600">Total Value</p>
                        <p className="text-2xl font-bold text-green-900">{formatCurrency(totalValue)}</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-600">Paid Amount</p>
                        <p className="text-2xl font-bold text-purple-900">{formatCurrency(paidValue)}</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-purple-600" />
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
                      <Clock className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Projects and Milestones */}
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">All Projects ({Object.keys(milestonesByProject).length})</TabsTrigger>
                  <TabsTrigger value="by-project">By Project</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="space-y-4">
                  {Object.values(milestonesByProject).map((projectGroup: any) => (
                    <Card key={projectGroup.project?.id} className="overflow-hidden">
                      <CardHeader className="bg-gray-50">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{projectGroup.project?.name}</span>
                            <Badge variant="outline" className="capitalize">
                              {projectGroup.project?.segment || 'private'}
                            </Badge>
                            <Badge className={getStatusColor(projectGroup.project?.status)}>
                              {projectGroup.project?.status}
                            </Badge>
                          </div>
                          <span className="text-sm text-gray-600">
                            {projectGroup.milestones.length} milestone{projectGroup.milestones.length !== 1 ? 's' : ''}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y divide-gray-200">
                          {projectGroup.milestones.map((milestone: any) => (
                            <div key={milestone.id} className="p-4 hover:bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-gray-900">{milestone.name}</h4>
                                    <Badge className={getPriorityColor(milestone.priority)}>
                                      {milestone.priority}
                                    </Badge>
                                    <Badge className={getBillingStatusColor(milestone.billingStatus)}>
                                      {milestone.billingStatus}
                                    </Badge>
                                  </div>
                                  
                                  {milestone.description && (
                                    <p className="text-sm text-gray-600">{milestone.description}</p>
                                  )}
                                  
                                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4" />
                                      <span>Due: {formatDate(milestone.dueDate)}</span>
                                    </div>
                                    
                                    {milestone.completedAt && (
                                      <div className="flex items-center gap-1">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span>Completed: {formatDate(milestone.completedAt)}</span>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center gap-1">
                                      <DollarSign className="h-4 w-4" />
                                      <span>{formatCurrency(milestone.feeAmount)}</span>
                                    </div>
                                    
                                    {milestone.assignedUser && (
                                      <div className="flex items-center gap-1">
                                        <User className="h-4 w-4" />
                                        <span>{milestone.assignedUser.firstName || milestone.assignedUser.email}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(`/projects/${milestone.projectId}`, '_blank')}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    View Project
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
                
                <TabsContent value="by-project" className="space-y-4">
                  <div className="grid gap-4">
                    {Object.values(milestonesByProject).map((projectGroup: any) => (
                      <Card key={projectGroup.project?.id}>
                        <CardHeader>
                          <CardTitle className="text-lg">{projectGroup.project?.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <span>Total Milestones:</span>
                              <span className="font-medium">{projectGroup.milestones.length}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span>Total Value:</span>
                              <span className="font-medium">
                                {formatCurrency(projectGroup.milestones.reduce((sum: number, m: any) => 
                                  sum + parseFloat(m.feeAmount || '0'), 0
                                ))}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span>Paid Amount:</span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(projectGroup.milestones.reduce((sum: number, m: any) => 
                                  sum + (m.billingStatus === 'sent' ? parseFloat(m.feeAmount || '0') : 0), 0
                                ))}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="summary" className="space-y-4">
                  <div className="grid gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Billing Status Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {['paid', 'sent', 'to_send', 'none'].map((status) => {
                            const count = milestones.filter((m: any) => m.billingStatus === status).length;
                            const value = milestones
                              .filter((m: any) => m.billingStatus === status)
                              .reduce((sum: number, m: any) => sum + parseFloat(m.feeAmount || '0'), 0);
                            
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
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>Priority Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {['critical', 'high', 'medium', 'low'].map((priority) => {
                            const count = milestones.filter((m: any) => m.priority === priority).length;
                            const percentage = totalMilestones > 0 ? Math.round((count / totalMilestones) * 100) : 0;
                            
                            return (
                              <div key={priority} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge className={getPriorityColor(priority)}>
                                    {priority}
                                  </Badge>
                                  <span className="text-sm text-gray-600">{count} milestones</span>
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
