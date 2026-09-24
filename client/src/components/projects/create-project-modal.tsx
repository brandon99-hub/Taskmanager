import { useEffect, useState, useMemo, useCallback } from "react";

import { useQuery, useMutation } from "@tanstack/react-query";

import { apiRequest, queryClient } from "@/lib/queryClient";

import { useToast } from "@/hooks/use-toast";

import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import UnsavedChangesModal from "@/components/ui/unsaved-changes-modal";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { Badge } from "@/components/ui/badge";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { z } from "zod";

import { Plus, Download, X, CalendarDays, Users, ChevronDown, ChevronRight, Clock, FolderOpen, User } from "lucide-react";

import { useLocation, useSearch } from "wouter";

import { isUnauthorizedError } from "@/lib/authUtils";



const createProjectSchema = z.object({

  name: z.string().min(1, "Project title is required").max(200, "Project title too long"),

  companyId: z.string().optional(),

  contactPerson: z.string().min(1, "Contact person is required").max(200, "Contact person name too long"),

  contactPhone: z.string().min(1, "Contact phone is required").max(50, "Contact phone too long"),

  contactEmail: z.string().email("Invalid contact email").max(200, "Contact email too long"),

  startDate: z.string().min(1, "Start date is required"),

  endDate: z.string().min(1, "End date is required"),

  segmentId: z.string().optional(),

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



export default function CreateProjectModal({ project, onClose }: { project?: any; onClose?: () => void }) {

  const auth = useAuth() as any;

  const { user } = auth;

  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(!!project);

  const [pathname, setLocation] = useLocation();

  const search = useSearch();

  // Billing items (flat "milestones") for this project - id present means it already
  // exists server-side (billing_items table); no id means it's a new row to be created on save.
  const [milestones, setMilestones] = useState<NewMilestoneRow[]>([]);

  // Track deleted billing items (by id) to ensure they're removed from the database on save
  const [deletedMilestones, setDeletedMilestones] = useState<string[]>([]);

  // Hybrid change detection state
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [hasComplexDataChanges, setHasComplexDataChanges] = useState(false);
  const [isFormInitializing, setIsFormInitializing] = useState(false);
  const [isFormReady, setIsFormReady] = useState(false);
  const [initialFormValues, setInitialFormValues] = useState<CreateProjectData | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [dataLoadingComplete, setDataLoadingComplete] = useState(false);
  const [dataProcessingComplete, setDataProcessingComplete] = useState(false);
  const [initialComplexData, setInitialComplexData] = useState<{
    milestones: NewMilestoneRow[];
    deletedMilestones: string[];
  } | null>(null);

  // Combined dirty state
  const isDirty = isFormDirty || hasComplexDataChanges;

  // Custom modal state
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingCloseAction, setPendingCloseAction] = useState<(() => void) | null>(null);

  const [isProcessingMilestones, setIsProcessingMilestones] = useState(false);

  const [milestoneProgress, setMilestoneProgress] = useState({ current: 0, total: 0, message: '' });

  const isEditMode = !!project;



  // Debug modal state changes (only log significant changes)

  useEffect(() => {

    // Silent monitoring

  }, [isOpen, isEditMode, project?.id]);



  const form = useForm<CreateProjectData>({

    resolver: zodResolver(createProjectSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    shouldFocusError: true,

    defaultValues: {

      name: "",

      companyId: "none",

      contactPerson: "",

      contactPhone: "",

      contactEmail: "",

      startDate: "",

      endDate: "",

      segmentId: "",

      teamId: "none",

      budget: "0.00",

      status: "planning",

    },

  });

  // Track form dirty state changes
  // Track form dirty state - only mark as dirty if not in initialization phase and form is ready
  useEffect(() => {
    // Don't mark as dirty during form initialization or if form isn't ready
    if (isFormInitializing || !isFormReady) {
      return; // Skip dirty detection during form initialization
    }
    
     // Only mark as dirty if there are actual changes from initial values
     if (initialFormValues) {
       const currentValues = form.getValues();
       const hasActualChanges = Object.keys(initialFormValues).some(key => {
         const initialValue = initialFormValues[key as keyof CreateProjectData];
         const currentValue = currentValues[key as keyof CreateProjectData];
         
         // Handle different data types
         if (initialValue === null || initialValue === undefined) {
           return currentValue !== null && currentValue !== undefined && currentValue !== '';
         }
         if (currentValue === null || currentValue === undefined) {
           return initialValue !== null && initialValue !== undefined && initialValue !== '';
         }
         
         // Special handling for budget field - normalize comma formatting
         if (key === 'budget') {
           const normalizedInitial = String(initialValue).replace(/,/g, '');
           const normalizedCurrent = String(currentValue).replace(/,/g, '');
           return normalizedInitial !== normalizedCurrent;
         }
         
         return initialValue !== currentValue;
       });
       
      
      setIsFormDirty(hasActualChanges);
    } else {
      // Fallback to form's built-in dirty detection if no initial values
    setIsFormDirty(form.formState.isDirty);
    }
  }, [form.formState.isDirty, isFormInitializing, isFormReady, initialFormValues]);

  // Track complex data changes by comparing with initial state
  useEffect(() => {
    // Only track changes if we have initial data, form is ready, and data processing is complete
    if (!initialComplexData || !isFormReady || !dataProcessingComplete) return;

    const currentComplexData = {
      milestones,
      deletedMilestones
    };

    const hasChanges = JSON.stringify(currentComplexData) !== JSON.stringify(initialComplexData);
    setHasComplexDataChanges(hasChanges);
  }, [milestones, deletedMilestones, initialComplexData, isFormReady, dataProcessingComplete]);

  // Get the current segment value from the form
  const currentSegmentId = form.watch('segmentId');
  const currentTeamId = form.watch('teamId');

  const handleOpenChange = useCallback((open: boolean) => {
    // If trying to close the modal, check for unsaved changes first
    if (!open && isDirty) {
      // Show custom modal instead of browser confirm
      setPendingCloseAction(() => () => {
        setIsOpen(false);
        const hasQuery = (search ?? "").length > 0;
        if (hasQuery) setLocation(pathname);
        if (onClose) onClose();
      });
      setShowUnsavedChangesModal(true);
      return; // Don't close the modal yet
    }

    setIsOpen(open);

    if (!open) {
      // remove query params to prevent reopening on navigation within the page
      const hasQuery = (search ?? "").length > 0;
      if (hasQuery) setLocation(pathname);
      if (onClose) onClose();
    }
  }, [isDirty, isEditMode, project, form, initialComplexData, search, pathname, onClose]);


  const handleDiscardAndClose = useCallback(() => {
    setShowUnsavedChangesModal(false);
    
    // Reset all data to initial state
    if (isEditMode && project) {
      const formData = {
        name: project.name || "",
        companyId: project.companyId || "none",
        contactPerson: project.contactPerson || "",
        contactPhone: project.contactPhone || "",
        contactEmail: project.contactEmail || "",
        startDate: project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : "",
        endDate: project.endDate ? new Date(project.endDate).toISOString().slice(0, 10) : "",
        segmentId: project.segmentId || "",
        teamId: project.teamId || "none",
        budget: project.budget ? String(project.budget) : "",
        status: project.status || "planning",
      };

      // Reset form and form ready state
      setIsFormReady(false);
      form.reset(formData);
      setInitialFormValues({ ...formData });

      // Re-enable form ready state after reset
      setTimeout(() => {
        setIsFormReady(true);
        setIsFormInitializing(false);
      }, 100);

      if (initialComplexData) {
        setMilestones(JSON.parse(JSON.stringify(initialComplexData.milestones)));
        setDeletedMilestones([...initialComplexData.deletedMilestones]);
      }
    } else {
      const preservedSegmentId = form.getValues('segmentId') || '';
      const formData = {
        name: "",
        companyId: "none",
        contactPerson: "",
        contactPhone: "",
        contactEmail: "",
        startDate: "",
        endDate: "",
        segmentId: preservedSegmentId,
        teamId: "none",
        budget: "",
        status: "planning" as const,
      };
      
      setIsFormReady(false);
      form.reset(formData);
      setInitialFormValues({ ...formData });
      
      setTimeout(() => {
        setIsFormReady(true);
        setIsFormInitializing(false);
      }, 100);
      
      setMilestones([]);
      setDeletedMilestones([]);
    }

    // Reset change detection state
    setInitialComplexData(null);
    setIsFormDirty(false);
    setHasComplexDataChanges(false);
    setIsDataLoaded(false);
    setDataLoadingComplete(false);
    setDataProcessingComplete(false);
    setIsFormInitializing(true);

    // Execute the pending close action
    if (pendingCloseAction) {
      pendingCloseAction();
      setPendingCloseAction(null);
    }
  }, [isEditMode, project, form, initialComplexData, pendingCloseAction]);

  const handleKeepEditing = useCallback(() => {
    setShowUnsavedChangesModal(false);
    setPendingCloseAction(null);
  }, []);

  
  
  const { data: segments = [] } = useQuery<any[]>({

    queryKey: ['/api/segments'],

    enabled: isOpen, // load when modal opens

  });

  // Teams are still keyed by the legacy academic/parastals/private name (teams.segment
  // wasn't migrated to the dynamic segments table), so resolve the selected dynamic
  // segment's name to filter teams the same way it always worked for those 3 segments.
  const currentSegmentName = (segments.find((s: any) => s.id === currentSegmentId)?.name || '').toLowerCase();

  const { data: teams = [] } = useQuery<any[]>({

    queryKey: ['/api/teams', currentSegmentName],

    queryFn: async () => {

      const res = await fetch(`/api/teams?segment=${currentSegmentName}`, {

        credentials: 'include',

        cache: 'no-store'

      });

      if (!res.ok) return [];

      return res.json();

    },

    enabled: isOpen && !!currentSegmentName, // load when modal opens and a segment is selected

    staleTime: 0,

    refetchOnMount: 'always',

  });

  const { data: companies = [] } = useQuery<any[]>({

    queryKey: ['/api/companies'],

    enabled: isOpen, // load when modal opens

    staleTime: 20 * 60 * 1000,

  });



  // Helper function to get team name

  const getTeamName = (teamId: string | undefined) => {

    if (!teamId) return 'Team';

    const team = teams.find(t => t.id === teamId);

    return team?.name || 'Team';

  };



  // Auto-open modal in edit mode and prefill form

  useEffect(() => {

    if (project) {

      setIsOpen(true);

      console.log('Edit mode activated for project:', project.id, project.name);

      const formData = {

        name: project.name || "",

        companyId: project.companyId || "none",

        contactPerson: project.contactPerson || "",

        contactPhone: project.contactPhone || "",

        contactEmail: project.contactEmail || "",

        startDate: project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : "",

        endDate: project.endDate ? new Date(project.endDate).toISOString().slice(0, 10) : "",

        segmentId: project.segmentId || "",

        teamId: project.teamId || "none",

        managerId: project.managerId || project.manager?.id || "",

        budget: project.budget ? String(project.budget) : "",

        status: project.status || "planning",

      };

      console.log('Setting form data:', formData);

      // Set initial form values for comparison
      setInitialFormValues({ ...formData });

      // Start initialization process
      setIsFormInitializing(true);
      setIsFormReady(false);
      
      // Reset form with data
      form.reset(formData);
      
      // Wait for form to fully settle before enabling dirty detection
      setTimeout(() => {
        setIsFormInitializing(false);
        // Additional delay to ensure form state is stable
        setTimeout(() => {
          setIsFormReady(true);
          console.log('Form ready for dirty detection');
        }, 200);
      }, 300);

      // Check form validity after reset
      setTimeout(() => {
        console.log('Form validity after reset:', {
          isValid: form.formState.isValid,
          errors: form.formState.errors,
          values: form.getValues(),
          isDirty: form.formState.isDirty,
          isFormReady: isFormReady,
          isFormInitializing: isFormInitializing
        });
      }, 500);

    } else {

      setIsOpen(false);
      setIsFormReady(false);
      setIsDataLoaded(false);
      setDataLoadingComplete(false);
      setDataProcessingComplete(false);
      setInitialFormValues(null);

    }

  }, [project, form]);


  // Initialize complex data tracking after data processing is complete
  useEffect(() => {
    if (project && dataProcessingComplete && !initialComplexData && !isDataLoaded) {
      console.log('Setting initial complex data for change detection');
      // Set initial complex data state for change detection
      setInitialComplexData({
        milestones: JSON.parse(JSON.stringify(milestones)),
        deletedMilestones: [...deletedMilestones]
      });
      setIsDataLoaded(true);
    }
  }, [project, milestones, deletedMilestones, initialComplexData, isDataLoaded, dataProcessingComplete]);

  // Add navigation guard for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle ESC key to close modal
      if (e.key === 'Escape' && isOpen && isDirty) {
        e.preventDefault();
        // Show custom modal instead of browser confirm
        setPendingCloseAction(() => () => {
          setIsOpen(false);
          const hasQuery = (search ?? "").length > 0;
          if (hasQuery) setLocation(pathname);
          if (onClose) onClose();
        });
        setShowUnsavedChangesModal(true);
      }
    };

    if (isOpen) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isDirty, isEditMode, handleOpenChange]);

  // Reset team selection when segment changes (unless in edit mode)

  useEffect(() => {

    if (!isEditMode && currentSegmentId) {

      // Check if the currently selected team is still valid for the new segment

      const currentTeamId = form.getValues('teamId');

      if (currentTeamId && currentTeamId !== 'none') {

        const currentTeam = teams.find(team => team.id === currentTeamId);

        if (!currentTeam || currentTeam.segment !== currentSegmentName) {

          // Reset team selection if the current team is not in the new segment

          form.setValue('teamId', 'none');

        }

      }

    }

  }, [currentSegmentId, currentSegmentName, teams, form, isEditMode]);



  // Prevent form state corruption by stabilizing the form

  useEffect(() => {

    if (isOpen && !isEditMode) {

      // Ensure form is properly initialized for new projects but preserve any existing segment selection

      const preservedSegmentId = form.getValues('segmentId') || '';

      form.reset({

        name: "",

        companyId: "none",

        contactPerson: "",

        contactPhone: "",

        contactEmail: "",

        startDate: "",

        endDate: "",

        segmentId: preservedSegmentId, // Preserve segment selection

        teamId: "none",

        budget: "",

        status: "planning",

      });

    }

  }, [isOpen, isEditMode, form]);



  // Fetch existing billing items (milestones) for this project in edit mode - same
  // endpoint/shape as client/src/pages/project-detail.tsx uses.

  const { data: existingMilestones = [], isLoading: milestonesLoading, error: milestonesError } = useQuery<any[]>({

    queryKey: ['/api/projects', project?.id, 'milestones'],

    queryFn: async () => {

      if (!project?.id) return [];

      const res = await fetch(`/api/projects/${project.id}/milestones`, { credentials: 'include', cache: 'no-store' });

      if (!res.ok) {

        return [];

      }

      return res.json();

    },

    enabled: isEditMode && isOpen && !!project?.id,

  });

  // Track when all data loading is complete
  useEffect(() => {
    if (isEditMode && project) {
      if (!milestonesLoading && !dataLoadingComplete) {
        setDataLoadingComplete(true);
      }
    } else if (!isEditMode) {
      setDataLoadingComplete(true);
    }
  }, [isEditMode, project, milestonesLoading, dataLoadingComplete]);

  // Track when data processing is complete
  useEffect(() => {
    if (isEditMode && dataLoadingComplete && !dataProcessingComplete) {
      // Set a timeout to allow all data processing useEffects to complete
      const timer = setTimeout(() => {
        console.log('Data processing complete, setting dataProcessingComplete to true');
        setDataProcessingComplete(true);
      }, 100); // Small delay to ensure all useEffects have run
      
      return () => clearTimeout(timer);
    } else if (!isEditMode && !dataProcessingComplete) {
      setDataProcessingComplete(true);
    }
  }, [isEditMode, dataLoadingComplete, dataProcessingComplete]);

  // Load existing billing items (milestones) into flat state when editing
  useEffect(() => {
    if (isEditMode && dataLoadingComplete && !isDataLoaded) {
      const formatted = existingMilestones.map((item: any) => ({
        id: item.id,
        name: item.name || '',
        description: item.description || '',
        feeAmount: item.feeAmount !== undefined && item.feeAmount !== null ? String(item.feeAmount) : '',
        expectedInvoiceDate: item.expectedInvoiceDate ? new Date(item.expectedInvoiceDate).toISOString().slice(0, 10) : '',
        expectedCollectionDate: item.expectedCollectionDate ? new Date(item.expectedCollectionDate).toISOString().slice(0, 10) : '',
        billingStatus: item.billingStatus || 'none',
      }));
      setMilestones(formatted);

      // Auto-calculate contract amount from billing item fees when editing
      const totalAmount = formatted.reduce((total, item) => {
        const cleanValue = (item.feeAmount || '0').replace(/,/g, '');
        const fee = parseFloat(cleanValue) || 0;
        return total + fee;
      }, 0);
      const formattedAmount = totalAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      form.setValue('budget', formattedAmount, { shouldValidate: true });
    }
  }, [isEditMode, existingMilestones, isDataLoaded, dataLoadingComplete]);

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



  const createProjectMutation = useMutation({

    mutationFn: async (data: CreateProjectData) => {

      const payload = {

        ...data,

        budget: data.budget ? Number(data.budget.replace(/,/g, '')) : undefined,

        startDate: data.startDate ? new Date(data.startDate as string) : undefined,

        endDate: data.endDate ? new Date(data.endDate as string) : undefined,

        teamId: data.teamId === "none" ? undefined : data.teamId || undefined,

        managerId: (data as any).managerId || undefined,

        companyId: data.companyId === "none" ? undefined : data.companyId || undefined,

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

  // Helper function to validate and format dates for billing-item payloads
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
      return date;
    } catch (error) {
      console.warn('Error formatting date:', dateValue, error);
      return undefined;
    }
  };

  const formatNumber = (numValue: any) => {
    if (numValue === undefined || numValue === null || numValue === '') {
      return undefined;
    }
    try {
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

  const addMilestone = () => {
    const newMilestone: NewMilestoneRow = {
      name: '',
      description: '',
      feeAmount: '',
      expectedInvoiceDate: '',
      expectedCollectionDate: '',
      billingStatus: 'none',
    };
    setMilestones([...milestones, newMilestone]);
  };

  const removeMilestone = (index: number) => {
    const milestone = milestones[index];
    if (milestone && milestone.id) {
      setDeletedMilestones(prev => [...prev, milestone.id as string]);
    }
    const newMilestones = milestones.filter((_, i) => i !== index);
    setMilestones(newMilestones);
  };

  const updateMilestone = (index: number, field: string, value: any) => {
    const newMilestones = [...milestones];
    newMilestones[index] = {
      ...newMilestones[index],
      [field]: value
    };

    if (field === 'expectedInvoiceDate' && value) {
      const invoiceDate = new Date(value);
      const collectionDate = new Date(invoiceDate);
      collectionDate.setDate(collectionDate.getDate() + 30);
      newMilestones[index] = {
        ...newMilestones[index],
        expectedCollectionDate: collectionDate.toISOString().split('T')[0]
      };
    }

    setMilestones(newMilestones);

    if (field === 'feeAmount') {
      const totalAmount = newMilestones.reduce((total, milestone) => {
        const cleanValue = (milestone.feeAmount || '0').replace(/,/g, '');
        const fee = parseFloat(cleanValue) || 0;
        return total + fee;
      }, 0);
      const formattedAmount = totalAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      form.setValue('budget', formattedAmount, { shouldValidate: true });
    }
  };

  const deleteMilestones = async (milestoneIds: string[]) => {
    for (const milestoneId of milestoneIds) {
      try {
        await apiRequest('DELETE', `/api/milestones/${milestoneId}`);
      } catch (error) {
        console.error(`Failed to delete milestone ${milestoneId}:`, error);
      }
    }
  };

  const saveBillingItems = async (projectId: string) => {
    if (deletedMilestones.length > 0) {
      await deleteMilestones(deletedMilestones);
    }

    const rows = milestones.filter(m => m.name && m.name.trim().length > 0);
    setMilestoneProgress({ current: 0, total: rows.length, message: 'Saving billing items...' });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setMilestoneProgress({ current: i + 1, total: rows.length, message: `Saving billing item ${i + 1}/${rows.length}...` });

      const payload = cleanPayload({
        name: row.name.trim(),
        description: row.description || undefined,
        feeAmount: formatNumber(row.feeAmount),
        expectedInvoiceDate: formatDate(row.expectedInvoiceDate),
        expectedCollectionDate: formatDate(row.expectedCollectionDate),
        billingStatus: row.billingStatus || 'none',
      });

      if (row.id) {
        await apiRequest('PUT', `/api/milestones/${row.id}`, payload);
      } else {
        await apiRequest('POST', `/api/projects/${projectId}/milestones`, payload);
      }
    }
  };

  const onSubmit = async (data: CreateProjectData) => {
    setIsProcessingMilestones(true);
    setMilestoneProgress({ current: 0, total: 0, message: 'Saving project...' });

    const ok = await form.trigger(undefined, { shouldFocus: true });
    if (!ok) {
      setIsProcessingMilestones(false);
      setMilestoneProgress({ current: 0, total: 0, message: '' });
      scrollToFirstError(form.formState.errors);
      toast({
        title: 'Form Validation Error',
        description: 'Please fix the form errors before submitting.',
        variant: 'destructive'
      });
      return;
    }

    const invalidRow = milestones.find(m => !m.name || m.name.trim().length === 0);
    if (invalidRow) {
      setIsProcessingMilestones(false);
      setMilestoneProgress({ current: 0, total: 0, message: '' });
      toast({
        title: 'Validation Error',
        description: 'Each billing item needs a name.',
        variant: 'destructive'
      });
      return;
    }

    createProjectMutation.mutate(data, {
      onSuccess: async (savedProject) => {
        try {
          await saveBillingItems(savedProject.id);

          setDeletedMilestones([]);
          setInitialComplexData(null);
          setIsFormDirty(false);
          setHasComplexDataChanges(false);

          queryClient.invalidateQueries({ queryKey: ['/api/projects', savedProject.id, 'milestones'] });
          queryClient.invalidateQueries({ queryKey: ['/api/projects', savedProject.id, 'gantt'] });

          setIsOpen(false);
          form.reset();
          if (onClose) onClose();
          toast({
            title: "Success",
            description: isEditMode ? "Project updated successfully" : "Project created successfully",
          });
        } catch (error) {
          console.error('Error saving billing items:', error);
          toast({
            title: "Warning",
            description: "Project saved but billing items failed to save. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsProcessingMilestones(false);
          setMilestoneProgress({ current: 0, total: 0, message: '' });
        }
      },
      onError: (error) => {
        console.error('Project mutation failed:', error);
        setIsProcessingMilestones(false);
        setMilestoneProgress({ current: 0, total: 0, message: '' });
      }
    });
  };

  const handleSaveAndClose = useCallback(async () => {
    setShowUnsavedChangesModal(false);
    try {
      await form.handleSubmit(onSubmit)();
    } catch (error) {
      console.error('Error saving before close:', error);
      toast({
        title: 'Error',
        description: 'Failed to save changes. Please try again.',
        variant: 'destructive'
      });
    }
  }, [form, onSubmit, toast]);

  const handleCancel = () => {
    if (isDirty) {
      setPendingCloseAction(() => () => {
        setIsOpen(false);
        if (onClose) onClose();
      });
      setShowUnsavedChangesModal(true);
      return;
    }
    setIsOpen(false);
    if (onClose) onClose();
  };

  const canCreateProject = (user?.role === 'admin' || user?.role === 'manager');

  if (!canCreateProject) {
    return null;
  }

  const handleInputChange = (field: string, value: any) => {
    form.setValue(field as any, value, { shouldValidate: true, shouldDirty: true });
  };

  const handleInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  const handleTextareaFocus = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    event.target.select();
  };

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

          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FolderOpen className="h-4 w-4" />
            </div>
            {isEditMode ? 'Edit Project' : 'Create New Project'}
            {isDirty && (
              <span className="text-sm font-normal text-orange-600 bg-orange-100 px-2 py-1 rounded-md">
                Unsaved changes
              </span>
            )}
          </DialogTitle>

          <DialogDescription>

            {isEditMode ? 'Update project details.' : 'Create a new project to organize tasks and track progress.'}

          </DialogDescription>

        </DialogHeader>



        <Form {...form}>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">



            {/* Basic Project Information Section */}

            <div className="space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <FormField

                  control={form.control}

                  name="name"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">Project Title *</FormLabel>

                      <FormControl>

                        <Input 

                          placeholder="Enter project title"

                          className="h-11"

                          {...field}

                          data-testid="input-project-title"

                          onFocus={handleInputFocus}

                        />

                      </FormControl>

                      <FormMessage />

                    </FormItem>

                  )}

                />



                <FormField

                  control={form.control}

                  name="companyId"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">Company</FormLabel>

                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          const company = companies.find((c: any) => c.id === value);
                          if (company) {
                            if (company.primaryContactName) form.setValue("contactPerson", company.primaryContactName);
                            if (company.primaryContactEmail) form.setValue("contactEmail", company.primaryContactEmail);
                            if (company.primaryContactPhone) form.setValue("contactPhone", company.primaryContactPhone);
                          }
                        }}
                        value={field.value || "none"}
                      >

                        <FormControl>

                          <SelectTrigger className="h-11" data-testid="select-project-company">

                            <SelectValue placeholder="Select a company (optional)" />

                          </SelectTrigger>

                        </FormControl>

                        <SelectContent>

                          <SelectItem value="none">No company linked</SelectItem>

                          {companies.map((c: any) => (

                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>

                          ))}

                        </SelectContent>

                      </Select>

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

                  name="segmentId"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel className="text-sm font-medium text-gray-700">Sector *</FormLabel>

                      <Select

                        onValueChange={field.onChange}

                        value={field.value || ''}

                      >

                        <FormControl>

                          <SelectTrigger className="h-11" data-testid="select-project-segment">

                            <SelectValue placeholder="Select sector" />

                          </SelectTrigger>

                        </FormControl>

                        <SelectContent>

                          {segments.map((seg: any) => (

                            <SelectItem key={seg.id} value={seg.id}>{seg.name}</SelectItem>

                          ))}

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

                              No teams available for {segments.find((s: any) => s.id === currentSegmentId)?.name || 'this'} segment

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

                      <FormLabel className="text-sm font-medium text-gray-700">Start Date *</FormLabel>

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

                      <FormLabel className="text-sm font-medium text-gray-700">End Date *</FormLabel>

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



            {/* Billing Items (Milestones) Section - flat, backed by the billing_items table */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-3 bg-primary rounded-xl">
                    <Clock className="h-7 w-7 text-primary-foreground" />
                  </div>
                  Billing Items
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMilestone}
                  className="text-primary border-primary hover:bg-gray-50 transition-all duration-200 shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Billing Item
                </Button>
              </div>

              {milestones.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <FolderOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-600 mb-2">No billing items added yet</p>
                  <p className="text-sm text-gray-500">Click "Add Billing Item" to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {milestones.map((milestone, index) => (
                    <div key={milestone.id || `new-${index}`} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Billing Item {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMilestone(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Name *</label>
                          <Input
                            value={milestone.name}
                            onChange={(e) => updateMilestone(index, 'name', e.target.value)}
                            onFocus={handleInputFocus}
                            placeholder="e.g. Phase 1 Deployment"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Fee Amount</label>
                          <Input
                            value={milestone.feeAmount || ''}
                            onChange={(e) => updateMilestone(index, 'feeAmount', e.target.value)}
                            onFocus={handleInputFocus}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                        <Textarea
                          value={milestone.description || ''}
                          onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                          onFocus={handleTextareaFocus}
                          rows={2}
                          placeholder="Optional description"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Billing Status</label>
                          <Select
                            value={milestone.billingStatus || 'none'}
                            onValueChange={(value) => updateMilestone(index, 'billingStatus', value)}
                          >
                            <SelectTrigger>
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
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Expected Invoice Date</label>
                          <Input
                            type="date"
                            value={milestone.expectedInvoiceDate || ''}
                            onChange={(e) => updateMilestone(index, 'expectedInvoiceDate', e.target.value)}
                            onFocus={handleInputFocus}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Expected Collection Date</label>
                          <Input
                            type="date"
                            value={milestone.expectedCollectionDate || ''}
                            onChange={(e) => updateMilestone(index, 'expectedCollectionDate', e.target.value)}
                            onFocus={handleInputFocus}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>








            {/* Progress indicator for milestone processing */}

            {isProcessingMilestones && (

              <div className="pt-4 border-t border-gray-200">

                <div className="flex items-center space-x-3 mb-3">

                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>

                  <span className="text-sm font-medium text-gray-700">

                    {milestoneProgress.message}

                  </span>

                </div>

                <div className="w-full bg-gray-200 rounded-full h-2">

                  <div 

                    className="bg-primary h-2 rounded-full transition-all duration-300"

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

                variant={isDirty ? "destructive" : "outline"}

                onClick={handleCancel}

                disabled={isProcessingMilestones}

                data-testid="button-cancel-project"

              >

                {isDirty ? 'Discard Changes' : 'Cancel'}

              </Button>

              <Button 

                type="submit" 

                disabled={createProjectMutation.isPending || isProcessingMilestones}

                data-testid="button-submit-project"

                onClick={() => console.log('Save button clicked')}

                className={isDirty ? "bg-primary hover:bg-primary-dark" : ""}

              >

                {isProcessingMilestones 

                  ? "Processing Milestones..." 

                  : createProjectMutation.isPending 

                    ? (isEditMode ? "Saving..." : "Creating...") 

                    : (isEditMode ? (isDirty ? "Save Changes" : "Save") : "Create Project")

                }

              </Button>

            </div>

          </form>

        </Form>

      </DialogContent>

      {/* Custom Unsaved Changes Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedChangesModal}
        onClose={handleKeepEditing}
        onSave={handleSaveAndClose}
        onDiscard={handleDiscardAndClose}
        isEditMode={isEditMode}
        isSaving={createProjectMutation.isPending || isProcessingMilestones}
      />

    </Dialog>

  );

}

