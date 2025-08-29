// Predefined project phases constants
export const PROJECT_PHASES = [
  {
    phaseNumber: 1,
    phaseType: 'initiation_contracting',
    phaseName: 'Initiation & Contracting',
    description: 'Project setup, contract signing, team assignment, and initial planning',
    defaultDeliverables: [
      'Signed Contract',
      'Project Charter',
      'Team Setup',
      'Initial Project Plan'
    ]
  },
  {
    phaseNumber: 2,
    phaseType: 'requirements_design',
    phaseName: 'Requirements Gathering & Design',
    description: 'Client requirements analysis, technical specifications, and design documentation',
    defaultDeliverables: [
      'Requirements Document',
      'Technical Specifications',
      'UI/UX Design',
      'System Architecture'
    ]
  },
  {
    phaseNumber: 3,
    phaseType: 'development',
    phaseName: 'System Customization & Development',
    description: 'Actual development work, coding, and system customization',
    defaultDeliverables: [
      'Source Code Repository',
      'Technical Documentation',
      'Progress Reports',
      'Code Review Reports'
    ]
  },
  {
    phaseNumber: 4,
    phaseType: 'testing_validation',
    phaseName: 'Testing & Validation',
    description: 'Quality assurance, testing, and validation of developed features',
    defaultDeliverables: [
      'Test Cases',
      'Test Results',
      'Bug Reports',
      'Quality Assurance Report'
    ]
  },
  {
    phaseNumber: 5,
    phaseType: 'deployment_golive',
    phaseName: 'Deployment & Go-Live',
    description: 'System deployment, user training, and go-live execution',
    defaultDeliverables: [
      'Deployment Plan',
      'User Training Materials',
      'Go-Live Checklist',
      'Deployment Report'
    ]
  },
  {
    phaseNumber: 6,
    phaseType: 'transition_closure',
    phaseName: 'Transition & Closure',
    description: 'Project handover, final documentation, and project closure',
    defaultDeliverables: [
      'Project Closure Report',
      'Handover Documentation',
      'Lessons Learned',
      'Final Sign-off'
    ]
  }
] as const;

export type PhaseType = typeof PROJECT_PHASES[number]['phaseType'];
export type PhaseNumber = typeof PROJECT_PHASES[number]['phaseNumber'];

// Helper functions
export const getPhaseByNumber = (phaseNumber: number) => {
  return PROJECT_PHASES.find(phase => phase.phaseNumber === phaseNumber);
};

export const getPhaseByType = (phaseType: PhaseType) => {
  return PROJECT_PHASES.find(phase => phase.phaseType === phaseType);
};

export const getNextPhase = (currentPhaseNumber: number) => {
  if (currentPhaseNumber >= 6) return null;
  return PROJECT_PHASES.find(phase => phase.phaseNumber === currentPhaseNumber + 1);
};

export const getPreviousPhase = (currentPhaseNumber: number) => {
  if (currentPhaseNumber <= 1) return null;
  return PROJECT_PHASES.find(phase => phase.phaseNumber === currentPhaseNumber - 1);
};

export const canMoveToPhase = (currentPhaseNumber: number, targetPhaseNumber: number) => {
  // Can only move to the next phase or stay in current phase
  return targetPhaseNumber <= currentPhaseNumber + 1;
};
