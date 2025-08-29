import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Play, 
  X, 
  FileText, 
  Users, 
  Target,
  ChevronDown,
  ChevronRight,
  User,
  CalendarDays,
  DollarSign
} from 'lucide-react';
import { calculateWeightBasedProgress, calculateSubtaskWeightBasedProgress } from '@/lib/utils';

interface Phase {
  id: string;
  phaseNumber: number;
  phaseName: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold';
  progress: number;
  deliverables: any[];
  reports: any[];
}

interface PhaseDetailModalProps {
  phase: Phase | null;
  modules: any[];
  isOpen: boolean;
  onClose: () => void;
  onPhaseUpdate: (phaseId: string, updates: Partial<Phase>) => void;
}

const getPhaseStatusIcon = (status: Phase['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case 'in_progress':
      return <Play className="h-5 w-5 text-blue-600" />;
    case 'on_hold':
      return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    default:
      return <Clock className="h-5 w-5 text-gray-400" />;
  }
};

const getPhaseStatusColor = (status: Phase['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'on_hold':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getPhaseStatusText = (status: Phase['status']) => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In Progress';
    case 'on_hold':
      return 'On Hold';
    default:
      return 'Not Started';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'low':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function PhaseDetailModal({ 
  phase, 
  modules, 
  isOpen, 
  onClose, 
  onPhaseUpdate 
}: PhaseDetailModalProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  if (!phase) return null;

  const phaseModules = modules?.filter(m => m.phaseNumber === phase.phaseNumber) || [];
  const completedModules = phaseModules.filter(m => m.status === 'done').length;
  const totalModules = phaseModules.length;
  const phaseProgress = calculateWeightBasedProgress(phaseModules);

  const toggleModuleExpansion = (moduleId: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const handleStatusChange = async (newStatus: Phase['status']) => {
    try {
      await onPhaseUpdate(phase.id, { status: newStatus });
    } catch (error) {
      console.error('Failed to update phase status:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto w-[95vw] max-w-[95vw] md:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            {getPhaseStatusIcon(phase.status)}
            <span>Phase {phase.phaseNumber}: {phase.phaseName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Phase Overview Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Badge className={getPhaseStatusColor(phase.status)}>
                    {getPhaseStatusText(phase.status)}
                  </Badge>
                  <div className="text-sm text-gray-600">
                    {phase.startDate && (
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(phase.startDate).toLocaleDateString()}
                      </span>
                    )}
                    {phase.endDate && (
                      <span className="flex items-center space-x-1 ml-4">
                        <Target className="h-4 w-4" />
                        {new Date(phase.endDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {phase.status === 'not_started' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleStatusChange('in_progress')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Phase
                    </Button>
                  )}
                  {phase.status === 'in_progress' && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStatusChange('on_hold')}
                        className="border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Put On Hold
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStatusChange('completed')}
                        className="border-green-600 text-green-600 hover:bg-green-50"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Complete Phase
                      </Button>
                    </>
                  )}
                  {phase.status === 'on_hold' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleStatusChange('in_progress')}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Resume Phase
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{phase.description}</p>
              
              {/* Progress Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Phase Progress</span>
                  <span className="text-sm text-gray-600">{phaseProgress}%</span>
                </div>
                <Progress value={phaseProgress} className="h-3" />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">Modules</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{totalModules}</p>
                    <p className="text-gray-600">Total</p>
                  </div>
                  
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Completed</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{completedModules}</p>
                    <p className="text-gray-600">Done</p>
                  </div>
                  
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-orange-600" />
                      <span className="font-medium">Remaining</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">{totalModules - completedModules}</p>
                    <p className="text-gray-600">Pending</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Modules Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Modules ({totalModules})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {phaseModules.map((module) => {
                  const subtaskProgress = calculateSubtaskWeightBasedProgress(module.subtasks || []);
                  const isExpanded = expandedModules.has(module.id);
                  
                  return (
                    <div key={module.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => toggleModuleExpansion(module.id)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          <div>
                            <h4 className="font-medium text-gray-900">{module.name}</h4>
                            <p className="text-sm text-gray-600">{module.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className={getPriorityColor(module.priority)}>
                            {module.priority}
                          </Badge>
                          <Badge variant="outline">
                            {module.status}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Module Details */}
                       <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <CalendarDays className="h-4 w-4" />
                          <span>Due: {module.dueDate ? new Date(module.dueDate).toLocaleDateString() : 'Not set'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>Assigned: {module.assignedUser?.name || 'Unassigned'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4" />
                          <span>Fee: {module.feeAmount ? `KSh ${module.feeAmount}` : 'Not set'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Target className="h-4 w-4" />
                          <span>Progress: {subtaskProgress}%</span>
                        </div>
                      </div>
                      
                      {/* Subtasks */}
                      {isExpanded && module.subtasks && module.subtasks.length > 0 && (
                        <div className="mt-4 pl-6 border-l-2 border-gray-200">
                          <h5 className="font-medium text-gray-700 mb-3">Subtasks ({module.subtasks.length})</h5>
                          <div className="space-y-3">
                            {module.subtasks.map((subtask: any) => (
                              <div key={subtask.id} className="bg-gray-50 rounded-md p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-sm text-gray-800">{subtask.name}</div>
                                    <div className="text-xs text-gray-600">{subtask.description}</div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline" className={getPriorityColor(subtask.priority)}>
                                      {subtask.priority}
                                    </Badge>
                                    <Badge variant="outline">
                                      {subtask.status}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                  <span>Due: {subtask.dueDate ? new Date(subtask.dueDate).toLocaleDateString() : 'Not set'}</span>
                                  <span>Assigned: {subtask.assignedUser?.name || 'Unassigned'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {phaseModules.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Target className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No modules found for this phase</p>
                    <p className="text-sm">Modules will appear here when they are created</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Documents & Reports Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Documents & Reports</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Document integration coming soon</p>
                <p className="text-sm">This section will show project charters, UAT reports, and other relevant documents</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
