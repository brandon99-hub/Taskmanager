import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, CheckCircle, Clock, AlertCircle, Play, X, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateWeightBasedProgress } from '@/lib/utils';
import PhaseDetailModal from './phase-detail-modal';

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

interface PhaseOverviewProps {
  projectId: string;
  phases: Phase[];
  onPhaseUpdate: (phaseId: string, updates: Partial<Phase>) => void;
  onPhaseComplete: (phaseId: string, completionReport: string) => void;
  modules?: any[];
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

export default function PhaseOverview({ 
  projectId, 
  phases, 
  modules, 
  onPhaseUpdate, 
  onPhaseComplete 
}: PhaseOverviewProps) {
  const { toast } = useToast();
  const [completionReport, setCompletionReport] = useState<string>('');
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [selectedPhaseForModal, setSelectedPhaseForModal] = useState<Phase | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Calculate phase progress using weight-based system
  const getPhaseProgress = (phaseNumber: number) => {
    if (!modules) return 0;
    const phaseModules = modules.filter(m => m.phaseNumber === phaseNumber);
    return calculateWeightBasedProgress(phaseModules);
  };

  const handlePhaseComplete = async (phaseId: string) => {
    if (!completionReport.trim()) {
      toast({
        title: "Error",
        description: "Please provide a completion report",
        variant: "destructive",
      });
      return;
    }

    try {
      await onPhaseComplete(phaseId, completionReport);
      setCompletionReport('');
      setSelectedPhase(null);
      toast({
        title: "Success",
        description: "Phase completed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete phase",
        variant: "destructive",
      });
    }
  };

  const canCompletePhase = (phase: Phase) => {
    if (phase.status !== 'in_progress') return false;
    // Check if all modules in this phase are completed
    const phaseModules = modules?.filter(m => m.phaseNumber === phase.phaseNumber) || [];
    return phaseModules.every(m => m.status === 'done');
  };

  const handlePutOnHold = async (phaseId: string) => {
    try {
      await onPhaseUpdate(phaseId, { status: 'on_hold' });
      toast({
        title: "Success",
        description: "Phase put on hold",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update phase status",
        variant: "destructive",
      });
    }
  };

  const handleResumePhase = async (phaseId: string) => {
    try {
      await onPhaseUpdate(phaseId, { status: 'in_progress' });
      toast({
        title: "Success",
        description: "Phase resumed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resume phase",
        variant: "destructive",
      });
    }
  };

  const openPhaseModal = (phase: Phase) => {
    setSelectedPhaseForModal(phase);
    setIsModalOpen(true);
  };

  const closePhaseModal = () => {
    setIsModalOpen(false);
    setSelectedPhaseForModal(null);
  };

  // Trigger automation when phases or modules change
  useEffect(() => {
    if (modules && phases) {
      // This will trigger the server-side automation when the component re-renders
      // The server automation runs automatically when subtasks are updated
      console.log('Phase overview updated - server automation will run automatically');
    }
  }, [modules, phases]);



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Project Phases</h3>
        <Badge variant="outline">
          {modules?.filter(m => m.status === 'done').length || 0} of {modules?.length || 0} modules completed
        </Badge>
      </div>

      <div className="grid gap-4">
        {phases.map((phase) => {
          const phaseModules = modules?.filter(m => m.phaseNumber === phase.phaseNumber) || [];
          const completedModules = phaseModules.filter(m => m.status === 'done').length;
          const totalModules = phaseModules.length;
          const phaseProgress = getPhaseProgress(phase.phaseNumber);

          return (
            <Card key={phase.id} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
                    onClick={() => openPhaseModal(phase)}
                  >
                    {getPhaseStatusIcon(phase.status)}
                    <div>
                      <CardTitle className="text-base">
                        Phase {phase.phaseNumber}: {phase.phaseName}
                      </CardTitle>
                      <p className="text-sm text-gray-600">{phase.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getPhaseStatusColor(phase.status)}>
                      {getPhaseStatusText(phase.status)}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPhaseModal(phase);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{phaseProgress}%</span>
                    </div>
                    <Progress value={phaseProgress} className="h-2" />
                  </div>

                  {/* Timeline */}
                  {(phase.startDate || phase.endDate) && (
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      {phase.startDate && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Start: {new Date(phase.startDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {phase.endDate && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>End: {new Date(phase.endDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Modules Summary */}
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Modules:</span>{' '}
                    {completedModules} of {totalModules} completed
                  </div>

                  {/* Subtasks Summary */}
                  {(() => {
                    const phaseSubtasks = phaseModules.flatMap(m => m.subtasks || []);
                    const completedSubtasks = phaseSubtasks.filter(s => s.status === 'completed').length;
                    const totalSubtasks = phaseSubtasks.length;
                    return totalSubtasks > 0 ? (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Subtasks:</span>{' '}
                        {completedSubtasks} of {totalSubtasks} completed
                      </div>
                    ) : null;
                  })()}

                  {/* Quick Module Preview */}
                  {modules && phaseModules.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">Quick Preview:</div>
                      <div className="text-sm text-gray-600">
                        Click "View Details" to see all modules, subtasks, and phase information
                      </div>
                      
                      {/* Module Status Indicators */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {phaseModules.map((module) => {
                          const statusColor = module.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            module.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                            module.status === 'client_review' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800';
                          return (
                            <Badge key={module.id} variant="outline" className={`text-xs ${statusColor}`}>
                              {module.name}: {module.status === 'completed' ? '✓' : 
                                               module.status === 'in_progress' ? '▶' : 
                                               module.status === 'client_review' ? '👁' : '○'}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {phase.status === 'in_progress' && (
                      <>
                        {canCompletePhase(phase) && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedPhase(phase.id)}
                            className="border-green-600 text-green-600 hover:bg-green-50"
                          >
                            Complete Phase
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handlePutOnHold(phase.id)}
                          className="border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                        >
                          Put On Hold
                        </Button>
                      </>
                    )}

                    {phase.status === 'on_hold' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleResumePhase(phase.id)}
                        className="border-blue-600 text-blue-600 hover:bg-blue-50"
                      >
                        Resume Phase
                      </Button>
                    )}

                    {phase.status === 'completed' && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Phase Completed
                      </Badge>
                    )}

                    {phase.status === 'not_started' && (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                        Waiting for modules to start
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Phase Completion Modal */}
      {selectedPhase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Complete Phase</h3>
              <button
                onClick={() => {
                  setSelectedPhase(null);
                  setCompletionReport('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              placeholder="Enter completion report..."
              value={completionReport}
              onChange={(e) => setCompletionReport(e.target.value)}
              className="w-full h-32 p-3 border rounded-md mb-4 resize-none"
            />
            <div className="flex space-x-2">
              <Button 
                onClick={() => handlePhaseComplete(selectedPhase)}
                className="bg-green-600 hover:bg-green-700"
              >
                Complete Phase
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedPhase(null);
                  setCompletionReport('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Phase Detail Modal */}
      <PhaseDetailModal
        phase={selectedPhaseForModal}
        modules={modules || []}
        isOpen={isModalOpen}
        onClose={closePhaseModal}
        onPhaseUpdate={onPhaseUpdate}
      />
    </div>
  );
}
