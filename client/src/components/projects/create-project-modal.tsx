import { useEffect, useState, useMemo } from "react";

import { useQuery, useMutation } from "@tanstack/react-query";

import { apiRequest, queryClient } from "@/lib/queryClient";

import { useToast } from "@/hooks/use-toast";

import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { Badge } from "@/components/ui/badge";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { z } from "zod";

import { Plus, Download, X, CalendarDays, UserCircle2, Users, DollarSign, ChevronDown, ChevronRight, Clock, FolderOpen, User } from "lucide-react";

import { useLocation, useSearch } from "wouter";

import { isUnauthorizedError } from "@/lib/authUtils";



const createProjectSchema = z.object({

  client: z.string().min(1, "Client name is required").max(200, "Client name too long"),

  contactPerson: z.string().min(1, "Contact person is required").max(200, "Contact person name too long"),

  contactPhone: z.string().min(1, "Contact phone is required").max(50, "Contact phone too long"),

  contactEmail: z.string().email("Invalid contact email").max(200, "Contact email too long"),

  startDate: z.string().optional().nullable(),

  endDate: z.string().optional().nullable(),

  segment: z.enum(["academic", "parastals", "private"]).default("private"),

  teamId: z.string().optional().or(z.literal("none")),
  // New: allow selecting a project leader (manager) explicitly
  managerId: z.string().optional(),

  budget: z.string().default("0.00"),



  status: z.enum(["planning", "active", "on_hold", "completed", "on_support", "inactive"]).optional(),

}).refine((data) => {
  if (!data.startDate || !data.endDate) return true;
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
});



type CreateProjectData = z.infer<typeof createProjectSchema>;



type NewMilestoneRow = {

  id?: string; // For edit mode

  name: string;

  description?: string;

  feeAmount?: string;

  expectedInvoiceDate?: string;

  expectedCollectionDate?: string;

  status?: string;

  billingStatus?: string;

  errors?: { name?: string; feeAmount?: string; expectedInvoiceDate?: string };

};



type NewModuleRow = {

    id?: string; // For edit mode

    name: string;

    description?: string;

    priority: 'low' | 'medium' | 'high' | 'critical';

    startDate?: string;

    dueDate?: string;

    assignedUserId?: string;

    status?: string;

    phaseNumber?: number;

    phaseName?: string;

    subtasks?: Array<{

      id?: string; // For edit mode

      name: string;

      description?: string;

      status?: string;

      priority: 'low' | 'medium' | 'high' | 'critical';

      startDate?: string;

      dueDate?: string;

    
    
      estimatedDays?: number;

      assignedDevId?: string;

      assignedConsultantId?: string;

      progressPercent?: number;

      errors?: { startDate?: string; dueDate?: string };

    }>;

    errors?: { startDate?: string; dueDate?: string; name?: string };

};



export default function CreateProjectModal({ project, onClose }: { project?: any; onClose?: () => void }) {

  const auth = useAuth() as any;

  const { user } = auth;

  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(!!project);

  const [pathname, setLocation] = useLocation();

  const search = useSearch();

  const [milestones, setMilestones] = useState<NewMilestoneRow[]>([]);

  const [modules, setModules] = useState<NewModuleRow[]>([]);

  const [phases, setPhases] = useState<any[]>([]);

  
  
  const [isProcessingMilestones, setIsProcessingMilestones] = useState(false);

  const [milestoneProgress, setMilestoneProgress] = useState({ current: 0, total: 0, message: '' });

  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());

  const [collapsedModuleSubtasks, setCollapsedModuleSubtasks] = useState<Set<string>>(new Set());

  const isEditMode = !!project;

  
  
  // Debug modules state changes

  useEffect(() => {

    // Silent monitoring

  }, [modules]);



  // Debug phases state changes

  useEffect(() => {

    // Silent monitoring - uncomment for debugging

    // console.log('Phases state changed:', phases);

  }, [phases]);

  
  
  // Debug modal state changes (only log significant changes)

  useEffect(() => {

    // Silent monitoring

  }, [isOpen, isEditMode, project?.id]);



  // Initialize phases with hardcoded project phases (matching PhaseOverview component interface)

  useEffect(() => {

    if (phases.length === 0) {

      const initialPhases = [

        {

          id: '1',

          phaseNumber: 1,

          phaseName: 'Initiation & Contracting',

          description: 'Project setup and contract finalization',

          status: 'not_started' as const,

          progress: 0,

          deliverables: [],

          reports: [],

          modules: [],

          milestones: []

        },

        {

          id: '2',

          phaseNumber: 2,

          phaseName: 'Requirements Gathering & Design',

          description: 'Requirements analysis and system design',

          status: 'not_started' as const,

          progress: 0,

          deliverables: [],

          reports: [],

          modules: [],

          milestones: []

        },

        {

          id: '3',

          phaseNumber: 3,

          phaseName: 'System Customization & Development',

          description: 'System development and customization',

          status: 'not_started' as const,

          progress: 0,

          deliverables: [],

          reports: [],

          modules: [],

          milestones: []

        },

        {

          id: '4',

          phaseNumber: 4,

          phaseName: 'Testing & Validation',

          description: 'System testing and validation',

          status: 'not_started' as const,

          progress: 0,

          deliverables: [],

          reports: [],

          modules: [],

          milestones: []

        },

        {

          id: '5',

          phaseNumber: 5,

          phaseName: 'Deployment & Go-Live',

          description: 'System deployment and go-live',

          status: 'not_started' as const,

          progress: 0,

          deliverables: [],

          reports: [],

          modules: [],

          milestones: []

        },

        {

          id: '6',

          phaseNumber: 6,

          phaseName: 'Transition & Closure',

          description: 'Project transition and closure',

          status: 'not_started' as const,

          progress: 0,

          deliverables: [],

          reports: [],

          modules: [],

          milestones: []

        }

      ];

      setPhases(initialPhases);

    }

  }, []);



  const form = useForm<CreateProjectData>({

    resolver: zodResolver(createProjectSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    shouldFocusError: true,

    defaultValues: {

      client: "",

      contactPerson: "",

      contactPhone: "",

      contactEmail: "",

      startDate: "",

      endDate: "",

      segment: "private",

      teamId: "none",

      budget: "0.00",

      status: "planning",

    },

  });



  // Get the current segment value from the form

  const currentSegment = form.watch('segment');

  
  
  const { data: teams = [] } = useQuery<any[]>({

    queryKey: ['/api/teams', currentSegment],

    queryFn: async () => {

      const res = await fetch(`/api/teams?segment=${currentSegment}`, { 

        credentials: 'include', 

        cache: 'no-store' 

      });

      if (!res.ok) return [];

      return res.json();

    },

    enabled: isOpen, // load when modal opens

    staleTime: 0,

    refetchOnMount: 'always',

  });



  // Helper function to get team name

  const getTeamName = (teamId: string | undefined) => {

    if (!teamId) return 'Team';

    const team = teams.find(t => t.id === teamId);

    return team?.name || 'Team';

  };



  // Helper functions for subtask expansion

  const toggleSubtasks = (milestoneIndex: number) => {

    const key = `milestone-${milestoneIndex}`;

    setExpandedSubtasks(prev => {

      const newSet = new Set(prev);

      if (newSet.has(key)) {

        newSet.delete(key);

      } else {

        newSet.add(key);

      }

      return newSet;

    });

  };



  const isSubtasksExpanded = (milestoneIndex: number) => {

    return expandedSubtasks.has(`milestone-${milestoneIndex}`);

  };

  
  
  // Helper functions for module subtask expansion

  const toggleModuleSubtasks = (phaseIndex: number, moduleIndex: number) => {

    const key = `module-${phaseIndex}-${moduleIndex}`;

    setCollapsedModuleSubtasks(prev => {

      const newSet = new Set(prev);

      if (newSet.has(key)) {

        newSet.delete(key);

      } else {

        newSet.add(key);

      }

      return newSet;

    });

  };



  const areModuleSubtasksCollapsed = (phaseIndex: number, moduleIndex: number) => {

    return collapsedModuleSubtasks.has(`module-${phaseIndex}-${moduleIndex}`);

  };



  // Auto-open modal in edit mode and prefill form

  useEffect(() => {

    if (project) {

      setIsOpen(true);

      console.log('Edit mode activated for project:', project.id, project.name);

      const formData = {

        client: project.client || "",

        contactPerson: project.contactPerson || "",

        contactPhone: project.contactPhone || "",

        contactEmail: project.contactEmail || "",

        startDate: project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : "",

        endDate: project.endDate ? new Date(project.endDate).toISOString().slice(0, 10) : "",

        segment: project.segment || "private",

        teamId: project.teamId || "none",

        budget: project.budget ? String(project.budget) : "",

        status: project.status || "planning",

      };

      console.log('Setting form data:', formData);

      form.reset(formData);

      
      
      // Check form validity after reset

      setTimeout(() => {

        console.log('Form validity after reset:', {

          isValid: form.formState.isValid,

          errors: form.formState.errors,

          values: form.getValues()

        });

      }, 100);

    } else {

      setIsOpen(false);

    }

  }, [project, form]);



  // Reset team selection when segment changes (unless in edit mode)

  useEffect(() => {

    if (!isEditMode && currentSegment) {

      // Check if the currently selected team is still valid for the new segment

      const currentTeamId = form.getValues('teamId');

      if (currentTeamId && currentTeamId !== 'none') {

        const currentTeam = teams.find(team => team.id === currentTeamId);

        if (!currentTeam || currentTeam.segment !== currentSegment) {

          // Reset team selection if the current team is not in the new segment

          form.setValue('teamId', 'none');

        }

      }

    }

  }, [currentSegment, teams, form, isEditMode]);



  // Prevent form state corruption by stabilizing the form

  useEffect(() => {

    if (isOpen && !isEditMode) {

      // Ensure form is properly initialized for new projects but preserve any existing segment selection

      const currentSegment = form.getValues('segment') || 'private';

      form.reset({

        client: "",

        contactPerson: "",

        contactPhone: "",

        contactEmail: "",

        startDate: "",

        endDate: "",

        segment: currentSegment, // Preserve segment selection

        teamId: "none",

        budget: "",

        status: "planning",

      });

      setModules([]);

      setExpandedSubtasks(new Set());

    }

  }, [isOpen, isEditMode, form]);



  // Fetch existing modules in edit mode

  const { data: existingModules = [], isLoading: modulesLoading, error: modulesError } = useQuery<any[]>({

    queryKey: ['/api/projects', project?.id, 'modules'],

    queryFn: async () => {

      if (!project?.id) return [];

      const res = await fetch(`/api/projects/${project.id}/modules`, { credentials: 'include', cache: 'no-store' });

      if (!res.ok) {

        return [];

      }

      const data = await res.json();

      return data;

    },

    enabled: isEditMode && isOpen && !!project?.id,

  });



  // Fetch existing milestones in edit mode (from modules data since milestones are now part of modules)

  const { data: existingMilestones = [], isLoading: milestonesLoading, error: milestonesError } = useQuery<any[]>({

    queryKey: ['/api/projects', project?.id, 'milestones'],

    queryFn: async () => {

      if (!project?.id) return [];

      // Get milestones from modules data since milestones are now returned as modules with isMilestone: true

      const res = await fetch(`/api/projects/${project.id}/modules`, { credentials: 'include', cache: 'no-store' });

      if (!res.ok) {

        return [];

      }

      const modulesData = await res.json();

      // Filter only milestone modules and format them for the milestone form

      const milestoneModules = modulesData.filter((module: any) => module.isMilestone);

      console.log('Found milestone modules:', milestoneModules);

      const formattedMilestones = milestoneModules.map((milestone: any) => ({

        id: milestone.id,

        name: milestone.name,

        description: milestone.description,

        feeAmount: milestone.feeAmount,

        expectedInvoiceDate: milestone.expectedInvoiceDate,

        expectedCollectionDate: milestone.expectedCollectionDate,

        billingStatus: milestone.billingStatus,

        phaseNumber: milestone.phaseNumber,

        phaseName: milestone.phaseName,

        startDate: milestone.startDate,

        endDate: milestone.dueDate,

        status: milestone.status

      }));

      console.log('Formatted milestones for form:', formattedMilestones);

      return formattedMilestones;

    },

    enabled: isEditMode && isOpen && !!project?.id,

  });

  
  
  // Debug query state (only log significant changes)

  useEffect(() => {

    // Silent monitoring

  }, [modulesLoading, modulesError, existingModules, milestonesLoading, milestonesError, existingMilestones, project?.id]);



  // Load existing modules into modules state when editing

  useEffect(() => {

    if (isEditMode && existingModules.length > 0) {

      console.log('Loading existing modules into state:', existingModules);

      const modulesWithPhase = existingModules.map((module: any) => ({

        ...module,

        phaseNumber: module.phaseNumber || 1,

        phaseName: module.phaseName || 'Initiation & Contracting',

        // Ensure dates are properly formatted for the form

        startDate: module.startDate ? new Date(module.startDate).toISOString().slice(0, 10) : undefined,

        dueDate: module.dueDate ? new Date(module.dueDate).toISOString().slice(0, 10) : undefined,

        // Preserve subtasks with proper formatting and assignments

        subtasks: (module.subtasks || []).map((subtask: any) => ({

          ...subtask,

          startDate: subtask.startDate ? new Date(subtask.startDate).toISOString().slice(0, 10) : '',

          dueDate: subtask.dueDate ? new Date(subtask.dueDate).toISOString().slice(0, 10) : '',

          estimatedDays: subtask.estimatedDays ? String(subtask.estimatedDays) : '',

          assignedDevId: subtask.assignedDevId || undefined,

          assignedConsultantId: subtask.assignedConsultantId || undefined

        }))

      }));

      console.log('Modules with phase info:', modulesWithPhase);

      setModules(modulesWithPhase);

    }

  }, [isEditMode, existingModules, project]);



  // Load existing milestones into milestones state when editing

  useEffect(() => {

    if (isEditMode && existingMilestones.length > 0) {

      console.log('Loading existing milestones into state:', existingMilestones);

      const milestonesWithFormattedDates = existingMilestones.map((milestone: any) => ({

        ...milestone,

        // Ensure dates are properly formatted for the form

        expectedInvoiceDate: milestone.expectedInvoiceDate ? new Date(milestone.expectedInvoiceDate).toISOString().slice(0, 10) : '',

        expectedCollectionDate: milestone.expectedCollectionDate ? new Date(milestone.expectedCollectionDate).toISOString().slice(0, 10) : '',

        // Ensure fee amount is properly formatted for the form

        feeAmount: milestone.feeAmount ? String(milestone.feeAmount) : '',

      }));

      console.log('Milestones with formatted dates:', milestonesWithFormattedDates);

      setMilestones(milestonesWithFormattedDates);

      // Auto-calculate contract amount from milestone fees when editing
      const totalAmount = milestonesWithFormattedDates.reduce((total, milestone) => {
        const cleanValue = (milestone.feeAmount || '0').replace(/,/g, '');
        const fee = parseFloat(cleanValue) || 0;
        return total + fee;
      }, 0);
      
      const formattedAmount = totalAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      form.setValue('budget', formattedAmount, { shouldValidate: true });

    } else if (isEditMode && existingMilestones.length === 0) {

      console.log('No existing milestones found for project:', project?.id);

    }

  }, [isEditMode, existingMilestones, project]);



  // Load existing phases when editing (organize modules by phase)

  useEffect(() => {

    if (isEditMode && existingModules.length > 0) {

      // Start with existing phases and merge modules into them

      setPhases(prevPhases => {

        const updatedPhases = [...prevPhases];

        
        
        // Group modules by phase

        const phaseMap = new Map();

        
        
        existingModules.forEach((module: any) => {

          const phaseNumber = module.phaseNumber || 1;

          const phaseName = module.phaseName || `Phase ${phaseNumber}`;

          
          
          console.log(`Processing module ${module.name} for phase ${phaseNumber}, milestoneId: ${module.milestoneId}`);

          
          
          if (!phaseMap.has(phaseNumber)) {

            phaseMap.set(phaseNumber, {

              id: phaseNumber,

              name: phaseName,

              description: `Phase ${phaseNumber}: ${phaseName}`,

              status: 'not_started',

              phaseNumber: phaseNumber,

              modules: [],

              milestones: [] // Initialize milestones array for all phases

            });

          }

          
          
          const formattedModule = {

            ...module,

            // Ensure module dates are properly formatted for form inputs

            startDate: module.startDate ? new Date(module.startDate).toISOString().slice(0, 10) : '',

            dueDate: module.dueDate ? new Date(module.dueDate).toISOString().slice(0, 10) : '',

            // Ensure subtasks have properly formatted dates for form inputs

            subtasks: (module.subtasks || []).map((subtask: any) => ({

              ...subtask,

              startDate: subtask.startDate ? new Date(subtask.startDate).toISOString().slice(0, 10) : '',

              dueDate: subtask.dueDate ? new Date(subtask.dueDate).toISOString().slice(0, 10) : '',

              estimatedDays: subtask.estimatedDays ? String(subtask.estimatedDays) : '',

              // Preserve assigned user IDs for dev and consultant

              assignedDevId: subtask.assignedDevId || undefined,

              assignedConsultantId: subtask.assignedConsultantId || undefined

            })),

            // Carry milestone linkage flags from server

            milestoneId: module.milestoneId,

            isMilestone: module.isMilestone,

          };

          
          
          // For Phase 3, check if this is a milestone or a module under a milestone

          if (phaseNumber === 3) {

            if (module.isMilestone) {

              // This is a milestone itself - add it to milestones array

              const milestone = {

                ...formattedModule,

                startDate: module.startDate ? new Date(module.startDate).toISOString().slice(0, 10) : '',

                endDate: module.dueDate ? new Date(module.dueDate).toISOString().slice(0, 10) : '',

                expectedInvoiceDate: module.expectedInvoiceDate ? new Date(module.expectedInvoiceDate).toISOString().slice(0, 10) : '',

                expectedCollectionDate: module.expectedCollectionDate ? new Date(module.expectedCollectionDate).toISOString().slice(0, 10) : '',

                feeAmount: module.feeAmount ? String(module.feeAmount) : '',

                modules: (module.modules || []).map((nestedModule: any) => ({

                  ...nestedModule,

                  // Format dates for nested modules

                  startDate: nestedModule.startDate ? new Date(nestedModule.startDate).toISOString().slice(0, 10) : '',

                  dueDate: nestedModule.dueDate ? new Date(nestedModule.dueDate).toISOString().slice(0, 10) : '',

                  // Format subtasks within nested modules

                  subtasks: (nestedModule.subtasks || []).map((subtask: any) => ({

                    ...subtask,

                    startDate: subtask.startDate ? new Date(subtask.startDate).toISOString().slice(0, 10) : '',

                    dueDate: subtask.dueDate ? new Date(subtask.dueDate).toISOString().slice(0, 10) : '',

                    estimatedDays: subtask.estimatedDays ? String(subtask.estimatedDays) : '',

                    assignedDevId: subtask.assignedDevId || undefined,

                    assignedConsultantId: subtask.assignedConsultantId || undefined

                  }))

                }))

              };

              phaseMap.get(phaseNumber).milestones.push(milestone);

            } else if (module.milestoneId) {

              // This is a module under a milestone - find the milestone and add the module to it

              let milestone = phaseMap.get(phaseNumber).milestones.find((m: any) => m.id === module.milestoneId);

              if (!milestone) {

                // Find the milestone in existingMilestones

                const existingMilestone = existingMilestones.find((m: any) => m.id === module.milestoneId);

                if (existingMilestone) {

                  milestone = {

                    ...existingMilestone,

                    startDate: existingMilestone.startDate ? new Date(existingMilestone.startDate).toISOString().slice(0, 10) : '',

                    endDate: existingMilestone.endDate ? new Date(existingMilestone.endDate).toISOString().slice(0, 10) : '',

                    expectedInvoiceDate: existingMilestone.expectedInvoiceDate ? new Date(existingMilestone.expectedInvoiceDate).toISOString().slice(0, 10) : '',

                    expectedCollectionDate: existingMilestone.expectedCollectionDate ? new Date(existingMilestone.expectedCollectionDate).toISOString().slice(0, 10) : '',

                    feeAmount: existingMilestone.feeAmount ? String(existingMilestone.feeAmount) : '',

                    modules: []

                  };

                  phaseMap.get(phaseNumber).milestones.push(milestone);

                }

              }

              if (milestone) {

                milestone.modules.push(formattedModule);

              }

            } else {

              // Regular module in Phase 3 (shouldn't happen but handle it)

              phaseMap.get(phaseNumber).modules.push(formattedModule);

            }

          } else {

            // For other phases, check if this is a milestone or regular module

            if (module.isMilestone) {

              // This is a milestone - add it to milestones array for this phase

              const milestone = {

                ...formattedModule,

                startDate: module.startDate ? new Date(module.startDate).toISOString().slice(0, 10) : '',

                endDate: module.dueDate ? new Date(module.dueDate).toISOString().slice(0, 10) : '',

                expectedInvoiceDate: module.expectedInvoiceDate ? new Date(module.expectedInvoiceDate).toISOString().slice(0, 10) : '',

                expectedCollectionDate: module.expectedCollectionDate ? new Date(module.expectedCollectionDate).toISOString().slice(0, 10) : '',

                feeAmount: module.feeAmount ? String(module.feeAmount) : '',

                modules: [] // Other phases don't have nested modules

              };

              phaseMap.get(phaseNumber).milestones.push(milestone);

            } else {

              // Regular module - add to modules array

              phaseMap.get(phaseNumber).modules.push(formattedModule);

            }

          }

        });

        
        
        console.log('Phase map created:', Array.from(phaseMap.entries()));

        
        
        // Merge modules and milestones into existing phases

        updatedPhases.forEach(phase => {

          const phaseData = phaseMap.get(parseInt(phase.id));

          if (phaseData) {

            phase.modules = phaseData.modules;

            phase.milestones = phaseData.milestones;

            // Update phase name if it was customized

            if (phaseData.name !== `Phase ${phase.id}`) {

              phase.name = phaseData.name;

            }

          } else {

            phase.modules = [];

            phase.milestones = [];

          }

        });

        
        
        console.log('Updated phases with existing modules:', updatedPhases);

        console.log('Phase 1 modules count:', updatedPhases[0]?.modules?.length);

        
        
        // Initialize subtasks as collapsed in edit mode - collapse ALL subtasks by default

        const collapsedKeys = new Set<string>();

        updatedPhases.forEach((phase, phaseIndex) => {

          if (phase.phaseNumber === 3) {

            // For Phase 3, collapse subtasks under each module

            phase.milestones?.forEach((milestone: any, milestoneIndex: number) => {

              milestone.modules?.forEach((module: any, moduleIndex: number) => {

                // Always collapse subtasks when editing, regardless of whether they have subtasks

                collapsedKeys.add(`module-${phaseIndex}-${moduleIndex}`);

              });

            });

          } else {

            // For other phases, collapse subtasks under each module

            phase.modules?.forEach((module: any, moduleIndex: number) => {

              // Always collapse subtasks when editing, regardless of whether they have subtasks

              collapsedKeys.add(`module-${phaseIndex}-${moduleIndex}`);

            });

          }

        });

        setCollapsedModuleSubtasks(collapsedKeys);

        
        
        return updatedPhases;

      });

      
      
      console.log('Loaded existing modules:', existingModules);

    } else if (isEditMode && existingModules.length === 0) {

      console.log('No existing modules found for project:', project?.id);

      // Keep existing phases with their default structure - don't clear them

      // This allows users to add new content to phases

      console.log('Preserving phase structure for editing');

    }

  }, [isEditMode, existingModules, existingMilestones, project]);



  // Keep modules state in sync with phases (only for new projects, not edit mode)

  useEffect(() => {

    if (!isEditMode) {

      const allModules = phases.flatMap(phase => phase.modules || []);

      setModules(allModules);

    }

  }, [phases, isEditMode]);



  // Debug phases state changes

  useEffect(() => {
    // console.debug('Phases state updated:', phases);
    // console.debug('Phase 1 milestones:', phases[0]?.milestones?.length || 0);
    // console.debug('Phase 1 modules:', phases[0]?.modules?.length || 0);
  }, [phases]);

  // Auto-select team Project Leader as manager when team changes (new project only)
  const watchedTeamId = form.watch('teamId');
  useEffect(() => {
    if (isEditMode) return;
    if (!watchedTeamId || watchedTeamId === 'none') return;
    // This effect is declared before teamMembers; the callback runs after render, when teamMembers is defined
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const leader = (teamMembers || []).find((m: any) => m.role === 'Project Leader');
    if (leader && leader.id) {
      form.setValue('managerId', leader.id, { shouldDirty: true, shouldValidate: true });
    }
  }, [isEditMode, watchedTeamId]);



  // Fetch team members for the form's selected team (for new projects or when changing teams)

  const { data: teamMembers = [], isLoading: teamMembersLoading, error: teamMembersError } = useQuery<any[]>({

    queryKey: ['/api/team-members', form.watch('teamId')],

    queryFn: async () => {

      const teamId = form.watch('teamId');

      if (!teamId || teamId === 'none') return [];

      
      
      try {

        const res = await fetch(`/api/teams/${teamId}`, { credentials: 'include', cache: 'no-store' });

        if (!res.ok) {

          return [];

        }

        const json = await res.json();

        const members = json.members?.map((m: any) => ({

          ...m.user,

          role: m.role // Preserve the role information from team member

        })) ?? [];

        
        
        // Check for duplicates

        const uniqueMembers = members.filter((member: any, index: number, array: any[]) => 

          array.findIndex(m => m.id === member.id) === index

        );

        
        
        return uniqueMembers;

      } catch (error) {

        return [];

      }

    },

    enabled: isOpen && !!form.watch('teamId') && form.watch('teamId') !== 'none',

    staleTime: 5 * 60 * 1000, // 5 minutes

    refetchOnMount: false,

    retry: 1,

  });

  // Fetch admins as fallback candidates for manager selection
  const { data: admins = [], isLoading: adminsLoading } = useQuery<any[]>({
    queryKey: ['/api/users', 'admin'],
    queryFn: async () => {
      const res = await fetch('/api/users?role=admin', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });



  // Fetch team members for the existing project's team (for edit mode)

  const { data: projectTeamMembers = [] } = useQuery<any[]>({

    queryKey: ['/api/project-team-members', project?.teamId],

    queryFn: async () => {

      if (!project?.teamId) return [];

      try {

        const res = await fetch(`/api/teams/${project.teamId}`, { credentials: 'include', cache: 'no-store' });

        if (!res.ok) return [];

        const json = await res.json();

        const members = json.members?.map((m: any) => ({

          ...m.user,

          role: m.role // Preserve the role information from team member

        })) ?? [];

        
        
        // Check for duplicates

        const uniqueMembers = members.filter((member: any, index: number, array: any[]) => 

          array.findIndex(m => m.id === member.id) === index

        );

        
        
        return uniqueMembers;

      } catch (error) {

        return [];

      }

    },

    enabled: isEditMode && isOpen && !!project?.teamId,

    staleTime: 5 * 60 * 1000, // 5 minutes

    refetchOnMount: false,

  });



  // Load existing milestones in edit mode

  useEffect(() => {

    if (isEditMode && existingMilestones.length > 0) {



      const milestoneTasks = existingMilestones.map((m: any) => ({

        id: m.id, // Keep the ID for updates

        name: m.name,

        description: m.description || '',

        priority: m.priority,

        startDate: m.startDate ? new Date(m.startDate).toISOString().slice(0, 10) : '',

        dueDate: m.dueDate ? new Date(m.dueDate).toISOString().slice(0, 10) : '',

        assignedUserId: m.assignedUserId || undefined,

        feeAmount: m.feeAmount ? String(m.feeAmount) : '',

        expectedInvoiceDate: m.expectedInvoiceDate ? new Date(m.expectedInvoiceDate).toISOString().slice(0, 10) : '',

        status: m.status,

        billingStatus: m.billingStatus,

        // Preserve phase information

        phaseNumber: m.phaseNumber || 1,

        phaseName: m.phaseName || 'Initiation & Contracting',

        // Include subtasks if they exist

        subtasks: m.subtasks ? m.subtasks.map((subtask: any) => ({

          id: subtask.id,

          name: subtask.name,

          description: subtask.description || '',

          status: subtask.status,

          priority: subtask.priority,

          startDate: subtask.startDate ? new Date(subtask.startDate).toISOString().slice(0, 10) : '',

          dueDate: subtask.dueDate ? new Date(subtask.dueDate).toISOString().slice(0, 10) : '',



          estimatedDays: subtask.estimatedDays ? String(subtask.estimatedDays) : '',

          assignedUserId: subtask.assignedUserId || undefined,

          assignedDevId: subtask.assignedDevId || undefined,

          assignedConsultantId: subtask.assignedConsultantId || undefined,

          progressPercent: subtask.progressPercent || 0

        })) : []

      }));

      setMilestones(milestoneTasks);

    }

  }, [isEditMode, existingMilestones]);



  const createProjectMutation = useMutation({

    mutationFn: async (data: CreateProjectData) => {

      const payload = {

        ...data,

        budget: data.budget ? Number(data.budget.replace(/,/g, '')) : undefined,

        startDate: data.startDate ? new Date(data.startDate as string) : undefined,

        endDate: data.endDate ? new Date(data.endDate as string) : undefined,

        teamId: data.teamId === "none" ? undefined : data.teamId || undefined,

        managerId: (data as any).managerId || undefined,

        client: data.client || undefined,

      };

      
      
      const response = isEditMode

        ? await apiRequest("PUT", `/api/projects/${project.id}`, payload)

        : await apiRequest("POST", "/api/projects", payload);

      return response.json();

    },

    onSuccess: () => {

      // Don't close modal here - let the onSubmit onSuccess handle it after milestones

      // Just invalidate queries to refresh data

      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });

      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });

    },

    onError: (error) => {

      if (isUnauthorizedError(error)) {

        toast({

          title: "Unauthorized",

          description: "You are logged out. Logging in again...",

          variant: "destructive",

        });

        setTimeout(() => {

          window.location.href = "/login";

        }, 500);

        return;

      }

      console.error('Project mutation error:', error);

      toast({

        title: "Error",

        description: isEditMode ? "Failed to update project" : "Failed to create project",

        variant: "destructive",

      });

    },

  });



  // Enhanced date validation functions

  const validateDateRanges = (data: CreateProjectData, allModules: NewModuleRow[]) => {

    const projectStart = data.startDate ? new Date(data.startDate) : undefined;

    const projectEnd = data.endDate ? new Date(data.endDate) : undefined;

    const errors: { [key: string]: string } = {};

    const moduleErrors: { [key: string]: { [key: string]: string } } = {};

    
    
    // Validate project dates

    if (projectStart && projectEnd && projectStart >= projectEnd) {

      errors.endDate = 'End date must be after start date';

    }

    
    
    // Validate module dates against project timeline

    allModules.forEach((module, moduleIndex) => {

      // Skip milestone-only rows
      // @ts-ignore
      if ((module as any).isMilestone) return;

      const moduleStart = module.startDate ? new Date(module.startDate) : undefined;

      const moduleEnd = module.dueDate ? new Date(module.dueDate) : undefined;

      const moduleKey = `module-${moduleIndex}`;

      
      
      // Only validate modules when both dates exist. Allow same-day duration.
      if (moduleStart && moduleEnd && moduleStart > moduleEnd) {

        if (!moduleErrors[moduleKey]) moduleErrors[moduleKey] = {};

        moduleErrors[moduleKey].dueDate = 'Module end date cannot be before start date';

      }

      
      
      if (projectStart && moduleStart && moduleStart < projectStart) {

        if (!moduleErrors[moduleKey]) moduleErrors[moduleKey] = {};

        moduleErrors[moduleKey].startDate = 'Module start cannot be before project start';

      }

      
      
      if (projectEnd && moduleEnd && moduleEnd > projectEnd) {

        if (!moduleErrors[moduleKey]) moduleErrors[moduleKey] = {};

        moduleErrors[moduleKey].dueDate = 'Module end cannot be after project end';

      }

      
      
      // Validate subtask dates against module timeline

      if (module.subtasks) {

        module.subtasks.forEach((subtask, subtaskIndex) => {

          const subtaskStart = subtask.startDate ? new Date(subtask.startDate) : undefined;

          const subtaskEnd = subtask.dueDate ? new Date(subtask.dueDate) : undefined;

          const subtaskKey = `subtask-${moduleIndex}-${subtaskIndex}`;

          
          
          // Only validate when both dates exist. Allow same-day duration.
          if (subtaskStart && subtaskEnd && subtaskStart > subtaskEnd) {

            if (!moduleErrors[subtaskKey]) moduleErrors[subtaskKey] = {};

            moduleErrors[subtaskKey].dueDate = 'Subtask end date cannot be before start date';

          }

          
          
          if (moduleStart && subtaskStart && subtaskStart < moduleStart) {

            if (!moduleErrors[subtaskKey]) moduleErrors[subtaskKey] = {};

            moduleErrors[subtaskKey].startDate = 'Subtask start cannot be before module start';

          }

          
          
          if (moduleEnd && subtaskEnd && subtaskEnd > moduleEnd) {

            if (!moduleErrors[subtaskKey]) moduleErrors[subtaskKey] = {};

            moduleErrors[subtaskKey].dueDate = 'Subtask end cannot be after module end';

          }

        });

      }

    });

    
    
    return { projectErrors: errors, moduleErrors };

  };

  
  
  // Function to apply validation errors to the UI

  const applyValidationErrors = (moduleErrors: { [key: string]: { [key: string]: string } }) => {

    const updatedPhases = phases.map(phase => ({

      ...phase,

      modules: phase.modules.map((module: any, moduleIndex: number) => {

        const moduleKey = `module-${moduleIndex}`;

        const moduleErrorsForThis = moduleErrors[moduleKey] || {};

        
        
        const updatedSubtasks = (module.subtasks || []).map((subtask: any, subtaskIndex: number) => {

          const subtaskKey = `subtask-${moduleIndex}-${subtaskIndex}`;

          const subtaskErrorsForThis = moduleErrors[subtaskKey] || {};

          
          
          return {

            ...subtask,

            errors: subtaskErrorsForThis

          };

        });

        
        
        return {

          ...module,

          errors: moduleErrorsForThis,

          subtasks: updatedSubtasks

        };

      })

    }));

    
    
    setPhases(updatedPhases);

  };



  const onSubmit = async (data: CreateProjectData) => {

    console.log('onSubmit called with data:', data);

    console.log('Form errors:', form.formState.errors);

    console.log('Form is valid:', form.formState.isValid);

    console.log('Form is dirty:', form.formState.isDirty);

    console.log('Form is submitting:', form.formState.isSubmitting);

    

    // Re-validate just before submit
    const ok = await form.trigger(undefined, { shouldFocus: true });
    
    // Check if form has validation errors
    if (!ok) {

      console.log('Form is not valid, cannot submit');

      // Bring user to first error in the form

      scrollToFirstError(form.formState.errors);

      toast({

        title: 'Form Validation Error',

        description: 'Please fix the form errors before submitting.',

        variant: 'destructive'

      });

      return;

    }



    // Extract all modules from phases (handling both regular phases and Phase 3 structure)

    const allModules = phases.flatMap((phase, phaseIndex) => {

      if (phase.phaseNumber === 3) {

        // Phase 3: Extract modules from milestones

        return (phase.milestones || []).flatMap((milestone: any, milestoneIndex: number) => 

          (milestone.modules || []).map((module: any) => ({

        ...module,

        // Ensure phase information is preserved

        phaseNumber: module.phaseNumber || phaseIndex + 1,

            phaseName: module.phaseName || phase.phaseName || phase.name || `Phase ${phaseIndex + 1}`,

            // Add milestone information for Phase 3

            milestoneId: milestone.id,

            milestoneName: milestone.name,

            milestoneIndex: milestoneIndex

      }))

    );

      } else {

        // Regular phases (1,2,4,5,6)

        if (phase.milestones && phase.milestones.length > 0) {

          // Treat milestones as modules, but preserve identifiers and fields for proper edit/update

          return (phase.milestones || []).map((milestone: any) => ({

            // Identifiers to ensure edit path updates the milestone
            id: milestone.milestoneId || milestone.id,
            isMilestone: milestone.isMilestone ?? true,
            milestoneId: milestone.milestoneId || milestone.id,

            // Module-shaped from milestone
            name: milestone.name,
            description: milestone.description,
            priority: milestone.priority || 'medium',
            startDate: milestone.startDate,
            dueDate: (milestone as any).dueDate ?? milestone.endDate,

            // Preserve phase info
            phaseNumber: phaseIndex + 1,
            phaseName: phase.phaseName || phase.name || `Phase ${phaseIndex + 1}`,

            // Billing fields
            feeAmount: milestone.feeAmount,
            expectedInvoiceDate: milestone.expectedInvoiceDate,
            expectedCollectionDate: milestone.expectedCollectionDate,
            billingStatus: milestone.billingStatus || 'none',

            // Keep originals for pre-mapping if needed
            milestoneStartDate: milestone.startDate,
            milestoneEndDate: (milestone as any).dueDate ?? milestone.endDate,

            // Carry subtasks for persistence
            subtasks: milestone.subtasks || milestone.milestoneSubtasks || [],

          }));

        }

        // Fall back to actual modules, filtering out placeholders

        return (phase.modules || [])

          .filter((module: any) => (module && (module.name || module.dueDate)))

          .map((module: any) => ({

          ...module,

          phaseNumber: module.phaseNumber || phaseIndex + 1,

          phaseName: module.phaseName || phase.phaseName || phase.name || `Phase ${phaseIndex + 1}`

          }));

      }

    });

    // Pre-map milestone-derived fields into modules for regular phases to avoid incomplete skips

    const mappedModules = allModules.map((m: any) => {

      const mapped = { ...m } as any;

      if (mapped.phaseNumber !== 3) {

        if (!mapped.name && mapped.milestoneName) mapped.name = mapped.milestoneName;

        if (!mapped.priority) mapped.priority = 'medium';

        if (!mapped.startDate && mapped.milestoneStartDate) mapped.startDate = mapped.milestoneStartDate;

        if (!mapped.dueDate && mapped.milestoneEndDate) mapped.dueDate = mapped.milestoneEndDate;

      }

      return mapped;

    });

    // Extract all milestones from Phase 3

    const allMilestones = phases.flatMap((phase, phaseIndex) => {

      if (phase.phaseNumber === 3) {

        return (phase.milestones || []).map((milestone: any) => ({

          ...milestone,

          // Ensure phase information is preserved

          phaseNumber: phaseIndex + 1,

          phaseName: phase.phaseName || phase.name || `Phase ${phaseIndex + 1}`

        }));

      }

      return [];

    });
    
    console.log('All modules from phases:', mappedModules);

    console.log('All milestones from Phase 3:', allMilestones);

    console.log('Phases state:', phases);

    console.log('Module phase numbers:', mappedModules.map(m => ({ name: m.name, phaseNumber: m.phaseNumber, phaseName: m.phaseName })));

    
    
    // Enhanced date validation

    const { projectErrors, moduleErrors } = validateDateRanges(data, mappedModules);

    
    
    // Check for any validation errors

    if (Object.keys(projectErrors).length > 0 || Object.keys(moduleErrors).length > 0) {

      // Apply errors to form and UI

      Object.keys(projectErrors).forEach(field => {

        form.setError(field as any, { message: projectErrors[field] });

      });

      
      
      applyValidationErrors(moduleErrors);

      
      
      toast({

        title: 'Validation Errors',

        description: 'Please fix the date conflicts before saving the project.',

        variant: 'destructive'

      });

      return;

    }

    
    
    // Filter out incomplete modules (those without required fields)
    // Scope ONLY to modules that will actually be processed this save

    let modulesForToast = mappedModules as any[];
    let completeModules: any[] = [];

    if (isEditMode && existingModules.length > 0) {
      const changes = detectModuleChanges(mappedModules as any, existingModules as any);
      modulesForToast = changes
        .filter((c: any) => c.type === 'create' || c.type === 'update')
        .map((c: any) => c.module);
    }

    // If there are no modules to process (e.g., phases without modules), skip the toast entirely
    if (modulesForToast.length > 0) {
      // A module is processable if:
      // - name is present, AND
      // - (has dueDate) OR (isMilestone true AND has at least one subtask with both startDate and dueDate)
      const isProcessable = (t: any) => {
        if (!t?.name || t.name.trim().length === 0) return false;
        // Modules and milestones with explicit due date are processable
        if (t?.dueDate) return true;
        // Allow saving non-Phase 3 milestones with just a name (dates/subtasks optional)
        const isNonPhase3Milestone = (t?.phaseNumber !== 3) && (t?.isMilestone === true || !!t?.milestoneId);
        if (isNonPhase3Milestone) return true;
        // For Phase 3, still allow milestones if subtasks provide dates
        const subtasks = Array.isArray(t?.subtasks) ? t.subtasks : [];
        return subtasks.some((s: any) => s?.startDate && s?.dueDate);
      };

      completeModules = modulesForToast.filter(isProcessable);
      const incompleteModules = modulesForToast.filter((t: any) => !isProcessable(t));

      console.log('Complete modules after filtering (processable only):', completeModules);
      console.log('Incomplete modules (processable only):', incompleteModules);

    // Show warning if there are incomplete modules, but don't block submission
    if (incompleteModules.length > 0) {
      toast({ 
        title: 'Incomplete Modules', 
        description: `${incompleteModules.length} module(s) are incomplete and will be skipped. You can still save the project.`, 
        variant: 'default' 
      });
      }
    }



    console.log('Submitting project with data:', data);

    console.log('Complete modules:', completeModules);

    console.log('Milestones:', milestones);
    

    // Detect presence of non-Phase-3 milestone containers to ensure we process them
    const hasNonPhase3Milestones = (mappedModules as any[]).some(
      (m: any) => m && m.isMilestone && m.phaseNumber !== 3
    );
    console.log('Gate check → completeModules:', completeModules.length, 'allMilestones:', allMilestones.length, 'hasNonPhase3Milestones:', hasNonPhase3Milestones);
    
    createProjectMutation.mutate(data, {
      onSuccess: async (project) => {
        console.log('Project mutation successful:', project);
        
        // Handle modules and milestones for both create and edit modes
        if (completeModules.length > 0 || allMilestones.length > 0 || hasNonPhase3Milestones) {
          try {
            console.log('Processing modules and milestones...');
            await processModulesAndMilestones(completeModules, project, isEditMode, allMilestones);
            // Only show success and close modal after milestones are processed successfully
            setIsOpen(false);
            form.reset();
            if (onClose) onClose();
            toast({
              title: "Success",
              description: isEditMode ? "Project updated successfully" : "Project created successfully",
            });
          } catch (error) {
            console.error('Error during milestone processing:', error);
            toast({
              title: "Warning",
              description: "Project created but milestones failed to process. Please try again.",
              variant: "destructive",
            });
            // Don't close modal or show success if milestones failed
          }
        } else {
          console.log('No modules to process, showing success immediately');
          // No milestones to process, show success immediately
          setIsOpen(false);
          form.reset();
          if (onClose) onClose();
          toast({
            title: "Success",
            description: isEditMode ? "Project updated successfully" : "Project created successfully",
          });
        }
      },
      onError: (error) => {
        console.error('Project mutation failed:', error);
      }
    });

  };



    // Enhanced function to detect changes in modules with detailed comparison

  const detectModuleChanges = (currentModules: NewModuleRow[], existingModules: any[]) => {

    const changes: { type: 'create' | 'update' | 'delete'; module: any; original?: any; changedFields?: string[] }[] = [];

    
    
    // Create a map of existing modules by ID

    const existingMap = new Map(existingModules.map(m => [m.id, m]));

    const currentMap = new Map(currentModules.filter(t => (t as any).id).map(t => [(t as any).id, t]));

    
    
    // Check for updates and creations

    currentModules.forEach(module => {

      if ((module as any).id) {

        // Existing module - check for changes

        const existing = existingMap.get((module as any).id);

        if (existing) {

          const changedFields: string[] = [];

          
          
          // Check each field for changes

          if (module.name !== existing.name) changedFields.push('name');

          if (module.description !== (existing.description || '')) changedFields.push('description');

          if (module.priority !== existing.priority) changedFields.push('priority');

          if (module.startDate !== (existing.startDate ? new Date(existing.startDate).toISOString().slice(0, 10) : '')) changedFields.push('startDate');

          if (module.dueDate !== (existing.dueDate ? new Date(existing.dueDate).toISOString().slice(0, 10) : '')) changedFields.push('dueDate');

          if (module.assignedUserId !== existing.assignedUserId) changedFields.push('assignedUserId');

          if (module.phaseNumber !== existing.phaseNumber) changedFields.push('phaseNumber');

          if (module.phaseName !== existing.phaseName) changedFields.push('phaseName');

          
          
          // Deep compare subtasks with preserved assignment IDs

          const currentSubtasks = (module.subtasks || []).map((st: any) => ({

            ...st,

            assignedDevId: st.assignedDevId || undefined,

            assignedConsultantId: st.assignedConsultantId || undefined

          }));

          const existingSubtasks = (existing.subtasks || []).map((st: any) => ({

            ...st,

            assignedDevId: st.assignedDevId || undefined,

            assignedConsultantId: st.assignedConsultantId || undefined

          }));

          
          
          if (JSON.stringify(currentSubtasks) !== JSON.stringify(existingSubtasks)) {

            changedFields.push('subtasks');

          }

          
          
          if (changedFields.length > 0) {

            changes.push({

              type: 'update',

              module: module,

              original: existing,

              changedFields

            });

          }

        }

      } else {

        // New module

        changes.push({

          type: 'create',

          module: module

        });

      }

    });

    
    
    // Check for deletions

    existingModules.forEach(existing => {

      if (!currentMap.has(existing.id)) {

        changes.push({

          type: 'delete',

          module: existing

        });

      }

    });

    
    
    return changes;

  };



  // Helper function to clean payload values

  const cleanPayloadValue = (value: any) => {

    if (value === null || value === undefined || value === '') {

      return undefined;

    }

    return value;

  };



  // Helper function to validate and format dates

  const formatDate = (dateValue: any) => {

    if (!dateValue || dateValue === '') {

      return undefined;

    }

    
    
    try {

      const date = new Date(dateValue);

      if (isNaN(date.getTime())) {

        console.warn('Invalid date value:', dateValue);

        return undefined;

      }

      // Return Date object for drizzle timestamp columns

      return date;

    } catch (error) {

      console.warn('Error formatting date:', dateValue, error);

      return undefined;

    }

  };



  // Helper function to validate and format numbers

  const formatNumber = (numValue: any) => {

    if (!numValue || numValue === '') {

      return undefined;

    }

    
    
    try {

      // Remove commas and other formatting characters

      const cleanValue = String(numValue).replace(/[,\s]/g, '');

      const num = Number(cleanValue);

      if (isNaN(num)) {

        console.warn('Invalid number value:', numValue);

        return undefined;

      }

      return num;

    } catch (error) {

      console.warn('Error formatting number:', numValue, error);

      return undefined;

    }

  };



  // Helper function to clean entire payload

  const cleanPayload = (payload: any) => {

    const cleaned: any = {};

    Object.keys(payload).forEach(key => {

      const value = payload[key];

      if (value !== null && value !== undefined && value !== '') {

        cleaned[key] = value;

      }

    });

    return cleaned;

  };



  // Enhanced module and milestone processing with improved batch handling

  const processModulesAndMilestones = async (validated: any[], project: any, isEditMode: boolean, milestones: any[] = []) => {

    console.log('processModulesAndMilestones called with:', { validated, project, isEditMode, milestones });

    
    
    // Process milestones first (especially important for Phase 3)

    if (milestones.length > 0) {

      setMilestoneProgress({ current: 0, total: milestones.length, message: 'Processing billing milestones...' });

      
      
      const milestoneResults: { milestone: any; success: boolean; error?: string }[] = [];

      
      
      for (let i = 0; i < milestones.length; i++) {

        const milestone = milestones[i];

        setMilestoneProgress({ 

          current: i + 1, 

          total: milestones.length, 

          message: `Processing milestone ${i + 1}/${milestones.length}...` 

        });

        
        
        try {

          if (isEditMode && (milestone as any).id) {

            // Update existing milestone

            const milestonePayload = {

              name: milestone.name,

              description: milestone.description || undefined,

              feeAmount: formatNumber(milestone.feeAmount),

              startDate: formatDate(milestone.startDate),

              endDate: formatDate(milestone.endDate),

              expectedInvoiceDate: formatDate(milestone.expectedInvoiceDate),

              expectedCollectionDate: formatDate(milestone.expectedCollectionDate),

              billingStatus: milestone.billingStatus || 'none',

            };

            
            
            // Clean the payload before sending

            const cleanedMilestonePayload = cleanPayload(milestonePayload);

            console.log('Cleaned milestone update payload:', cleanedMilestonePayload);

            
            
            const updateResponse = await apiRequest('PUT', `/api/milestones/${(milestone as any).id}`, cleanedMilestonePayload);

            
            
            if (!updateResponse.ok) {

              const errorText = await updateResponse.text();

              throw new Error(`HTTP ${updateResponse.status}: ${errorText}`);

            }

          } else {

            // Create new milestone

            const milestonePayload = {

              name: milestone.name,

              description: milestone.description || undefined,

              feeAmount: formatNumber(milestone.feeAmount),

              startDate: formatDate(milestone.startDate),

              endDate: formatDate(milestone.endDate),

              expectedInvoiceDate: formatDate(milestone.expectedInvoiceDate),

              expectedCollectionDate: formatDate(milestone.expectedCollectionDate),

              billingStatus: milestone.billingStatus || 'none',

              projectId: project.id,

              createdById: user.id,

            };

            
            
            console.log('Creating milestone with payload:', milestonePayload);

            
            
            // Clean the payload before sending

            const cleanedMilestonePayload = cleanPayload(milestonePayload);

            console.log('Cleaned milestone payload:', cleanedMilestonePayload);

            
            
            const milestoneResponse = await apiRequest('POST', `/api/projects/${project.id}/milestones`, cleanedMilestonePayload);

            
            
            if (!milestoneResponse.ok) {

              const errorText = await milestoneResponse.text();

              throw new Error(`HTTP ${milestoneResponse.status}: ${errorText}`);

            }



            const milestoneData = await milestoneResponse.json();

            
            
            // Store the milestone ID for later use in module creation

            milestone.id = milestoneData.id;



            // Invalidate queries to refresh the UI

            queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'milestones'] });

            queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'phases'] });

            queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'gantt'] });

          }

          
          
          milestoneResults.push({ milestone, success: true });

        } catch (error: any) {

          console.error('Milestone processing failed:', error?.message || 'Unknown error');

          milestoneResults.push({ milestone, success: false, error: error?.message || 'Unknown error' });

        }

      }

      
      
      // Generate results report for milestones

      const successfulMilestones = milestoneResults.filter(r => r.success);

      const failedMilestones = milestoneResults.filter(r => !r.success);

      
      
      if (failedMilestones.length === 0 && successfulMilestones.length > 0) {

        toast({

          title: 'Success',

          description: `All ${successfulMilestones.length} billing milestones processed successfully!`,

        });

      } else if (failedMilestones.length > 0) {

        toast({

          title: 'Milestone Processing Issues',

          description: `${successfulMilestones.length} of ${milestoneResults.length} billing milestones processed successfully. ${failedMilestones.length} failed.`,

          variant: 'destructive'

        });

      }

    }

    
    
    // Detect changes if in edit mode

    let processableModules = validated;

    if (isEditMode && existingModules.length > 0) {

      const changes = detectModuleChanges(validated, existingModules);

      console.log('Detected changes:', changes);

      
      
      // Only process modules that have changes

      processableModules = changes

        .filter(change => change.type === 'create' || change.type === 'update')

        .map(change => change.module);
      
      
      
      if (processableModules.length === 0) {

        console.log('No module changes detected, skipping module processing');

      }

    }

    
    
    // Also collect milestone-items (non-Phase-3 milestone containers)

    const milestoneItems = (validated as any[]).filter(

      (m: any) => m && m.isMilestone && m.phaseNumber !== 3 && (m.milestoneId || m.id)

    );

    
    
    // Process modules if there are any to process

    if (processableModules.length > 0) {

      setIsProcessingMilestones(true);

      setMilestoneProgress({ current: 0, total: processableModules.length, message: 'Processing modules...' });

      
      
      // Track processed modules to prevent duplicates

      const processedModuleIds = new Set();

      const results: { module: any; success: boolean; error?: string; retries: number }[] = [];

      
      
      // Process modules in smaller batches for better performance

      const batchSize = 2;

      for (let i = 0; i < processableModules.length; i += batchSize) {

        const batch = processableModules.slice(i, i + batchSize);

        const batchNumber = Math.floor(i / batchSize) + 1;

        const totalBatches = Math.ceil(processableModules.length / batchSize);

        
        
        setMilestoneProgress({ 

          current: i, 

          total: processableModules.length, 

          message: `Processing batch ${batchNumber}/${totalBatches}...` 

        });

        
        
        // Process batch sequentially to prevent duplicates

        const batchResults = [];

        for (const module of batch) {

          const moduleKey = (module as any).id || `${module.name}-${module.phaseNumber}`;

          
          
          // Skip if already processed

          if (processedModuleIds.has(moduleKey)) {

            console.log(`Module ${moduleKey} already processed, skipping`);

            continue;

          }

          
          
          let retries = 0;

          let success = false;

          let error = '';

          
          
          while (retries < 3 && !success) {

            try {

              if (isEditMode && (module as any).id) {

                // Check if module exists before updating

                const existsResponse = await apiRequest('GET', `/api/modules/${(module as any).id}`);

                if (!existsResponse.ok) {

                  console.warn(`Module ${(module as any).id} not found, skipping update`);

                  success = true;

                  break;

                }

                
                
                // Milestone update path for non-Phase-3 milestone containers

                if (module.phaseNumber !== 3 && (module as any).isMilestone) {

                  const targetMilestoneId = (module as any).milestoneId || (module as any).id;

                  console.log('Milestone update path (non-Phase-3). Target milestoneId:', targetMilestoneId, { module });

                  const milestonePayload: any = cleanPayload({

                    name: module.name,

                    description: module.description,

                    priority: module.priority || 'medium',

                    startDate: formatDate(module.startDate),

                    endDate: formatDate(module.dueDate),

                    feeAmount: (module as any).feeAmount,

                    expectedInvoiceDate: formatDate((module as any).expectedInvoiceDate),

                    expectedCollectionDate: formatDate((module as any).expectedCollectionDate),

                    phaseNumber: module.phaseNumber,

                    phaseName: module.phaseName,

                  });

                  console.log('PUT /api/milestones payload:', milestonePayload);

                  const putRes = await apiRequest('PUT', `/api/milestones/${targetMilestoneId}`, milestonePayload);

                  console.log('PUT /api/milestones status:', putRes.status);

                  // Process subtasks directly on milestone

                  if (module.subtasks && module.subtasks.length > 0) {

                    console.log('Posting subtasks to milestone (update path):', targetMilestoneId, module.subtasks.length);

                    await processSubtasks(module.subtasks, { milestoneId: targetMilestoneId });

                  }

                  success = true;

                  break;

                }

                
                
                // Update existing module with only changed fields

                const payload = {

                  name: module.name,

                  description: module.description || undefined,

                  priority: module.priority,

                  assignedUserId: module.assignedUserId || undefined,

                  assignedTeamId: project.teamId, // Auto-assign team from project

                  startDate: formatDate(module.startDate),

                  dueDate: formatDate(module.dueDate),

                  phaseNumber: module.phaseNumber,

                  phaseName: module.phaseName,

                  phase: getPhaseTypeFromNumber(module.phaseNumber), // Add phase identifier

                  status: module.status || 'todo',

                };

                
                
                const cleanedPayload = cleanPayload(payload);

                console.log('Cleaned update payload:', cleanedPayload);

                
                
                const updateResponse = await apiRequest('PUT', `/api/modules/${(module as any).id}`, cleanedPayload);

                  
                  
                  if (!updateResponse.ok) {

                    const errorText = await updateResponse.text();

                  console.error('Module update failed:', updateResponse.status, errorText);

                    throw new Error(`HTTP ${updateResponse.status}: ${errorText}`);

                  }
                  
                  
                  
                // Process subtasks for this module

                if (module.subtasks && module.subtasks.length > 0) {

                  await processSubtasks(module.subtasks, { moduleId: (module as any).id });

                }

              } else {

                // Create new module OR non-Phase-3 milestone

                // If this is a milestone container for a non-Phase-3 phase, create a milestone instead of a module
                if (module.phaseNumber !== 3 && (module as any).isMilestone) {
                  try {
                    const milestonePayload = {
                      name: module.name,
                      description: module.description || undefined,
                      feeAmount: formatNumber((module as any).feeAmount),
                      startDate: formatDate(module.startDate),
                      endDate: formatDate(module.dueDate),
                      expectedInvoiceDate: formatDate((module as any).expectedInvoiceDate),
                      expectedCollectionDate: formatDate((module as any).expectedCollectionDate),
                      billingStatus: (module as any).billingStatus || 'none',
                      projectId: project.id,
                      createdById: user.id,
                      phaseNumber: module.phaseNumber,
                      phaseName: module.phaseName,
                    };

                    console.log('Creating non-Phase-3 milestone with payload:', milestonePayload);
                    const cleanedMilestonePayload = cleanPayload(milestonePayload);
                    const milestoneResponse = await apiRequest('POST', `/api/projects/${project.id}/milestones`, cleanedMilestonePayload);
                    if (!milestoneResponse.ok) {
                      const errorText = await milestoneResponse.text();
                      console.error('Milestone creation failed:', milestoneResponse.status, errorText);
                      throw new Error(`HTTP ${milestoneResponse.status}: ${errorText}`);
                    }

                    const milestoneData = await milestoneResponse.json();

                    // Persist subtasks to milestone
                    if (module.subtasks && module.subtasks.length > 0) {
                      await processSubtasks(module.subtasks, { milestoneId: milestoneData.id });
                    }

                    // Invalidate queries to refresh the UI
                    queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'milestones'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'phases'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'gantt'] });

                    success = true;
                    break;
                  } catch (e: any) {
                    console.error('Failed creating non-Phase-3 milestone:', e?.message || e);
                    throw e;
                  }
                }

                // Create new module

                if (!module.name || !module.dueDate) {
                  console.warn('Skipping incomplete module:', module.name, 'missing required fields');
                  success = true;
                  break;
                }

                
                
                // Check if module already exists by name and phase

                const existingCheckResponse = await apiRequest('GET', `/api/projects/${project.id}/modules`);

                if (existingCheckResponse.ok) {

                  const existingModules = await existingCheckResponse.json();

                  const duplicate = existingModules.find((em: any) => 

                    em.name === module.name && em.phaseNumber === module.phaseNumber

                  );

                  if (duplicate) {

                    console.log(`Module ${module.name} already exists in phase ${module.phaseNumber}, skipping creation`);

                    // If this duplicate is a milestone container (non-Phase-3), update milestone and persist subtasks to milestone
                    if (module.phaseNumber !== 3 && (duplicate.isMilestone || module.isMilestone)) {
                      const targetMilestoneId = (duplicate as any).milestoneId || (module as any).milestoneId || (duplicate as any).id || (module as any).id;

                      // Update the milestone fields
                      const milestonePayload: any = cleanPayload({
                        name: module.name,
                        description: module.description,
                        priority: module.priority || 'medium',
                        startDate: formatDate(module.startDate),
                        endDate: formatDate(module.dueDate),
                        feeAmount: formatNumber((module as any).feeAmount),
                        expectedInvoiceDate: formatDate((module as any).expectedInvoiceDate),
                        expectedCollectionDate: formatDate((module as any).expectedCollectionDate),
                        phaseNumber: module.phaseNumber,
                        phaseName: module.phaseName,
                      });

                      console.log('PUT /api/milestones (duplicate-branch) payload:', milestonePayload);
                      const putRes = await apiRequest('PUT', `/api/milestones/${targetMilestoneId}`, milestonePayload);
                      console.log('PUT /api/milestones (duplicate-branch) status:', putRes.status);

                      // Persist subtasks directly to the milestone
                      if (module.subtasks && module.subtasks.length > 0) {
                        await processSubtasks(module.subtasks, { milestoneId: targetMilestoneId });
                      }
                    }

                    success = true;
                    break;
                  }

                }

                
                
                const modulePayload = {

                  name: module.name,

                  description: module.description || undefined,

                  priority: module.priority,

                  projectId: project.id,

                  assignedUserId: module.assignedUserId || undefined,

                  assignedTeamId: project.teamId, // Auto-assign team from project

                  startDate: formatDate(module.startDate),

                  dueDate: formatDate(module.dueDate),

                  phaseNumber: module.phaseNumber,

                  phaseName: module.phaseName,

                  phase: getPhaseTypeFromNumber(module.phaseNumber), // Add phase identifier

                  status: 'todo',

                  createdById: user.id,

                  weight: 2,

                  progressPercent: 0,

                  // Add milestone relationship for Phase 3 modules

                  ...(module.milestoneId && { milestoneId: module.milestoneId }),

                };

                
                
                console.log('Creating module with payload:', modulePayload);

                
                
                const cleanedModulePayload = cleanPayload(modulePayload);

                console.log('Cleaned module payload:', cleanedModulePayload);

                
                
                const moduleResponse = await apiRequest('POST', '/api/modules', cleanedModulePayload);

                
                
                if (!moduleResponse.ok) {

                  const errorText = await moduleResponse.text();

                  console.error('Module creation failed:', moduleResponse.status, errorText);

                  throw new Error(`HTTP ${moduleResponse.status}: ${errorText}`);

                }

                
                
                const moduleData = await moduleResponse.json();



                // Process subtasks for new module

                if (module.subtasks && module.subtasks.length > 0) {

                  await processSubtasks(module.subtasks, { moduleId: moduleData.id });

                }



                // Invalidate queries to refresh the UI

                queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'modules'] });

                queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'phases'] });

                queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'gantt'] });

              }

              
              
              // Mark as processed

              processedModuleIds.add(moduleKey);

              success = true;

            } catch (e: any) {

              retries++;

              error = e?.message || 'Unknown error';

              
              
              if (retries < 3) {

                console.log(`Retrying module ${moduleKey}, attempt ${retries + 1}`);

                await new Promise(resolve => setTimeout(resolve, 1000 * retries));

              }

            }

          }

          
          
          batchResults.push({ module, success, error, retries });

        }

        
        
        results.push(...batchResults);

        
        
        // Small delay between batches

        if (i + batchSize < processableModules.length) {

          await new Promise(resolve => setTimeout(resolve, 300));

        }

      }

      
      
      // Generate results report for modules

      const successful = results.filter(r => r.success);

      const failed = results.filter(r => !r.success);

      
      
      if (failed.length === 0) {

        toast({

          title: 'Success',

          description: `All ${successful.length} modules processed successfully!`,

        });

      } else if (failed.length < successful.length) {

        toast({

          title: 'Partial Success',

          description: `${successful.length} of ${successful.length + failed.length} modules processed successfully. ${failed.length} failed.`,

          variant: 'destructive'

        });

      } else {

        toast({

          title: 'Failed',

          description: `All ${failed.length} modules failed to process.`,

          variant: 'destructive'

        });

      }

    } else if (milestoneItems.length > 0) {

      // New: process non-Phase-3 milestone containers even when there are no modules

      setIsProcessingMilestones(true);

      setMilestoneProgress({ current: 0, total: milestoneItems.length, message: 'Processing milestones...' });



      const milestoneResults: { milestone: any; success: boolean; error?: string }[] = [];

      let index = 0;

      for (const m of milestoneItems) {

        try {

          const milestoneId = m.milestoneId || m.id;

          const payload: any = cleanPayload({

            name: m.name,

            description: m.description,

            priority: m.priority || 'medium',

            startDate: formatDate(m.startDate),

            endDate: formatDate(m.dueDate),

            feeAmount: m.feeAmount,

            expectedInvoiceDate: formatDate(m.expectedInvoiceDate),

            expectedCollectionDate: formatDate(m.expectedCollectionDate),

            phaseNumber: m.phaseNumber,

            phaseName: m.phaseName,

          });

          await apiRequest('PUT', `/api/milestones/${milestoneId}`, payload);

          // Subtasks

          if (m.subtasks && m.subtasks.length > 0) {

            await processSubtasks(m.subtasks, { milestoneId });

          }

          milestoneResults.push({ milestone: m, success: true });

        } catch (err: any) {

          console.error('Milestone save failed:', err?.message || err);

          milestoneResults.push({ milestone: m, success: false, error: err?.message || 'Unknown error' });

        } finally {

          index += 1;

          setMilestoneProgress({ current: index, total: milestoneItems.length, message: 'Processing milestones...' });

        }

      }



      // Invalidate queries

      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'milestones'] });

      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'phases'] });

      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'gantt'] });



      const okCount = milestoneResults.filter(r => r.success).length;

      if (okCount > 0) {

        toast({ title: 'Success', description: `${okCount} milestone(s) processed successfully` });

      } else {

        toast({ title: 'Milestone Processing Issues', description: 'No milestone updates were applied', variant: 'destructive' });

    }
    
        setIsProcessingMilestones(false);

    setMilestoneProgress({ current: 0, total: 0, message: '' });

      // finish like success path

      setIsOpen(false);

      form.reset();

      if (onClose) onClose();

      toast({ title: 'Success', description: isEditMode ? 'Project updated successfully' : 'Project created successfully' });

    } else {

      console.log('No modules to process, showing success immediately');

      // No milestones to process, show success immediately

      setIsOpen(false);

      form.reset();

      if (onClose) onClose();

      toast({ title: 'Success', description: isEditMode ? 'Project updated successfully' : 'Project created successfully' });

    }

    
    
        setIsProcessingMilestones(false);

    setMilestoneProgress({ current: 0, total: 0, message: '' });

  };



  // Process modules for a milestone

  const processModules = async (modules: any[], milestoneId: string) => {

    for (const module of modules) {

      try {

        // Validate required fields

        if (!module.name || module.name.trim() === '') {

          console.error('Module name is required:', module);

          continue;

        }

        
        
        // Milestone container handling for non-Phase-3 phases

        const isMilestoneContainer = module.phaseNumber !== 3 && (module.isMilestone || !module.id || module.milestoneId);

        const effectiveMilestoneId = isMilestoneContainer ? (module.milestoneId || milestoneId || module.id) : undefined;

        if (isMilestoneContainer && effectiveMilestoneId) {

          // Update the milestone fields based on edited values

          const milestonePayload: any = {

            name: module.name?.trim(),

            description: module.description || undefined,

            priority: module.priority || 'medium',

            startDate: module.startDate ? new Date(module.startDate).toISOString() : undefined,

            endDate: module.dueDate ? new Date(module.dueDate).toISOString() : undefined,

            phaseNumber: module.phaseNumber,

            phaseName: module.phaseName,

          };

          await apiRequest('PUT', `/api/milestones/${effectiveMilestoneId}`, milestonePayload);

          // Persist subtasks directly to the milestone

          if (module.subtasks && module.subtasks.length > 0) {

            await processSubtasks(module.subtasks, { milestoneId: effectiveMilestoneId });

          }

          continue;

        }

        
        
        const modulePayload = {

          name: module.name.trim(),

          description: module.description || undefined,

          priority: module.priority || 'medium',

          status: module.status || 'not_started',

          startDate: module.startDate ? new Date(module.startDate).toISOString() : undefined,

          dueDate: module.dueDate ? new Date(module.dueDate).toISOString() : undefined,


          weight: 2,

          assignedUserId: module.assignedUserId || undefined,

          assignedTeamId: null,

          milestoneId: milestoneId,

          phaseNumber: module.phaseNumber,

          phaseName: module.phaseName,

          createdById: project?.managerId || user.id,

        };

        
        
        if (module.id) {

          // Update existing module

          await apiRequest('PUT', `/api/modules/${module.id}`, modulePayload);

        } else {

          // Create new module

          const moduleResponse = await apiRequest('POST', '/api/modules', modulePayload);

          const moduleData = await moduleResponse.json();

          
          
          // Process subtasks for this module

          if (module.subtasks && module.subtasks.length > 0) {

            await processSubtasks(module.subtasks, { moduleId: moduleData.id });

          }



          // Invalidate queries to refresh the UI

          queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'modules'] });

          queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'phases'] });

          queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'gantt'] });

        }

      } catch (error: any) {

        console.error(`Module processing failed: ${module.name} - ${error?.message || 'Unknown error'}`);

        // Continue processing other modules even if one fails

      }

    }

  };



  // Helper functions for UI

  const getStatusColor = (status: string) => {

    switch (status) {

      case 'not_started': return 'bg-gray-100 text-gray-800';

      case 'in_progress': return 'bg-blue-100 text-blue-800';

      case 'completed': return 'bg-green-100 text-green-800';

      case 'on_hold': return 'bg-yellow-100 text-yellow-800';

      default: return 'bg-gray-100 text-gray-800';

    }

  };



  const getPriorityColor = (priority: string) => {

    switch (priority) {

      case 'low': return 'bg-green-100 text-green-800';

      case 'medium': return 'bg-yellow-100 text-yellow-800';

      case 'high': return 'bg-orange-100 text-orange-800';

      case 'critical': return 'bg-red-100 text-red-800';

      default: return 'bg-gray-100 text-gray-800';

    }

  };



  // Helper function to convert phase number to phase type

  const getPhaseTypeFromNumber = (phaseNumber: number) => {

    switch (phaseNumber) {

      case 1: return 'initiation_contracting';

      case 2: return 'requirements_design';

      case 3: return 'development';

      case 4: return 'testing_validation';

      case 5: return 'deployment_golive';

      case 6: return 'transition_closure';

      default: return 'initiation_contracting';

    }

  };



  const addModule = (phaseIndex: number) => {

    const newModule: NewModuleRow = {

      name: '',

      description: '',

      priority: 'medium',

      status: 'not_started',

      startDate: '',

      dueDate: '',

      phaseNumber: phaseIndex + 1,

      phaseName: phases[phaseIndex]?.phaseName || phases[phaseIndex]?.name || `Phase ${phaseIndex + 1}`,

      subtasks: []

    };

    
    
    const newPhases = [...phases];
    // Minimal fix: for non-Phase-3, if milestones array exists (created by updateMilestoneInPhase), append to milestones so UI shows the new row
    if ((newPhases[phaseIndex].phaseNumber !== 3) && Array.isArray((newPhases[phaseIndex] as any).milestones)) {
      (newPhases[phaseIndex] as any).milestones = [
        ...(((newPhases[phaseIndex] as any).milestones) || []),
        { ...newModule }
      ];
    } else {
    newPhases[phaseIndex].modules = [...(newPhases[phaseIndex].modules || []), newModule];
    }

    setPhases(newPhases);

  };



  const removeModule = (phaseIndex: number, moduleIndex: number) => {

    const newPhases = [...phases];
    if ((newPhases[phaseIndex].phaseNumber !== 3) && Array.isArray((newPhases[phaseIndex] as any).milestones)) {
      (newPhases[phaseIndex] as any).milestones = (newPhases[phaseIndex] as any).milestones.filter((_: any, i: number) => i !== moduleIndex);
    } else {
    newPhases[phaseIndex].modules = newPhases[phaseIndex].modules.filter((_: any, i: number) => i !== moduleIndex);
    }

    setPhases(newPhases);

  };



  const updateModule = (phaseIndex: number, moduleIndex: number, field: string, value: any) => {

    console.log('updateModule called:', { phaseIndex, moduleIndex, field, value });

    console.log('Current phases state:', phases);

    
    
    const newPhases = [...phases];

    
    
    // Ensure collection exists depending on current render source (milestones vs modules)
    const usingMilestones = (newPhases[phaseIndex].phaseNumber !== 3) && Array.isArray((newPhases[phaseIndex] as any).milestones);
    if (usingMilestones) {
      if (!Array.isArray((newPhases[phaseIndex] as any).milestones)) {
        (newPhases[phaseIndex] as any).milestones = [];
      }
    } else {
    if (!newPhases[phaseIndex].modules) {
      newPhases[phaseIndex].modules = [];
      }
    }

    
    
    // Ensure item exists
    const collection = usingMilestones ? (newPhases[phaseIndex] as any).milestones : newPhases[phaseIndex].modules;
    if (!collection[moduleIndex]) {
      console.error('Module/Milestone not found at index:', moduleIndex);
      return;
    }

    
    
    if (usingMilestones) {
      (newPhases[phaseIndex] as any).milestones[moduleIndex] = {
        ...(newPhases[phaseIndex] as any).milestones[moduleIndex],
        [field]: value
      };
    } else {
    newPhases[phaseIndex].modules[moduleIndex] = {
      ...newPhases[phaseIndex].modules[moduleIndex],
      [field]: value
    };
    }

    
    
    console.log('Updated module/milestone:', usingMilestones ? (newPhases[phaseIndex] as any).milestones[moduleIndex] : newPhases[phaseIndex].modules[moduleIndex]);

    setPhases(newPhases);

  };



  // Milestone helper functions for Phase 3

  const addMilestoneToPhase = (phaseIndex: number) => {

    const newMilestone = {

      name: '',

      feeAmount: '',

      startDate: '',

      endDate: '',

      expectedInvoiceDate: '',

      expectedCollectionDate: '',

      modules: []

    };

    
    
    const newPhases = [...phases];

    if (!newPhases[phaseIndex].milestones) {

      newPhases[phaseIndex].milestones = [];

    }

    newPhases[phaseIndex].milestones = [...newPhases[phaseIndex].milestones, newMilestone];

    setPhases(newPhases);

  };



  const removeMilestoneFromPhase = (phaseIndex: number, milestoneIndex: number) => {

    const newPhases = [...phases];

    newPhases[phaseIndex].milestones = newPhases[phaseIndex].milestones.filter((_: any, i: number) => i !== milestoneIndex);

    setPhases(newPhases);

  };



  const updateMilestoneInPhase = (phaseIndex: number, milestoneIndex: number, field: string, value: any) => {
    console.log('updateMilestoneInPhase called:', { phaseIndex, milestoneIndex, field, value });
    console.log('Current phases state:', phases);
    
    const newPhases = [...phases];
    
    // Ensure milestones array exists
    if (!newPhases[phaseIndex].milestones) {
      newPhases[phaseIndex].milestones = [];
    }
    
    // Auto-create milestone shell if missing so inputs are editable immediately
    if (!newPhases[phaseIndex].milestones[milestoneIndex]) {
      console.warn('Milestone not found at index, creating shell:', milestoneIndex);
      newPhases[phaseIndex].milestones[milestoneIndex] = {
        name: '',
        description: '',
        feeAmount: '',
        expectedInvoiceDate: '',
        expectedCollectionDate: '',
        startDate: '',
        endDate: '',
        priority: 'medium',
        billingStatus: 'none',
        // For Phase 3 we need modules; for others, subtasks will be used by UI
        modules: [],
        subtasks: []
      } as any;
    }
    
    newPhases[phaseIndex].milestones[milestoneIndex] = {
      ...newPhases[phaseIndex].milestones[milestoneIndex],
      [field]: value
    };
    
    // Auto-calc expected collection date
    if (field === 'expectedInvoiceDate' && value) {
      const invoiceDate = new Date(value);
      const collectionDate = new Date(invoiceDate);
      collectionDate.setDate(collectionDate.getDate() + 30);
      newPhases[phaseIndex].milestones[milestoneIndex].expectedCollectionDate = collectionDate.toISOString().split('T')[0];
    }
    
    setPhases(newPhases);
  };



  // Module helper functions for Phase 3 milestones

  const addModuleToMilestone = (phaseIndex: number, milestoneIndex: number) => {

    const newModule = {

      name: '',

      priority: 'medium',

      startDate: '',

      dueDate: '',

      subtasks: []

    };

    
    
    const newPhases = [...phases];

    if (!newPhases[phaseIndex].milestones[milestoneIndex].modules) {

      newPhases[phaseIndex].milestones[milestoneIndex].modules = [];

    }

    newPhases[phaseIndex].milestones[milestoneIndex].modules = [...newPhases[phaseIndex].milestones[milestoneIndex].modules, newModule];

    setPhases(newPhases);

  };



  const removeModuleFromMilestone = (phaseIndex: number, milestoneIndex: number, moduleIndex: number) => {

    const newPhases = [...phases];

    newPhases[phaseIndex].milestones[milestoneIndex].modules = newPhases[phaseIndex].milestones[milestoneIndex].modules.filter((_: any, i: number) => i !== moduleIndex);

    setPhases(newPhases);

  };



  const updateModuleInMilestone = (phaseIndex: number, milestoneIndex: number, moduleIndex: number, field: string, value: any) => {

    const newPhases = [...phases];

    newPhases[phaseIndex].milestones[milestoneIndex].modules[moduleIndex] = {

      ...newPhases[phaseIndex].milestones[milestoneIndex].modules[moduleIndex],

      [field]: value

    };

    setPhases(newPhases);

  };



  // Subtask helper functions for Phase 3 modules

  const addSubtaskToModule = (phaseIndex: number, milestoneIndex: number, moduleIndex: number) => {

    const newSubtask = {

      name: '',

      description: '',

      status: 'not_started',

      startDate: '',

      dueDate: '',

      estimatedDays: 1,

      assignedDevId: undefined,

      assignedConsultantId: undefined

    };

    
    
    const newPhases = [...phases];

    if (!newPhases[phaseIndex].milestones[milestoneIndex].modules[moduleIndex].subtasks) {

      newPhases[phaseIndex].milestones[milestoneIndex].modules[moduleIndex].subtasks = [];

    }

    newPhases[phaseIndex].milestones[milestoneIndex].modules[moduleIndex].subtasks = [...newPhases[phaseIndex].milestones[milestoneIndex].modules[moduleIndex].subtasks, newSubtask];

    setPhases(newPhases);

  };



  const removeSubtaskFromModule = (phaseIndex: number, milestoneIndex: number, moduleIndex: number, subtaskIndex: number) => {

    const newPhases = [...phases];

    newPhases[phaseIndex].milestones[milestoneIndex].modules[moduleIndex].subtasks = newPhases[phaseIndex].milestones[milestoneIndex].modules[moduleIndex].subtasks.filter((_: any, i: number) => i !== subtaskIndex);

    setPhases(newPhases);

  };



  // Unified updateSubtask used by regular phases (milestone → subtask) and Phase 3 (module → subtask)

  const updateSubtask_removed = (phaseIndex: number, moduleIndex: number, subtaskIndex: number, field: string, value: any) => {

    console.log('updateSubtask called:', { phaseIndex, moduleIndex, subtaskIndex, field, value });

 

    const newPhases = [...phases];

    const phase = newPhases[phaseIndex];

    if (!phase) {

      console.error('Phase not found at index:', phaseIndex);

      return;

    }

 

    // Non-Phase 3: milestone → subtask

    if (phase.phaseNumber !== 3) {

      if (!phase.milestones || !phase.milestones[moduleIndex]) {

        console.error('Milestone not found at index:', moduleIndex);

        return;

      }

      const milestone = phase.milestones[moduleIndex];

      if (!milestone.subtasks) milestone.subtasks = [];

      if (!milestone.subtasks[subtaskIndex]) {

        console.error('Subtask not found at index:', subtaskIndex);

        return;

      }

      milestone.subtasks[subtaskIndex] = {

        ...milestone.subtasks[subtaskIndex],

      [field]: value

      };

      if (field === 'assignedDevId' || field === 'assignedConsultantId') {

        console.log(`Updated subtask ${subtaskIndex} ${field}:`, value);

        console.log('Updated subtask object:', milestone.subtasks[subtaskIndex]);

      }

      // Live-recalculate parent milestone dates from all subtasks (direct + via modules)
      try {
        const startDates: Date[] = [];
        const dueDates: Date[] = [];
        const pushDatesFrom = (subtasksList?: any[]) => {
          if (!Array.isArray(subtasksList)) return;
          for (const st of subtasksList) {
            if (st?.startDate) {
              const d = new Date(st.startDate);
              if (!isNaN(d.getTime())) startDates.push(d);
            }
            if (st?.dueDate) {
              const d = new Date(st.dueDate);
              if (!isNaN(d.getTime())) dueDates.push(d);
            }
          }
        };
        // Direct milestone subtasks
        pushDatesFrom(milestone.subtasks);
        // Module-linked subtasks under this milestone if any
        const msModules = (milestone as any).modules || [];
        for (const m of msModules) pushDatesFrom(m?.subtasks);
        const minStart = startDates.length ? new Date(Math.min(...startDates.map(d => d.getTime()))) : null;
        const maxDue = dueDates.length ? new Date(Math.max(...dueDates.map(d => d.getTime()))) : null;
        (milestone as any).startDate = minStart ? minStart.toISOString().split('T')[0] : '';
        // Non-Phase 3 uses dueDate as the field name; also keep endDate for consistency
        const dueStr = maxDue ? maxDue.toISOString().split('T')[0] : '';
        (milestone as any).dueDate = dueStr;
        (milestone as any).endDate = dueStr;
        if (maxDue) {
          const inv = new Date(maxDue);
          inv.setDate(inv.getDate() + 1);
          (milestone as any).expectedInvoiceDate = inv.toISOString().split('T')[0];
          const col = new Date(inv);
          col.setDate(col.getDate() + 30);
          (milestone as any).expectedCollectionDate = col.toISOString().split('T')[0];
        } else {
          (milestone as any).expectedInvoiceDate = '';
          (milestone as any).expectedCollectionDate = '';
        }
      } catch {}

    setPhases(newPhases);

      return;

    }

 

    // Phase 3: module → subtask

    if (!phase.modules || !phase.modules[moduleIndex]) {

      console.error('Module not found at index:', moduleIndex);

      return;

    }

    if (!phase.modules[moduleIndex].subtasks) phase.modules[moduleIndex].subtasks = [];

    if (!phase.modules[moduleIndex].subtasks[subtaskIndex]) {

      console.error('Subtask not found at index:', subtaskIndex);

      return;

    }

    phase.modules[moduleIndex].subtasks[subtaskIndex] = {

      ...phase.modules[moduleIndex].subtasks[subtaskIndex],

      [field]: value

    };
    
    if (field === 'assignedDevId' || field === 'assignedConsultantId') {

      console.log(`Updated subtask ${subtaskIndex} ${field}:`, value);

      console.log('Updated subtask object:', phase.modules[moduleIndex].subtasks[subtaskIndex]);

    }
    
    setPhases(newPhases);

  };



  const addMilestone = () => {

    const newMilestone: NewMilestoneRow = {

      name: '',

      description: '',

      feeAmount: '',

      expectedInvoiceDate: '',

      expectedCollectionDate: '',

      status: 'not_started',

      billingStatus: 'none'

    };

    setMilestones([...milestones, newMilestone]);

  };



  const removeMilestone = (index: number) => {

    const newMilestones = milestones.filter((_, i) => i !== index);

    setMilestones(newMilestones);

  };



  const updateMilestone = (index: number, field: string, value: any) => {

    const newMilestones = [...milestones];

    newMilestones[index] = {

      ...newMilestones[index],

      [field]: value

    };

    
    
    // Auto-calculate expected collection date when expected invoice date changes

    if (field === 'expectedInvoiceDate' && value) {

      const invoiceDate = new Date(value);

      const collectionDate = new Date(invoiceDate);

      collectionDate.setDate(collectionDate.getDate() + 30); // 30 days after invoice date

      
      
      newMilestones[index] = {

        ...newMilestones[index],

        expectedCollectionDate: collectionDate.toISOString().split('T')[0]

      };

    }

    
    
    setMilestones(newMilestones);

    
    
    // Auto-calculate contract amount from milestone fees

    if (field === 'feeAmount') {

      const totalAmount = newMilestones.reduce((total, milestone) => {

        // Remove commas before parsing

        const cleanValue = (milestone.feeAmount || '0').replace(/,/g, '');

        const fee = parseFloat(cleanValue) || 0;

        return total + fee;

      }, 0);

      
      
      // Update the budget field with the calculated total

      const formattedAmount = totalAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

      form.setValue('budget', formattedAmount, { shouldValidate: true });

    }

  };



  // Process subtasks for a module

  const processSubtasks = async (

    subtasks: any[],

    target: { moduleId?: string; milestoneId?: string }

  ) => {

    for (const subtask of subtasks) {

      try {

        // Validate required fields

        if (!subtask.name || subtask.name.trim() === '') {

          console.error('Subtask name is required:', subtask);

          continue;

        }
        
        
        
        const payload: any = {

          name: subtask.name.trim(),

          description: subtask.description || undefined,

          priority: subtask.priority || 'medium',

          // IMPORTANT: do NOT include status on updates to avoid invalid transitions

          startDate: subtask.startDate ? new Date(subtask.startDate).toISOString() : undefined,

          dueDate: subtask.dueDate ? new Date(subtask.dueDate).toISOString() : undefined,

          estimatedDays: subtask.estimatedDays ? Number(subtask.estimatedDays) : undefined,

          assignedDevId: subtask.assignedDevId || undefined,

          assignedConsultantId: subtask.assignedConsultantId || undefined,

          progressPercent: subtask.progressPercent || 0,

        };

        
        
        if (target && target.moduleId) payload.moduleId = target.moduleId;

        if (target && target.milestoneId) payload.milestoneId = target.milestoneId;

        
        
        // Debug logging for subtask payload

        console.log(`Processing subtask "${subtask.name}":`, {

          assignedDevId: subtask.assignedDevId,

          assignedConsultantId: subtask.assignedConsultantId,

          payload: payload

        });

        
        
        if (subtask.id) {

          // Update existing subtask

          await apiRequest('PUT', `/api/subtasks/${subtask.id}`, payload);

        } else {

          // Create new subtask

          await apiRequest('POST', '/api/subtasks', payload);

        }

        // Live refresh milestone and gantt dates after subtask change
        try {
          if (project?.id) {
            queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'milestones'] });
            queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'gantt'] });
          }
        } catch { /* noop */ }

      } catch (error: any) {

        console.error(`Subtask processing failed: ${subtask.name} - ${error?.message || 'Unknown error'}`);

        // Continue processing other subtasks even if one fails

      }

    }

  };



  // Open modal when URL contains ?new=project (e.g., from Quick Actions)

  // Done in an effect to avoid setting state during render

  useEffect(() => {

    const params = new URLSearchParams(search ?? "");

    if (!isOpen && params.get('new') === 'project') {

      setIsOpen(true);

    }

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [search]);



  const handleOpenChange = (open: boolean) => {

    setIsOpen(open);

    if (!open) {

      // remove query params to prevent reopening on navigation within the page

      const hasQuery = (search ?? "").length > 0;

      if (hasQuery) setLocation(pathname);

      if (onClose) onClose();

    }

  };



  // Global open handler so any button can open the modal without navigation

  useEffect(() => {

    const openHandler = () => setIsOpen(true);

    // @ts-ignore - CustomEvent type is fine for runtime

    window.addEventListener('open-create-project', openHandler as EventListener);

    return () => {

      // @ts-ignore

      window.removeEventListener('open-create-project', openHandler as EventListener);

    };

  }, []);



  const handleCancel = () => {

    if (isEditMode && project) {

      // Reset to original project data

      form.reset({

        client: project.client || "",

        contactPerson: project.contactPerson || "",

        contactPhone: project.contactPhone || "",

        contactEmail: project.contactEmail || "",

        startDate: project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : "",

        endDate: project.endDate ? new Date(project.endDate).toISOString().slice(0, 10) : "",

        segment: project.segment || "private",

        teamId: project.teamId || "none",

        budget: project.budget ? String(project.budget) : "",

        status: project.status || "planning",

      });

      // Don't clear tasks in edit mode to preserve milestones

    } else {

      // For new projects, preserve current segment selection instead of resetting to private

      const currentSegment = form.getValues('segment') || 'private';

      form.reset({

        client: "",

        contactPerson: "",

        contactPhone: "",

        contactEmail: "",

        startDate: "",

        endDate: "",

        segment: currentSegment, // Preserve current segment selection

        teamId: "none",

        budget: "",

        status: "planning",

      });

      setModules([]);

    }

    setIsOpen(false);

    if (onClose) onClose();

  };



  const canCreateProject = (user?.role === 'admin' || user?.role === 'manager');



  if (!canCreateProject) {

    return null;

  }



  // Memoize the current team members to prevent unnecessary re-renders

  const currentTeamMembers = useMemo(() => {

    if (isEditMode) {

      return projectTeamMembers.filter((member: any) => member.id);

    }

    return teamMembers.filter((member: any) => member.id);

  }, [isEditMode, projectTeamMembers, teamMembers]);



  // Create role-based filtered arrays for subtask assignment

  const developersOnly = useMemo(() => {

    return currentTeamMembers.filter((member: any) => 

      member.role === 'BC Developer' || member.role === 'Portal Developer'

    );

  }, [currentTeamMembers]);



  const consultantsOnly = useMemo(() => {

    return currentTeamMembers.filter((member: any) => 

      member.role === 'Functional Consultant'

    );

  }, [currentTeamMembers]);



  // Memoize the filtered team members to prevent duplicate filtering on every render

  const filteredTeamMembers = useMemo(() => {

    return currentTeamMembers.filter((member: any, index: number, array: any[]) => 

      array.findIndex(m => m.id === member.id) === index

    );

  }, [currentTeamMembers]);



  // Prevent form inputs from becoming unresponsive

  const handleInputChange = (field: string, value: any) => {

    form.setValue(field as any, value, { shouldValidate: true, shouldDirty: true });

  };



  // Ensure form inputs maintain focus and responsiveness

  const handleInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {

    event.target.select();

  };



  const handleTextareaFocus = (event: React.FocusEvent<HTMLTextAreaElement>) => {

    event.target.select();

  };



  // Helper: scroll to first field error and highlight it briefly

  const getFirstErrorPath = (errors: any, parentPath: string = ''): string | null => {

    if (!errors) return null;

    for (const key of Object.keys(errors)) {

      const value = (errors as any)[key];

      const path = parentPath ? `${parentPath}.${key}` : key;

      if (value?.message) return path;

      if (typeof value === 'object') {

        const child = getFirstErrorPath(value, path);

        if (child) return child;

      }

    }

    return null;

  };



  const scrollToFirstError = (errors: any) => {

    const path = getFirstErrorPath(errors);

    if (!path) {

      // Fallback: scroll to top of the form

      window.scrollTo({ top: 0, behavior: 'smooth' });

      return;

    }

    const el = document.querySelector(`[name="${path}"]`) as HTMLElement | null;

    if (el) {

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      if ((el as any).focus) {

        (el as any).focus();

      }

      el.classList.add('ring-2', 'ring-red-500');

      window.setTimeout(() => el.classList.remove('ring-2', 'ring-red-500'), 1500);

    } else {

      window.scrollTo({ top: 0, behavior: 'smooth' });

    }

  };



  // Add subtask for regular phases (milestone → subtask)

  const addSubtask = (phaseIndex: number, moduleIndex: number) => {

    const newSubtask = {

      name: '',

      description: '',

      status: 'not_started',

      priority: 'medium',

      startDate: '',

      dueDate: '',

      estimatedDays: 1,

      assignedDevId: undefined,

      assignedConsultantId: undefined

    };

    const newPhases = [...phases];

    const phase = newPhases[phaseIndex];

    if (!phase) return;

    // Support both regular-phase structures: milestones[] or modules[]
    let container: any | undefined = undefined;
    if (phase.milestones && phase.milestones[moduleIndex]) {
      container = phase.milestones[moduleIndex];
    } else if (phase.modules && phase.modules[moduleIndex]) {
      container = phase.modules[moduleIndex];
    }
    if (!container) return;

    if (!container.subtasks) container.subtasks = [];

    container.subtasks = [...container.subtasks, newSubtask];

    setPhases(newPhases);

    // Ensure the subtasks section is expanded so the new row is visible
    if (areModuleSubtasksCollapsed(phaseIndex, moduleIndex)) {
      toggleModuleSubtasks(phaseIndex, moduleIndex);
    }

  };



  const removeSubtask = (phaseIndex: number, moduleIndex: number, subtaskIndex: number) => {

    const newPhases = [...phases];

    const phase = newPhases[phaseIndex];

    if (!phase || !phase.milestones || !phase.milestones[moduleIndex] || !phase.milestones[moduleIndex].subtasks) return;

    phase.milestones[moduleIndex].subtasks = phase.milestones[moduleIndex].subtasks.filter((_: any, i: number) => i !== subtaskIndex);

    setPhases(newPhases);

  };



  const updateSubtaskInModule = (phaseIndex: number, milestoneIndex: number, moduleIndex: number, subtaskIndex: number, field: string, value: any) => {

    const newPhases = [...phases];

    const phase = newPhases[phaseIndex];

    if (!phase || !phase.milestones || !phase.milestones[milestoneIndex] || !phase.milestones[milestoneIndex].modules || !phase.milestones[milestoneIndex].modules[moduleIndex]) {

      console.error('Phase/Milestone/Module not found', { phaseIndex, milestoneIndex, moduleIndex });

      return;

    }

    const mod = phase.milestones[milestoneIndex].modules[moduleIndex];

    if (!mod.subtasks) mod.subtasks = [];

    if (!mod.subtasks[subtaskIndex]) {

      console.error('Subtask not found at index:', subtaskIndex);

      return;

    }

    mod.subtasks[subtaskIndex] = {

      ...mod.subtasks[subtaskIndex],

      [field]: value

    };

    // Live-recalculate parent milestone dates from all subtasks (direct + via modules)
    try {
      const milestone = phase.milestones[milestoneIndex];
      const collectDates = () => {
        const startDates: Date[] = [];
        const dueDates: Date[] = [];
        const pushDatesFrom = (subtasksList?: any[]) => {
          if (!Array.isArray(subtasksList)) return;
          for (const st of subtasksList) {
            if (st?.startDate) {
              const d = new Date(st.startDate);
              if (!isNaN(d.getTime())) startDates.push(d);
            }
            if (st?.dueDate) {
              const d = new Date(st.dueDate);
              if (!isNaN(d.getTime())) dueDates.push(d);
            }
          }
        };
        // Direct milestone subtasks
        pushDatesFrom((milestone as any).subtasks);
        // Module-linked subtasks
        const msModules = (milestone as any).modules || [];
        for (const m of msModules) pushDatesFrom(m?.subtasks);
        return { startDates, dueDates };
      };
      const { startDates, dueDates } = collectDates();
      const minStart = startDates.length ? new Date(Math.min(...startDates.map(d => d.getTime()))) : null;
      const maxDue = dueDates.length ? new Date(Math.max(...dueDates.map(d => d.getTime()))) : null;
      (milestone as any).startDate = minStart ? minStart.toISOString().split('T')[0] : '';
      (milestone as any).endDate = maxDue ? maxDue.toISOString().split('T')[0] : '';
      if (maxDue) {
        const inv = new Date(maxDue);
        inv.setDate(inv.getDate() + 1);
        (milestone as any).expectedInvoiceDate = inv.toISOString().split('T')[0];
      } else {
        (milestone as any).expectedInvoiceDate = '';
      }
    } catch {}

    setPhases(newPhases);

  };



  return (

    <Dialog open={isOpen} onOpenChange={handleOpenChange}>

      <DialogTrigger asChild>

        {isEditMode ? (

          <Button 

            variant="ghost" 

            size="sm" 

            onClick={() => {

              setIsOpen(true);

            }}

            data-testid={`button-edit-project-${project?.id}`}

          >

            Edit

          </Button>

        ) : (

          <Button 

            className="bg-primary hover:bg-primary-dark" 

            onClick={() => setIsOpen(true)}

            data-testid="button-create-project"

          >

            <Plus className="h-4 w-4 mr-2" />

            New Project

          </Button>

        )}

      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="modal-create-project">

        <DialogHeader>

          <DialogTitle>{isEditMode ? 'Edit Project' : 'Create New Project'}</DialogTitle>

          <DialogDescription>

            {isEditMode ? 'Update project details.' : 'Create a new project to organize tasks and track progress.'}

          </DialogDescription>

        </DialogHeader>

        
        
        <Form {...form}>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            
            
            {/* Basic Project Information Section */}

            <div className="space-y-6">

              <div className="border-b border-gray-200 pb-4">

                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">

                  <UserCircle2 className="h-5 w-5 text-blue-600" />

                  Basic Information

                </h3>

                <p className="text-sm text-gray-600 mt-1">Core project details and description</p>

              </div>

              
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <FormField

                  control={form.control}

                  name="client"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">Client *</FormLabel>

                      <FormControl>

                        <Input 

                          placeholder="Enter client name" 

                          className="h-11"

                          {...field} 

                          data-testid="input-project-client"

                          onFocus={handleInputFocus}

                        />

                      </FormControl>

                      <FormMessage />

                    </FormItem>

                  )}

                />

                
                
                <FormField

                  control={form.control}

                  name="contactPerson"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">Contact Person *</FormLabel>

                      <FormControl>

                        <Input 

                          placeholder="Enter contact person name" 

                          className="h-11"

                          {...field} 

                          data-testid="input-project-contact-person"

                          onFocus={handleInputFocus}

                        />

                      </FormControl>

                      <FormMessage />

                    </FormItem>

                  )}

                />

              </div>



              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <FormField

                  control={form.control}

                  name="contactPhone"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">Contact Phone *</FormLabel>

                      <FormControl>

                        <Input 

                          placeholder="Enter contact phone number" 

                          className="h-11"

                          {...field} 

                          data-testid="input-project-contact-phone"

                          onFocus={handleInputFocus}

                        />

                      </FormControl>

                      <FormMessage />

                    </FormItem>

                  )}

                />

                
                
                <FormField

                  control={form.control}

                  name="contactEmail"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">Contact Email</FormLabel>

                      <FormControl>

                        <Input 

                          placeholder="Enter contact email (optional)" 

                          className="h-11"

                          {...field} 

                          data-testid="input-project-contact-email"

                          onFocus={handleInputFocus}

                        />

                      </FormControl>

                      <FormMessage />

                    </FormItem>

                  )}

                />

              </div>



              {/* Removed description field - no longer needed */}

            </div>



            {/* Project Organization Section */}

            <div className="space-y-6">

              <div className="border-b border-gray-200 pb-4">

                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">

                  <Users className="h-5 w-5 text-green-600" />

                  Organization & Team

                </h3>

                <p className="text-sm text-gray-600 mt-1">Team assignment and project categorization</p>

              </div>

              
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <FormField

                  control={form.control}

                  name="segment"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">Project Segment *</FormLabel>

                      <Select 

                        onValueChange={field.onChange} 

                        value={field.value || 'private'}

                      >

                        <FormControl>

                          <SelectTrigger className="h-11" data-testid="select-project-segment">

                            <SelectValue placeholder="Select segment" />

                          </SelectTrigger>

                        </FormControl>

                        <SelectContent>

                          <SelectItem value="academic">Academic</SelectItem>

                          <SelectItem value="parastals">Parastals</SelectItem>

                          <SelectItem value="private">Private</SelectItem>

                        </SelectContent>

                      </Select>

                      <FormMessage />

                    </FormItem>

                  )}

                />

                
                
                <FormField

                  control={form.control}

                  name="teamId"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">Team Assignment</FormLabel>

                      <Select onValueChange={field.onChange} value={field.value}>

                        <FormControl>

                          <SelectTrigger className="h-11" data-testid="select-project-team">

                            <SelectValue placeholder="Select team (optional)" />

                          </SelectTrigger>

                        </FormControl>

                        <SelectContent>

                          <SelectItem value="none">No team assigned</SelectItem>

                          {teams.length === 0 ? (

                            <SelectItem value="no-teams" disabled>

                              No teams available for {currentSegment} segment

                            </SelectItem>

                          ) : (

                            teams

                              .filter((team) => team.id)

                              .filter((team, index, array) => 

                                array.findIndex(t => t.id === team.id) === index

                              )

                              .map((team, index) => {

                                return (

                                  <SelectItem key={`team-${team.id}-${index}`} value={team.id}>

                                    {team.name}

                                  </SelectItem>

                                );

                              })

                          )}

                        </SelectContent>

                      </Select>

                      <FormMessage />

                    </FormItem>

                  )}

                />

                {/* Project Leader (Manager) selection */}
                <FormField
                  control={form.control}
                  name="managerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Project Leader (Manager)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11" data-testid="select-project-manager">
                            <SelectValue placeholder="Select project leader" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* Prefer team members if a team is selected */}
                          {(() => {
                            const selectedTeamId = form.getValues("teamId");
                            const selectedTeam = selectedTeamId && selectedTeamId !== 'none' ? teams.find((t: any) => t.id === selectedTeamId) : null;
                            const teamMembers = (selectedTeam?.members || []).map((m: any) => m.user || m);
                            const uniq = (arr: any[]) => arr.filter((x, i) => arr.findIndex(y => (y.id || y.userId) === (x.id || x.userId)) === i);
                            const options = uniq(teamMembers.length > 0 ? teamMembers : admins);
                            if (!options || options.length === 0) {
                              return <SelectItem value="no_managers" disabled>No candidates available</SelectItem>;
                            }
                            return options.map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email || 'Unknown User')}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>

            </div>



            {/* Timeline Section */}

            <div className="space-y-6">

              <div className="border-b border-gray-200 pb-4">

                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">

                  <CalendarDays className="h-5 w-5 text-purple-600" />

                  Project Timeline

                </h3>

                <p className="text-sm text-gray-600 mt-1">Start and end dates for the project</p>

              </div>

              
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <FormField

                  control={form.control}

                  name="startDate"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">Start Date (optional)</FormLabel>

                      <FormControl>
                        <Input 
                          type="date" 
                          className="h-11"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          data-testid="input-project-start-date"
                          onFocus={handleInputFocus}
                        />
                      </FormControl>

                      <FormMessage />

                    </FormItem>

                  )}

                />

                
                
                <FormField

                  control={form.control}

                  name="endDate"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">End Date (optional)</FormLabel>

                      <FormControl>
                        <Input 
                          type="date" 
                          className="h-11"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          data-testid="input-project-end-date"
                          onFocus={handleInputFocus}
                        />
                      </FormControl>

                      <FormMessage />

                    </FormItem>

                  )}

                />

              </div>

            </div>



            {/* Financial & Status Section */}

            <div className="space-y-6">

              <div className="border-b border-gray-200 pb-4">

                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">

                  <DollarSign className="h-5 w-5 text-orange-600" />

                  Financial & Status

                </h3>

                <p className="text-sm text-gray-600 mt-1">Budget and project status information</p>

              </div>

              
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <FormField

                  control={form.control}

                  name="budget"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">Contract Amount (KSh)</FormLabel>

                      <FormControl>

                        <Input 

                          type="text" 

                          placeholder="0.00" 

                          min="0" 

                          className="h-11"

                          value={field.value || ''}

                          onChange={(e) => {

                            // Remove commas and non-numeric characters except decimal point

                            const rawValue = e.target.value.replace(/[^\d.]/g, '');

                            
                            
                            // Format with commas for thousands

                            let formattedValue = rawValue;

                            if (rawValue.includes('.')) {

                              const [whole, decimal] = rawValue.split('.');

                              formattedValue = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + decimal;

                            } else if (rawValue.length > 3) {

                              formattedValue = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

                            }

                            
                            
                            field.onChange(formattedValue);

                          }}

                          data-testid="input-project-budget"

                          onFocus={handleInputFocus}

                        />

                      </FormControl>

                      <FormMessage />

                    </FormItem>

                  )}

                />

                
                
                {/* Status field - only show in edit mode */}

                {isEditMode && (

                  <FormField

                    control={form.control}

                    name="status"

                    render={({ field }) => (

                      <FormItem>

                        <FormLabel className="text-sm font-medium text-gray-700">Project Status</FormLabel>

                        <Select 

                          onValueChange={field.onChange} 

                          value={field.value || 'planning'}

                        >

                          <FormControl>

                            <SelectTrigger className="h-11" data-testid="select-project-status">

                              <SelectValue placeholder="Select status" />

                            </SelectTrigger>

                          </FormControl>

                          <SelectContent>

                            <SelectItem value="planning">Not Started</SelectItem>

                            <SelectItem value="active">Active</SelectItem>

                            <SelectItem value="on_hold">On Hold</SelectItem>

                            <SelectItem value="completed">Completed</SelectItem>

                            <SelectItem value="on_support">On Support</SelectItem>

                            <SelectItem value="inactive">Inactive</SelectItem>

                          </SelectContent>

                        </Select>

                        <FormMessage />

                      </FormItem>

                    )}

                  />

                )}

              </div>

            </div>



            {/* Project Phases Section */}

            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">

              <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">

                <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl">

                  <Clock className="h-7 w-7 text-white" />

                </div>

                Project Phases & Milestones

                <Badge variant="secondary" className="ml-3 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border-purple-200 px-4 py-2 text-sm font-medium">

                  {phases.length} phases

                </Badge>

                </h3>



              <div className="space-y-8">

                {phases.sort((a, b) => (a.id || 0) - (b.id || 0)).map((phase, phaseIndex) => (

                  <div key={`phase-${phase.id || phaseIndex}`} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">

                    {/* Phase Header */}

                    <div className="bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 px-6 py-5 border-b border-gray-200">

                      <div className="flex items-center justify-between mb-4">

                        <div className="flex items-center gap-4">

                          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full text-white font-bold text-lg shadow-lg">

                            {phaseIndex + 1}

                          </div>

                          <div>

                            <h4 className="text-xl font-bold text-gray-900">{phase.name}</h4>

                            <p className="text-sm text-gray-600 mt-1">{phase.description}</p>

                          </div>

                        </div>

                        <div className="flex items-center gap-3">

                          <Badge className={`px-4 py-2 text-sm font-medium ${getStatusColor(phase.status)}`}>

                            {phase.status.replace('_', ' ')}

                          </Badge>

                      {phase.phaseNumber === 3 ? (

                        <Button 

                          type="button" 

                          variant="outline"

                          size="sm"

                          onClick={() => addMilestoneToPhase(phaseIndex)}

                          className="text-blue-700 border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 shadow-sm"

                        >

                          <Plus className="h-4 w-4 mr-2" />

                          Add Milestone

                        </Button>

                      ) : (

                      <Button 

                        type="button" 

                          variant="outline"

                          size="sm"

                          onClick={() => addModule(phaseIndex)}

                            className="text-purple-700 border-purple-300 hover:bg-purple-50 hover:border-purple-400 transition-all duration-200 shadow-sm"

                        >

                            <Plus className="h-4 w-4 mr-2" />

                          Add Milestone

                      </Button>

                      )}

                      </div>

                      </div>

                    </div>

                    
                    
                    {/* Phase Content */}

                    <div className="p-6 space-y-6">

                      {/* Phase 3 Structure: Milestone → Module → Subtask */}

                      {phase.phaseNumber === 3 ? (

                        <div className="space-y-6">

                          {phase.milestones && phase.milestones.length > 0 ? (

                            phase.milestones.map((milestone: any, milestoneIndex: number) => (

                              <div key={`milestone-${phase.id || phaseIndex}-${milestone.id || milestoneIndex}`} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 hover:border-blue-300 transition-all duration-200 shadow-sm">

                                {/* Milestone Header */}

                                <div className="flex items-center justify-between mb-6">

                                  <div className="flex items-center gap-3">

                                    <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white font-semibold text-sm shadow-md">

                                      {milestoneIndex + 1}

                                    </div>

                                    <div>

                                      <h5 className="text-lg font-semibold text-gray-800">Milestone {milestoneIndex + 1}</h5>

                                      <p className="text-sm text-gray-600">Billing milestone</p>

                                    </div>

                                  </div>

                                  <Button

                                    type="button"

                                    variant="ghost"

                                    size="sm"

                                    onClick={() => removeMilestoneFromPhase(phaseIndex, milestoneIndex)}

                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200"

                                  >

                                    <X className="h-4 w-4" />

                                  </Button>

                                </div>



                                {/* Milestone Fields */}

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                                  <div className="space-y-2">

                                    <label className="text-sm font-medium text-gray-700">Milestone Name</label>

                                    <Input

                                      placeholder="Enter milestone name"

                                      value={milestone.name}

                                      onChange={(e) => updateMilestoneInPhase(phaseIndex, milestoneIndex, 'name', e.target.value)}

                                      className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"

                                    />

                                  </div>

                                  <div className="space-y-2">

                                    <label className="text-sm font-medium text-gray-700">Fee Amount (KSH)</label>

                                    <Input

                                      type="text"

                                      placeholder="Enter amount in KSH"

                                      value={milestone.feeAmount || ''}

                                      onChange={(e) => {

                                        const rawValue = e.target.value.replace(/[^\d.]/g, '');

                                        let formattedValue = rawValue;

                                        if (rawValue.includes('.')) {

                                          const [whole, decimal] = rawValue.split('.');

                                          formattedValue = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + decimal;

                                        } else if (rawValue.length > 3) {

                                          formattedValue = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

                                        }

                                        updateMilestoneInPhase(phaseIndex, milestoneIndex, 'feeAmount', formattedValue);

                                      }}

                                      className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"

                                    />

                                  </div>

                                </div>



                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                                  <div className="space-y-2">

                                    <label className="text-sm font-medium text-gray-700">Start Date</label>

                                    <Input

                                      type="date"

                                      placeholder="Select start date"

                                      value={milestone.startDate || ''}

                                      onChange={(e) => updateMilestoneInPhase(phaseIndex, milestoneIndex, 'startDate', e.target.value)}

                                      className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"

                                    />

                                  </div>

                                  <div className="space-y-2">

                                    <label className="text-sm font-medium text-gray-700">End Date</label>

                                    <Input

                                      type="date"

                                      placeholder="Select end date"

                                      value={milestone.endDate || ''}

                                      onChange={(e) => updateMilestoneInPhase(phaseIndex, milestoneIndex, 'endDate', e.target.value)}

                                      className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"

                                    />

                                  </div>

                                </div>



                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                                  <div className="space-y-2">

                                    <label className="text-sm font-medium text-gray-700">Expected Invoice Date</label>

                                    <Input

                                      type="date"

                                      placeholder="Select invoice date"

                                      value={milestone.expectedInvoiceDate || ''}

                                      onChange={(e) => updateMilestoneInPhase(phaseIndex, milestoneIndex, 'expectedInvoiceDate', e.target.value)}

                                      className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"

                                    />

                                  </div>

                                  <div className="space-y-2">

                                    <label className="text-sm font-medium text-gray-700">Expected Collection Date</label>

                                    <Input

                                      type="date"

                                      placeholder="Auto-calculated (30 days after invoice)"

                                      value={milestone.expectedCollectionDate || ''}

                                      readOnly

                                      className="border-green-300 bg-gray-50 text-gray-600 cursor-not-allowed"

                                    />

                                    <p className="text-xs text-gray-500 mt-2">

                                      Automatically calculated as 30 days after invoice date

                                    </p>

                                  </div>

                                </div>



                                {/* Modules under this milestone */}

                                <div className="border-t border-blue-200 pt-6">

                                  <div className="flex items-center justify-between mb-4">

                                    <h6 className="text-md font-semibold text-gray-800 flex items-center gap-2">

                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>

                                      Modules ({(milestone.modules || []).length})

                                    </h6>

                                    <Button 

                                      type="button" 

                                      variant="outline" 

                                      size="sm"

                                      onClick={() => addModuleToMilestone(phaseIndex, milestoneIndex)}

                                      className="text-green-600 border-green-300 hover:bg-green-50 hover:border-green-400 transition-all duration-200"

                                    >

                                      <Plus className="h-4 w-4 mr-2" />

                                      Add Module

                                    </Button>

                                  </div>



                                  {milestone.modules && milestone.modules.length > 0 ? (

                                    <div className="space-y-4">

                                      {milestone.modules.map((module: any, moduleIndex: number) => (

                                        <div key={`module-${milestoneIndex}-${moduleIndex}`} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 hover:border-green-300 transition-all duration-200 shadow-sm">

                                          {/* Module Header */}

                                          <div className="flex items-center justify-between mb-4">

                                            <div className="flex items-center gap-3">

                                              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg text-white font-semibold text-sm shadow-md">

                                                {moduleIndex + 1}

                                              </div>

                                              <div>

                                                <h6 className="font-semibold text-gray-800 text-base">Module {moduleIndex + 1}</h6>

                                                <p className="text-sm text-gray-600">Priority: {module.priority}</p>

                                              </div>

                                              <Badge className={`px-3 py-1 text-xs font-medium ${getPriorityColor(module.priority)}`}>

                                                {module.priority}

                                              </Badge>

                                            </div>

                                            <Button 

                                              type="button" 

                                              variant="ghost" 

                                              size="sm"

                                              onClick={() => removeModuleFromMilestone(phaseIndex, milestoneIndex, moduleIndex)}

                                              className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200"

                                            >

                                              <X className="h-4 w-4" />

                                            </Button>

                                          </div>



                                          {/* Module Fields */}

                                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                                            <div className="space-y-2">

                                              <label className="text-sm font-medium text-gray-700">Module Name</label>

                                              <Input 

                                                placeholder="Enter module name"

                                                value={module.name}

                                                onChange={(e) => updateModuleInMilestone(phaseIndex, milestoneIndex, moduleIndex, 'name', e.target.value)}

                                                className="border-green-300 focus:border-green-500 focus:ring-green-500 transition-all duration-200"

                                              />

                                            </div>

                                            <div className="space-y-2">

                                              <label className="text-sm font-medium text-gray-700">Priority Level</label>

                                              <Select 

                                                value={module.priority}

                                                onValueChange={(value) => updateModuleInMilestone(phaseIndex, milestoneIndex, moduleIndex, 'priority', value as any)}

                                              >

                                                <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200">

                                                  <SelectValue />

                                                </SelectTrigger>

                                                <SelectContent>

                                                  <SelectItem value="low">Low Priority</SelectItem>

                                                  <SelectItem value="medium">Medium Priority</SelectItem>

                                                  <SelectItem value="high">High Priority</SelectItem>

                                                  <SelectItem value="critical">Critical Priority</SelectItem>

                                                </SelectContent>

                                              </Select>

                                            </div>

                                          </div>



                                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                                            <div className="space-y-2">

                                              <label className="text-sm font-medium text-gray-700">Start Date</label>

                                              <Input 

                                                type="date"

                                                placeholder="Select start date"

                                                value={module.startDate || ''}

                                                onChange={(e) => updateModuleInMilestone(phaseIndex, milestoneIndex, moduleIndex, 'startDate', e.target.value)}

                                                className="border-green-300 focus:border-green-500 focus:ring-green-500 transition-all duration-200"

                                              />

                                            </div>

                                            <div className="space-y-2">

                                              <label className="text-sm font-medium text-gray-700">Due Date</label>

                                              <Input 

                                                type="date"

                                                placeholder="Select due date"

                                                value={module.dueDate || ''}

                                                onChange={(e) => updateModuleInMilestone(phaseIndex, milestoneIndex, moduleIndex, 'dueDate', e.target.value)}

                                                className="border-green-300 focus:border-green-500 focus:ring-green-500 transition-all duration-200"

                                              />

                                            </div>

                                          </div>



                                          {/* Subtasks under this module */}

                                          <div className="border-t border-green-200 pt-6">

                                            <div className="flex items-center justify-between mb-4">

                                              <div 

                                                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-all duration-200 w-max"

                                                onClick={() => toggleModuleSubtasks(phaseIndex, moduleIndex)}

                                              >

                                                {areModuleSubtasksCollapsed(phaseIndex, moduleIndex) ? (

                                                  <ChevronRight className="h-4 w-4 text-gray-500" />

                                                ) : (

                                                  <ChevronDown className="h-4 w-4 text-gray-500" />

                                                )}

                                                <h6 className="text-sm font-semibold text-gray-800 flex items-center gap-2">

                                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>

                                                  Subtasks ({(module.subtasks || []).length})

                                                </h6>

                                              </div>

                                              <Button 

                                                type="button" 

                                                variant="outline" 

                                                size="sm"

                                                onClick={() => addSubtaskToModule(phaseIndex, milestoneIndex, moduleIndex)}

                                                className="text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"

                                              >

                                                <Plus className="h-4 w-4 mr-2" />

                                                Add Subtask

                                              </Button>

                                            </div>



                                            {!areModuleSubtasksCollapsed(phaseIndex, moduleIndex) && module.subtasks && module.subtasks.length > 0 ? (

                                              <div className="space-y-3">

                                                {module.subtasks.map((subtask: any, subtaskIndex: number) => (

                                                  <div key={`subtask-${milestoneIndex}-${moduleIndex}-${subtaskIndex}`} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">

                                                    <div className="flex items-center justify-between mb-3">

                                                      <div className="flex items-center gap-2">

                                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>

                                                        <span className="text-sm font-medium text-gray-800">Subtask {subtaskIndex + 1}</span>

                                                      </div>

                                                      <Button 

                                                        type="button" 

                                                        variant="ghost" 

                                                        size="sm"

                                                        onClick={() => removeSubtaskFromModule(phaseIndex, milestoneIndex, moduleIndex, subtaskIndex)}

                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 h-6 w-6 p-0"

                                                      >

                                                        <X className="h-3 w-3" />

                                                      </Button>

                                                    </div>



                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                                                      <div className="space-y-2">

                                                        <label className="text-xs font-medium text-gray-600">Subtask Name</label>

                                                        <Input 

                                                          placeholder="Enter subtask name"

                                                          value={subtask.name} 

                                                          onChange={(e) => updateSubtaskInModule(phaseIndex, milestoneIndex, moduleIndex, subtaskIndex, 'name', e.target.value)}

                                                          className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 text-sm"

                                                        />

                                                      </div>

                                                      <div className="space-y-2">

                                                        <label className="text-xs font-medium text-gray-600">Priority</label>

                                                        <Select

                                                          value={subtask.priority}

                                                          onValueChange={(value) => updateSubtaskInModule(phaseIndex, milestoneIndex, moduleIndex, subtaskIndex, 'priority', value as any)}

                                                        >

                                                          <SelectTrigger className="border-purple-300 focus:border-purple-500 focus:ring-purple-500 text-sm transition-all duration-200">

                                                            <SelectValue />

                                                          </SelectTrigger>

                                                          <SelectContent>

                                                            <SelectItem value="low">Low</SelectItem>

                                                            <SelectItem value="medium">Medium</SelectItem>

                                                            <SelectItem value="high">High</SelectItem>

                                                            <SelectItem value="critical">Critical</SelectItem>

                                                          </SelectContent>

                                                        </Select>

                                                      </div>

                                                    </div>



                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                                                      <div className="space-y-2">

                                                        <label className="text-xs font-medium text-gray-600">Start Date</label>

                                                        <Input 

                                                          type="date"

                                                          placeholder="Select start date"

                                                          value={subtask.startDate || ''}

                                                          // Allow subtask dates to extend module/milestone; parent dates will auto-expand from subtasks
                                                          onChange={(e) => {

                                                            const startDate = e.target.value;

                                                            updateSubtaskInModule(phaseIndex, milestoneIndex, moduleIndex, subtaskIndex, 'startDate', startDate);

                                                            
                                                            
                                                            // Auto-calculate estimated days if both dates are set

                                                            if (startDate && subtask.dueDate) {

                                                              const start = new Date(startDate);

                                                              const due = new Date(subtask.dueDate);

                                                              const diffTime = due.getTime() - start.getTime();

                                                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                                              if (diffDays > 0) {

                                                                updateSubtaskInModule(phaseIndex, milestoneIndex, moduleIndex, subtaskIndex, 'estimatedDays', diffDays);

                                                              }

                                                            }

                                                          }}

                                                          className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 text-sm"

                                                        />

                                                      </div>

                                                      <div className="space-y-2">

                                                        <label className="text-xs font-medium text-gray-600">Due Date</label>

                                                        <Input 

                                                          type="date"

                                                          placeholder="Select due date"

                                                          value={subtask.dueDate || ''}

                                                          // Allow subtask dates to extend module/milestone; parent dates will auto-expand from subtasks
                                         onFocus={(e) => {

                                          // Auto-navigate to start date month when opening due date picker

                                          if (subtask.startDate) {

                                            const startDate = new Date(subtask.startDate);

                                            const year = startDate.getFullYear();

                                            const month = String(startDate.getMonth() + 1).padStart(2, '0');

                                            e.target.setAttribute('data-month', `${year}-${month}`);

                                          }

                                        }}

                                                          onChange={(e) => {

                                                            const dueDate = e.target.value;

                                                            updateSubtaskInModule(phaseIndex, milestoneIndex, moduleIndex, subtaskIndex, 'dueDate', dueDate);

                                                            
                                                            
                                                            // Auto-calculate estimated days if both dates are set

                                                            if (subtask.startDate && dueDate) {

                                                              const start = new Date(subtask.startDate);

                                                              const due = new Date(dueDate);

                                                              const diffTime = due.getTime() - start.getTime();

                                                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                                              if (diffDays > 0) {

                                                                updateSubtaskInModule(phaseIndex, milestoneIndex, moduleIndex, subtaskIndex, 'estimatedDays', diffDays);

                                                              }

                                                            }

                                                          }}

                                                          className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 text-sm"

                                                        />

                                                      </div>

                                                    </div>



                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                                                      <div className="space-y-2">

                                                        <label className="text-xs font-medium text-gray-600">Estimated Days</label>

                                                        <Input 

                                                          type="number"

                                                          placeholder="Auto-calculated from dates"

                                                          value={subtask.estimatedDays || ''}

                                                          readOnly

                                                          className="border-purple-300 bg-gray-50 text-gray-600 cursor-not-allowed text-sm"

                                                        />

                                                        <p className="text-xs text-gray-500 mt-1">

                                                          Calculated from start and end dates

                                                        </p>

                                                      </div>



                                                    </div>



                                                    {/* Team Assignment Section */}

                                                    <div className="border-t border-blue-200 pt-4">

                                                      <h6 className="text-sm font-medium text-blue-700 mb-3 flex items-center gap-2">

                                                        <User className="h-4 w-4" />

                                                        Team Assignment

                                                      </h6>

                                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                                                        <div className="space-y-2">

                                                          <label className="block text-xs font-medium text-blue-600">

                                                            Developer

                                                          </label>

                                                          <Select 

                                                            value={subtask.assignedDevId || 'unassigned'}

                                                            onValueChange={(value) => updateSubtaskInModule(phaseIndex, milestoneIndex, moduleIndex, subtaskIndex, 'assignedDevId', value === 'unassigned' ? undefined : value)}

                                                          >

                                                            <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 text-sm transition-all duration-200">

                                                              <SelectValue placeholder="Select Developer" />

                                                            </SelectTrigger>

                                                            <SelectContent>

                                                              <SelectItem value="unassigned">Unassigned</SelectItem>

                                                              {developersOnly && developersOnly.length > 0

                                                                ? developersOnly

                                                                    .map((member: any) => (

                                                                      <SelectItem key={member.id || `dev-${Math.random()}`} value={member.id}>

                                                                        {member.firstName && member.lastName 

                                                                          ? `${member.firstName} ${member.lastName}` 

                                                                          : member.email || 'Unknown User'

                                                                        } ({member.role || 'No Role'})

                                                                        </SelectItem>

                                                                    ))

                                                                : <SelectItem value="no_devs" disabled>No developers available in team</SelectItem>

                                                              }

                                                            </SelectContent>

                                                          </Select>

                                                        </div>



                                                        <div className="space-y-2">

                                                          <label className="block text-xs font-medium text-blue-600">

                                                            Functional Consultant

                                                          </label>

                                                          <Select 

                                                            value={subtask.assignedConsultantId || 'unassigned'}

                                                            onValueChange={(value) => updateSubtaskInModule(phaseIndex, milestoneIndex, moduleIndex, subtaskIndex, 'assignedConsultantId', value === 'unassigned' ? undefined : value)}

                                                          >

                                                            <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 text-sm transition-all duration-200">

                                                              <SelectValue placeholder="Select FC" />

                                                            </SelectTrigger>

                                                            <SelectContent>

                                                              <SelectItem value="unassigned">Unassigned</SelectItem>

                                                              {consultantsOnly && consultantsOnly.length > 0

                                                                ? consultantsOnly

                                                                    .map((member: any) => (

                                                                      <SelectItem key={member.id || `fc-${Math.random()}`} value={member.id}>

                                                                        {member.firstName && member.lastName 

                                                                          ? `${member.firstName} ${member.lastName}` 

                                                                          : member.email || 'Unknown User'

                                                                        } ({member.role || 'No Role'})

                                                                        </SelectItem>

                                                                    ))

                                                                : <SelectItem value="no_consultants" disabled>No consultants available in team</SelectItem>

                                                              }

                                                            </SelectContent>

                                                          </Select>

                                                        </div>

                                                      </div>

                                                    </div>

                                                  </div>

                                                ))}

                                              </div>

                                            ) : !areModuleSubtasksCollapsed(phaseIndex, moduleIndex) && (

                                              <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">

                                                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">

                                                  <Plus className="h-4 w-4 text-gray-400" />

                                                </div>

                                                <p className="text-xs font-medium text-gray-600">No subtasks added yet</p>

                                                <p className="text-xs text-gray-500">Click "Add Subtask" to get started</p>

                                              </div>

                                            )}

                                          </div>

                                        </div>

                                      ))}

                                    </div>

                                  ) : (

                                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">

                                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">

                                        <Plus className="h-4 w-4 text-gray-400" />

                                      </div>

                                      <p className="text-xs font-medium text-gray-600">No modules added yet</p>

                                      <p className="text-xs text-gray-500">Click "Add Module" to get started</p>

                                    </div>

                                  )}

                                </div>

                              </div>

                            ))

                          ) : (

                            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">

                              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">

                                <Plus className="h-6 w-6 text-gray-400" />

                              </div>

                              <p className="text-sm font-medium text-gray-600">No milestones added yet</p>

                              <p className="text-xs text-gray-500 mt-1">Click "Add Milestone" to get started</p>

                            </div>

                          )}

                        </div>

                      ) : (

                        /* Regular phases (1,2,4,5,6): Milestone → Subtask */

                        (phase.milestones && phase.milestones.length > 0 ? phase.milestones : phase.modules).map((module: any, moduleIndex: number) => (

                        <div key={`module-${phase.id || phaseIndex}-${module.id || moduleIndex}`} className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200 hover:border-blue-300 transition-all duration-200 shadow-sm">

                          {/* Module Header */}

                          <div className="flex items-center justify-between mb-5">

                            <div className="flex items-center gap-4">

                              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white font-semibold text-sm shadow-md">

                                {moduleIndex + 1}

                              </div>

                              <div>

                                <h5 className="text-lg font-semibold text-gray-800">Milestone {moduleIndex + 1}</h5>

                                <p className="text-sm text-gray-600">Priority: {module.priority}</p>

                              </div>

                              <Badge className={`px-3 py-1 text-xs font-medium ${getPriorityColor(module.priority)}`}>

                                {module.priority}

                              </Badge>

                              </div>

                              <Button 

                                type="button" 

                                variant="ghost" 

                                size="sm"

                              onClick={() => removeModule(phaseIndex, moduleIndex)}

                              className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200"

                              >

                                <X className="h-4 w-4" />

                              </Button>

                            </div>



                          {/* Milestone Fields */}

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                            <div className="space-y-2">

                              <label className="text-sm font-medium text-gray-700">Milestone Name</label>

                              <Input 

                                placeholder="Enter milestone name"

                              value={module.name}

                              onChange={(e) => updateMilestoneInPhase(phaseIndex, moduleIndex, 'name', e.target.value)}

                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"

                            />

                            </div>

                            <div className="space-y-2">

                              <label className="text-sm font-medium text-gray-700">Priority Level</label>

                              <Select 

                              value={module.priority}

                              onValueChange={(value) => updateMilestoneInPhase(phaseIndex, moduleIndex, 'priority', value as any)}

                            >

                                <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200">

                                <SelectValue />

                                </SelectTrigger>

                                <SelectContent>

                                <SelectItem value="low">Low Priority</SelectItem>

                                <SelectItem value="medium">Medium Priority</SelectItem>

                                <SelectItem value="high">High Priority</SelectItem>

                                <SelectItem value="critical">Critical Priority</SelectItem>

                                </SelectContent>

                              </Select>

                            </div>

                            </div>



                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                            <div className="space-y-2">

                              <label className="text-sm font-medium text-gray-700">Fee Amount (KSH)</label>

                              <Input

                                type="text"

                                placeholder="Enter amount in KSH"

                                value={module.feeAmount || ''}

                                onChange={(e) => {

                                  const rawValue = e.target.value.replace(/[^\d.]/g, '');

                                  let formattedValue = rawValue;

                                  if (rawValue.includes('.')) {

                                    const [whole, decimal] = rawValue.split('.');

                                    formattedValue = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + decimal;

                                  } else if (rawValue.length > 3) {

                                    formattedValue = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

                                  }

                                  updateMilestoneInPhase(phaseIndex, moduleIndex, 'feeAmount', formattedValue);

                                }}

                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"

                              />

                            </div>

                            <div className="space-y-2">

                              <label className="text-sm font-medium text-gray-700">Expected Invoice Date</label>

                              <Input

                                type="date"

                                placeholder="Select invoice date"

                                value={module.expectedInvoiceDate || ''}

                                onChange={(e) => {

                                  updateMilestoneInPhase(phaseIndex, moduleIndex, 'expectedInvoiceDate', e.target.value);

                                  // Auto-calculate expected collection date

                                  if (e.target.value) {

                                    const invoiceDate = new Date(e.target.value);

                                    const collectionDate = new Date(invoiceDate);

                                    collectionDate.setDate(collectionDate.getDate() + 30);

                                    updateMilestoneInPhase(phaseIndex, moduleIndex, 'expectedCollectionDate', collectionDate.toISOString().split('T')[0]);

                                  }

                                }}

                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"

                              />

                            </div>

                            </div>



                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                            <div className="space-y-2">

                              <label className="text-sm font-medium text-gray-700">Expected Collection Date</label>

                              <Input

                                type="date"

                                placeholder="Auto-calculated (30 days after invoice)"

                                value={module.expectedCollectionDate || ''}

                                readOnly

                                className="border-gray-300 bg-gray-50 text-gray-600 cursor-not-allowed"

                              />

                              <p className="text-xs text-gray-500 mt-2">

                                Automatically calculated as 30 days after invoice date

                              </p>

                            </div>

                            <div></div>

                            </div>



                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                            <div className="space-y-2">

                              <label className="text-sm font-medium text-gray-700">Start Date</label>

                              <Input 

                                type="date"

                                placeholder="Select start date"

                              value={module.startDate || ''}

                              onChange={(e) => updateMilestoneInPhase(phaseIndex, moduleIndex, 'startDate', e.target.value)}

                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"

                              />

                              {module.errors?.startDate && (

                                <p className="text-xs text-red-500 mt-1">{module.errors.startDate}</p>

                              )}

                            </div>

                            <div className="space-y-2">

                              <label className="text-sm font-medium text-gray-700">Due Date</label>

                              <Input 

                                type="date"

                                placeholder="Select due date"

                              value={module.dueDate || ''}

                              onChange={(e) => updateMilestoneInPhase(phaseIndex, moduleIndex, 'dueDate', e.target.value)}

                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"

                            />

                              {module.errors?.dueDate && (

                                <p className="text-xs text-red-500 mt-1">{module.errors.dueDate}</p>

                              )}

                            </div>

                            </div>







                          {/* Subtasks Section - Collapsible */}

                          <div className="border-t border-gray-200 pt-6">

                            <div className="flex items-center justify-between mb-5">

                              <div 

                                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-all duration-200 w-max"

                                onClick={() => toggleModuleSubtasks(phaseIndex, moduleIndex)}

                              >

                                {areModuleSubtasksCollapsed(phaseIndex, moduleIndex) ? (

                                  <ChevronRight className="h-4 w-4 text-gray-500" />

                                ) : (

                                  <ChevronDown className="h-4 w-4 text-gray-500" />

                                )}

                                <h6 className="text-lg font-semibold text-gray-800 flex items-center gap-3">

                                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>

                                  Subtasks ({(module.subtasks || []).length})

                                </h6>

                              </div>

                              <Button 

                                type="button" 

                                variant="outline" 

                                size="sm"

                                onClick={() => addSubtask(phaseIndex, moduleIndex)}

                                className="text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"

                              >

                                <Plus className="h-4 w-4 mr-2" />

                                Add Subtask

                              </Button>

                            </div>



                            {!areModuleSubtasksCollapsed(phaseIndex, moduleIndex) && (

                              <div className="space-y-4">

                                {module.subtasks.map((subtask: any, subtaskIndex: number) => (

                                  <div key={`subtask-${phase.id || phaseIndex}-${module.id || moduleIndex}-${subtask.id || subtaskIndex}`} className="bg-blue-50 rounded-xl border border-blue-200 p-5 hover:border-blue-300 transition-all duration-200 shadow-sm">

                                    <div className="flex items-center justify-between mb-4">

                                      <div className="flex items-center gap-3">

                                        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg text-white font-medium text-xs shadow-sm">

                                          {subtaskIndex + 1}

                                        </div>

                                        <div>

                                          <h6 className="font-semibold text-gray-800">Subtask {subtaskIndex + 1}</h6>

                                          <p className="text-sm text-gray-600">Priority: {subtask.priority || 'medium'}</p>

                                        </div>

                                        <Badge className={`px-2 py-1 text-xs font-medium ${getPriorityColor(subtask.priority || 'medium')}`}>

                                          {subtask.priority || 'medium'}

                                        </Badge>

                                      </div>

                                      <Button 

                                        type="button" 

                                        variant="ghost" 

                                        size="sm"

                                        onClick={() => removeSubtask(phaseIndex, moduleIndex, subtaskIndex)}

                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200"

                                      >

                                        <X className="h-4 w-4" />

                                      </Button>

                                    </div>



                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                                    <div className="space-y-2">

                                      <label className="text-xs font-medium text-gray-600">Subtask Name</label>

                                            <Input 

                                        placeholder="Enter subtask name"

                                              value={subtask.name} 

                                      onChange={(e) => updateSubtask_removed(phaseIndex, moduleIndex, subtaskIndex, 'name', e.target.value)}

                                        className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 text-sm"

                                    />

                                    </div>

                                    <div className="space-y-2">

                                      <label className="text-xs font-medium text-gray-600">Priority</label>

                                            <Select 

                                      value={subtask.priority || 'medium'}

                                      onValueChange={(value) => updateSubtask_removed(phaseIndex, moduleIndex, subtaskIndex, 'priority', value as any)}

                                    >

                                        <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 text-sm">

                                        <SelectValue />

                                              </SelectTrigger>

                                              <SelectContent>

                                                <SelectItem value="low">Low</SelectItem>

                                                <SelectItem value="medium">Medium</SelectItem>

                                                <SelectItem value="high">High</SelectItem>

                                                <SelectItem value="critical">Critical</SelectItem>

                                              </SelectContent>

                                            </Select>

                                    </div>

                                          </div>



                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                                    <div className="space-y-2">

                                      <label className="text-xs font-medium text-gray-600">Start Date</label>

                                            <Input 

                                              type="date"

                                        placeholder="Select start date"

                                      value={subtask.startDate || ''}

                                        // Allow subtask dates to extend module/milestone; parent dates will auto-expand from subtasks
                                              onChange={(e) => {

                                                const startDate = e.target.value;

                                        updateSubtask_removed(phaseIndex, moduleIndex, subtaskIndex, 'startDate', startDate);

                                                
                                                
                                                // Auto-calculate estimated days if both dates are set

                                                if (startDate && subtask.dueDate) {

                                                  const start = new Date(startDate);

                                                  const due = new Date(subtask.dueDate);

                                          const diffTime = due.getTime() - start.getTime();

                                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                          if (diffDays > 0) {

                                            updateSubtask_removed(phaseIndex, moduleIndex, subtaskIndex, 'estimatedDays', diffDays);

                                          }

                                        }

                                      }}

                                        className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 text-sm"

                                      />

                                      {subtask.errors?.startDate && (

                                        <p className="text-xs text-red-500 mt-1">{subtask.errors.startDate}</p>

                                      )}

                                    </div>

                                    <div className="space-y-2">

                                      <label className="text-xs font-medium text-gray-600">Due Date</label>

                                            <Input 

                                              type="date"

                                        placeholder="Select due date"

                                      value={subtask.dueDate || ''}

                                        // Allow subtask dates to extend module/milestone; parent dates will auto-expand from subtasks
                                        onFocus={(e) => {

                                          // Auto-navigate to start date month when opening due date picker

                                          if (subtask.startDate) {

                                            const startDate = new Date(subtask.startDate);

                                            const year = startDate.getFullYear();

                                            const month = String(startDate.getMonth() + 1).padStart(2, '0');

                                            e.target.setAttribute('data-month', `${year}-${month}`);

                                          }

                                        }}

                                              onChange={(e) => {

                                                const dueDate = e.target.value;

                                        updateSubtask_removed(phaseIndex, moduleIndex, subtaskIndex, 'dueDate', dueDate);

                                                
                                                
                                                // Auto-calculate estimated days if both dates are set

                                                if (subtask.startDate && dueDate) {

                                                  const start = new Date(subtask.startDate);

                                                  const due = new Date(dueDate);

                                          const diffTime = due.getTime() - start.getTime();

                                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                          if (diffDays > 0) {

                                            updateSubtask_removed(phaseIndex, moduleIndex, subtaskIndex, 'estimatedDays', diffDays);

                                          }

                                        }

                                      }}

                                        className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 text-sm"

                                    />

                                      {subtask.errors?.dueDate && (

                                        <p className="text-xs text-red-500 mt-1">{subtask.errors.dueDate}</p>

                                      )}

                                    </div>

                                          </div>



                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                                    <div className="space-y-2">

                                      <label className="text-xs font-medium text-gray-600">Estimated Days</label>

                                            <Input 

                                              type="number" 

                                        placeholder="Auto-calculated"

                                              value={subtask.estimatedDays || ''} 

                                        readOnly

                                        className="border-blue-300 bg-gray-50 text-gray-600 cursor-not-allowed transition-all duration-200 text-sm"

                                      />

                                      <p className="text-xs text-gray-500 mt-1">

                                        Calculated from start and end dates

                                      </p>

                                    </div>



                                          </div>



                                  {/* Team Assignment Section */}

                                  <div className="border-t border-blue-200 pt-4">

                                    <h6 className="text-sm font-medium text-blue-700 mb-3 flex items-center gap-2">

                                      <Users className="h-4 w-4 text-blue-500" />

                                      Team Assignment

                                    </h6>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                                      <div className="space-y-2">

                                        <label className="block text-xs font-medium text-blue-600">

                                          Developer

                                        </label>

                                        {/* Developer assignment available for all phases */}

                                        {(

                                          <Select 

                                            value={subtask.assignedDevId || 'unassigned'}

                                            onValueChange={(value) => updateSubtask_removed(phaseIndex, moduleIndex, subtaskIndex, 'assignedDevId', value === 'unassigned' ? undefined : value)}

                                          >

                                            <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 text-sm transition-all duration-200">

                                              <SelectValue placeholder="Select Developer" />

                                            </SelectTrigger>

                                            <SelectContent>

                                              <SelectItem value="unassigned">Unassigned</SelectItem>

                                              {developersOnly && developersOnly.length > 0

                                                ? developersOnly

                                                    .map((member: any) => (

                                                      <SelectItem key={member.id || `dev-${Math.random()}`} value={member.id}>

                                                        {member.firstName && member.lastName 

                                                          ? `${member.firstName} ${member.lastName}` 

                                                          : member.email || 'Unknown User'

                                                        } ({member.role || 'No Role'})

                                                        </SelectItem>

                                                    ))

                                                : <SelectItem value="no_devs" disabled>No developers available in team</SelectItem>

                                              }

                                            </SelectContent>

                                          </Select>

                                        )}

                                      </div>



                                      <div className="space-y-2">

                                        <label className="block text-xs font-medium text-blue-600">

                                          Functional Consultant

                                        </label>

                                        {/* Consultant assignment available for all phases */}

                                        {(

                                          <Select 

                                            value={subtask.assignedConsultantId || 'unassigned'}

                                            onValueChange={(value) => updateSubtask_removed(phaseIndex, moduleIndex, subtaskIndex, 'assignedConsultantId', value === 'unassigned' ? undefined : value)}

                                          >

                                            <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 text-sm transition-all duration-200">

                                              <SelectValue placeholder="Select FC" />

                                            </SelectTrigger>

                                            <SelectContent>

                                              <SelectItem value="unassigned">Unassigned</SelectItem>

                                              {consultantsOnly && consultantsOnly.length > 0

                                                ? consultantsOnly

                                                    .map((member: any) => (

                                                      <SelectItem key={member.id || `fc-${Math.random()}`} value={member.id}>

                                                        {member.firstName && member.lastName 

                                                          ? `${member.firstName} ${member.lastName}` 

                                                          : member.email || 'Unknown User'

                                                        } ({member.role || 'No Role'})

                                                        </SelectItem>

                                                    ))

                                                : <SelectItem value="no_consultants" disabled>No consultants available in team</SelectItem>

                                              }

                                            </SelectContent>

                                          </Select>

                                        )}

                                      </div>

                                      </div>

                                  </div>

                              </div>

                              ))}



                              {module.subtasks.length === 0 && (

                                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">

                                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">

                                    <Plus className="h-6 w-6 text-gray-400" />

                                  </div>

                                  <p className="text-sm font-medium text-gray-600">No subtasks added yet</p>

                                  <p className="text-xs text-gray-500 mt-1">Click "Add Subtask" to get started</p>

                                </div>

                              )}

                              </div>

                            )}

                          </div>

                        </div>

                        ))

                      )}



                      {((phase.milestones && phase.milestones.length === 0) || (!phase.milestones && phase.modules.length === 0)) && (

                        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">

                          <FolderOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />

                          <p className="text-lg font-medium text-gray-600 mb-2">No milestones added yet for this phase</p>

                          <p className="text-sm text-gray-500">Click "Add Milestone" to get started</p>

                        </div>

                      )}

                    </div>

                  </div>

                ))}

              </div>

            </div>







            {/* Progress indicator for milestone processing */}

            {isProcessingMilestones && (

              <div className="pt-4 border-t border-gray-200">

                <div className="flex items-center space-x-3 mb-3">

                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>

                  <span className="text-sm font-medium text-gray-700">

                    {milestoneProgress.message}

                  </span>

                </div>

                <div className="w-full bg-gray-200 rounded-full h-2">

                  <div 

                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"

                    style={{ width: `${milestoneProgress.total > 0 ? (milestoneProgress.current / milestoneProgress.total) * 100 : 0}%` }}

                  ></div>

                </div>

                <p className="text-xs text-gray-500 mt-1">

                  {milestoneProgress.current} of {milestoneProgress.total} milestones processed

                </p>

              </div>

            )}



            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">

              <Button

                type="button"

                variant="outline"

                onClick={handleCancel}

                disabled={isProcessingMilestones}

                data-testid="button-cancel-project"

              >

                Cancel

              </Button>

              <Button 

                type="submit" 

                disabled={createProjectMutation.isPending || isProcessingMilestones}

                data-testid="button-submit-project"

                onClick={() => console.log('Save button clicked')}

              >

                {isProcessingMilestones 

                  ? "Processing Milestones..." 

                  : createProjectMutation.isPending 

                    ? (isEditMode ? "Saving..." : "Creating...") 

                    : (isEditMode ? "Save Changes" : "Create Project")

                }

              </Button>

            </div>

          </form>

        </Form>

      </DialogContent>

    </Dialog>

  );

}

