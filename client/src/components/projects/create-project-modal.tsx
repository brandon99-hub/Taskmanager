import { useEffect, useState } from "react";
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
import { Plus, Download, X, CalendarDays, UserCircle2, Users, DollarSign } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";

const createProjectSchema = z.object({
  client: z.string().min(1, "Client name is required").max(200, "Client name too long"),
  contactPerson: z.string().min(1, "Contact person is required").max(200, "Contact person name too long"),
  contactPhone: z.string().min(1, "Contact phone is required").max(50, "Contact phone too long"),
  contactEmail: z.string().email("Invalid contact email").max(200, "Contact email too long"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  segment: z.enum(["academic", "parastals", "private"]).default("private"),
  teamId: z.string().optional().or(z.literal("none")),
  budget: z.string().optional(),
  status: z.enum(["planning", "active", "on_hold", "completed", "on_support", "inactive"]).optional(),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
});

type CreateProjectData = z.infer<typeof createProjectSchema>;

type NewTaskRow = {
  id?: string; // For edit mode
  name: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate?: string;
  dueDate?: string;
  assignedUserId?: string;
  feeAmount?: string;
  expectedInvoiceDate?: string;
  status?: string;
  billingStatus?: string;
  subtasks?: Array<{
    id?: string; // For edit mode
    name: string;
    description?: string;
    status?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    startDate?: string;
    dueDate?: string;
    estimatedHours?: string;
    estimatedDays?: number;
    assignedUserId?: string;
    progressPercent?: number;
  }>;
  errors?: { startDate?: string; dueDate?: string; name?: string; feeAmount?: string; expectedInvoiceDate?: string };
};

export default function CreateProjectModal({ project, onClose }: { project?: any; onClose?: () => void }) {
  const auth = useAuth() as any;
  const { user } = auth;
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(!!project);
  const [pathname, setLocation] = useLocation();
  const search = useSearch();
  const [tasks, setTasks] = useState<NewTaskRow[]>([]);
  const [isProcessingMilestones, setIsProcessingMilestones] = useState(false);
  const [milestoneProgress, setMilestoneProgress] = useState({ current: 0, total: 0, message: '' });
  const isEditMode = !!project;

  const form = useForm<CreateProjectData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      client: "",
      contactPerson: "",
      contactPhone: "",
      contactEmail: "",
      startDate: "",
      endDate: "",
      segment: "private",
      teamId: "none",
      budget: "",
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

  // Auto-open modal in edit mode and prefill form
  useEffect(() => {
    if (project) {
      setIsOpen(true);
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
    }
  }, [project]);

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

  // Fetch existing milestones in edit mode
  const { data: existingMilestones = [] } = useQuery<any[]>({
    queryKey: ['/api/projects', project?.id, 'tasks'],
    queryFn: async () => {
      if (!project?.id) return [];
      const res = await fetch(`/api/projects/${project.id}/tasks`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isEditMode && isOpen && !!project?.id,
  });

  // Fetch team members for the form's selected team (for new projects or when changing teams)
  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/team-members', form.watch('teamId')],
    queryFn: async () => {
      const teamId = form.getValues('teamId');
      if (!teamId || teamId === 'none') return [];
      const res = await fetch(`/api/teams/${teamId}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.members?.map((m: any) => m.user) ?? [];
    },
    enabled: isOpen && !!form.watch('teamId') && form.watch('teamId') !== 'none',
  });

  // Fetch team members for the existing project's team (for edit mode)
  const { data: projectTeamMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/project-team-members', project?.teamId],
    queryFn: async () => {
      if (!project?.teamId) return [];
      const res = await fetch(`/api/teams/${project.teamId}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.members?.map((m: any) => m.user) ?? [];
    },
    enabled: isEditMode && isOpen && !!project?.teamId,
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
        // Include subtasks if they exist
        subtasks: m.subtasks ? m.subtasks.map((subtask: any) => ({
          id: subtask.id,
          name: subtask.name,
          description: subtask.description || '',
          status: subtask.status,
          priority: subtask.priority,
          startDate: subtask.startDate ? new Date(subtask.startDate).toISOString().slice(0, 10) : '',
          dueDate: subtask.dueDate ? new Date(subtask.dueDate).toISOString().slice(0, 10) : '',
          estimatedHours: subtask.estimatedHours ? String(subtask.estimatedHours) : '',
          estimatedDays: subtask.estimatedDays ? String(subtask.estimatedDays) : '',
          assignedUserId: subtask.assignedUserId || undefined,
          progressPercent: subtask.progressPercent || 0
        })) : []
      }));
      setTasks(milestoneTasks);
    }
  }, [isEditMode, existingMilestones]);

  const createProjectMutation = useMutation({
    mutationFn: async (data: CreateProjectData) => {
      const payload = {
        ...data,
        budget: data.budget ? String(data.budget) : undefined,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        teamId: data.teamId === "none" ? undefined : data.teamId || undefined,
        client: data.client || undefined,
      };
      
      // Log payload for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('Sending payload:', payload);
      }
      
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

  const onSubmit = (data: CreateProjectData) => {
    // Client-side validation for task timelines and required fields
    const projectStart = data.startDate ? new Date(data.startDate) : undefined;
    const projectEnd = data.endDate ? new Date(data.endDate) : undefined;

    let hasErrors = false;
    const validated = tasks.map((t) => {
      const errors: NewTaskRow['errors'] = {};
      const start = t.startDate ? new Date(t.startDate) : undefined;
      const due = t.dueDate ? new Date(t.dueDate) : undefined;

      if (!t.name || t.name.trim().length === 0) {
        errors.name = 'Task name is required';
        hasErrors = true;
      }
      if (!due) {
        errors.dueDate = 'Deadline is required';
        hasErrors = true;
      }
      if (start && due && start > due) {
        errors.startDate = 'Start cannot be after deadline';
        hasErrors = true;
      }
      if (projectStart && start && start < projectStart) {
        errors.startDate = 'Start cannot be before project start';
        hasErrors = true;
      }
      if (projectEnd && due && due > projectEnd) {
        errors.dueDate = 'Deadline cannot be after project end';
        hasErrors = true;
      }
      if (!t.feeAmount || isNaN(Number(t.feeAmount))) {
        errors.feeAmount = 'Fee amount is required';
        hasErrors = true;
      }

      return { ...t, errors };
    });
    if (hasErrors) {
      setTasks(validated);
      toast({ title: 'Fix milestone details', description: 'Please resolve the highlighted milestone errors before saving the project.', variant: 'destructive' });
      return;
    }

    createProjectMutation.mutate(data, {
      onSuccess: async (project) => {
        // Handle milestones for both create and edit modes
        if (validated.length > 0) {
          try {
            await processMilestones(validated, project, isEditMode);
          } catch (error) {
            console.error('Error during milestone processing:', error);
            toast({
              title: "Warning",
              description: "Project updated but some milestones failed to process.",
              variant: "destructive",
            });
          }
        }
        
        // Now close the modal and show success
        setIsOpen(false);
        form.reset();
        if (onClose) onClose();
        toast({
          title: "Success",
          description: isEditMode ? "Project updated successfully" : "Project created successfully",
        });
      }
    });
  };

  // New function to detect changes in milestones
  const detectMilestoneChanges = (currentTasks: NewTaskRow[], existingMilestones: any[]) => {
    const changes: { type: 'create' | 'update' | 'delete'; milestone: any; original?: any }[] = [];
    
    // Create a map of existing milestones by ID
    const existingMap = new Map(existingMilestones.map(m => [m.id, m]));
    const currentMap = new Map(currentTasks.filter(t => (t as any).id).map(t => [(t as any).id, t]));
    
    // Check for updates and creations
    currentTasks.forEach(task => {
      if ((task as any).id) {
        // Existing milestone - check for changes
        const existing = existingMap.get((task as any).id);
        if (existing) {
          const hasChanges = 
            task.name !== existing.name ||
            task.description !== (existing.description || '') ||
            task.priority !== existing.priority ||
            task.startDate !== (existing.startDate ? new Date(existing.startDate).toISOString().slice(0, 10) : '') ||
            task.dueDate !== (existing.dueDate ? new Date(existing.dueDate).toISOString().slice(0, 10) : '') ||
            task.assignedUserId !== existing.assignedUserId ||
            task.feeAmount !== String(existing.feeAmount || '') ||
            task.expectedInvoiceDate !== (existing.expectedInvoiceDate ? new Date(existing.expectedInvoiceDate).toISOString().slice(0, 10) : '');
          
          if (hasChanges) {
            changes.push({
              type: 'update',
              milestone: task,
              original: existing
            });
          }
        }
      } else {
        // New milestone
        changes.push({
          type: 'create',
          milestone: task
        });
      }
    });
    
    // Check for deletions
    existingMilestones.forEach(existing => {
      if (!currentMap.has(existing.id)) {
        changes.push({
          type: 'delete',
          milestone: existing
        });
      }
    });
    
    return changes;
  };

  // Enhanced milestone processing with change detection
  const processMilestones = async (validated: any[], project: any, isEditMode: boolean) => {
    if (isEditMode && existingMilestones.length > 0) {
      // Use change detection for better performance
      const changes = detectMilestoneChanges(validated, existingMilestones);
      console.log(`🔄 Processing ${changes.length} changes instead of ${validated.length} total milestones`);
      
      if (changes.length === 0) {
        console.log('✅ No changes detected, skipping milestone processing');
        return;
      }
      
      setIsProcessingMilestones(true);
      setMilestoneProgress({ current: 0, total: changes.length, message: 'Processing milestone changes...' });
      
      const results: { milestone: any; success: boolean; error?: string; retries: number }[] = [];
      
      // Process changes in smaller batches for better performance
      const batchSize = 2;
      for (let i = 0; i < changes.length; i += batchSize) {
        const batch = changes.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(changes.length / batchSize);
        
        setMilestoneProgress({ 
          current: i, 
          total: changes.length, 
          message: `Processing batch ${batchNumber}/${totalBatches}...` 
        });
        
        const batchPromises = batch.map(async (change) => {
          let retries = 0;
          let success = false;
          let error = '';
          
          while (retries < 3 && !success) {
            try {
              if (change.type === 'create') {
                const payload = {
                  name: change.milestone.name,
                  description: change.milestone.description || undefined,
                  priority: change.milestone.priority,
                  projectId: project.id,
                  assignedUserId: change.milestone.assignedUserId || undefined,
                  startDate: change.milestone.startDate ? new Date(change.milestone.startDate).toISOString() : undefined,
                  dueDate: change.milestone.dueDate ? new Date(change.milestone.dueDate).toISOString() : undefined,
                  feeAmount: change.milestone.feeAmount ? Number(change.milestone.feeAmount) : undefined,
                  expectedInvoiceDate: change.milestone.expectedInvoiceDate ? new Date(change.milestone.expectedInvoiceDate).toISOString() : undefined,
                };
                await apiRequest('POST', '/api/tasks', payload);
                console.log(`✅ Created milestone: ${change.milestone.name}`);
              } else if (change.type === 'update') {
                const payload = {
                  name: change.milestone.name,
                  description: change.milestone.description || undefined,
                  priority: change.milestone.priority,
                  assignedUserId: change.milestone.assignedUserId || undefined,
                  startDate: change.milestone.startDate ? new Date(change.milestone.startDate).toISOString() : undefined,
                  dueDate: change.milestone.dueDate ? new Date(change.milestone.dueDate).toISOString() : undefined,
                  feeAmount: change.milestone.feeAmount ? Number(change.milestone.feeAmount) : undefined,
                  expectedInvoiceDate: change.milestone.expectedInvoiceDate ? new Date(change.milestone.expectedInvoiceDate).toISOString() : undefined,
                };
                await apiRequest('PUT', `/api/tasks/${(change.milestone as any).id}`, payload);
                console.log(`✅ Updated milestone: ${change.milestone.name}`);
              } else if (change.type === 'delete') {
                await apiRequest('DELETE', `/api/tasks/${change.milestone.id}`);
                console.log(`✅ Deleted milestone: ${change.milestone.name}`);
              }
              
              success = true;
            } catch (e: any) {
              retries++;
              error = e?.message || 'Unknown error';
              
              if (retries < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
              }
            }
          }
          
          return { milestone: change.milestone, success, error, retries };
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        if (i + batchSize < changes.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      // Generate results report
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      if (failed.length === 0) {
        toast({
          title: 'Success',
          description: `All ${successful.length} milestone changes processed successfully!`,
        });
      } else if (failed.length < successful.length) {
        toast({
          title: 'Partial Success',
          description: `${successful.length} changes processed, ${failed.length} failed.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Update Failed',
          description: `${failed.length} out of ${results.length} changes failed. Please try again.`,
          variant: 'destructive',
        });
      }
      
      setIsProcessingMilestones(false);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
    } else {
      // Original logic for new projects (no change detection needed)
      const batchSize = 3;
      const maxRetries = 3;
      const results: { milestone: any; success: boolean; error?: string; retries: number }[] = [];
      
      setIsProcessingMilestones(true);
      setMilestoneProgress({ current: 0, total: validated.length, message: 'Starting milestone creation...' });
      
      try {
        for (let i = 0; i < validated.length; i += batchSize) {
          const batch = validated.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(validated.length / batchSize);
          
          setMilestoneProgress({ 
            current: i, 
            total: validated.length, 
            message: `Processing batch ${batchNumber}/${totalBatches}...` 
          });
          
          const batchPromises = batch.map(async (t) => {
            let retries = 0;
            let success = false;
            let error = '';
            
            while (retries < maxRetries && !success) {
              try {
                const payload = {
                  name: t.name,
                  description: t.description || undefined,
                  priority: t.priority,
                  projectId: project.id,
                  assignedUserId: t.assignedUserId || undefined,
                  startDate: t.startDate ? new Date(t.startDate).toISOString() : undefined,
                  dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : undefined,
                  feeAmount: t.feeAmount ? Number(t.feeAmount) : undefined,
                  expectedInvoiceDate: t.expectedInvoiceDate ? new Date(t.expectedInvoiceDate).toISOString() : undefined,
                };

                await apiRequest('POST', '/api/tasks', payload);
                success = true;
              } catch (e: any) {
                retries++;
                error = e?.message || 'Unknown error';
                
                if (retries < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                }
              }
            }
            
            return { milestone: t, success, error, retries };
          });
          
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
          
          if (i + batchSize < validated.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        if (failed.length === 0) {
          toast({
            title: 'Success',
            description: `All ${successful.length} milestones created successfully!`,
          });
        } else if (failed.length < successful.length) {
          toast({
            title: 'Partial Success',
            description: `${successful.length} milestones created, ${failed.length} failed.`,
            variant: 'default',
          });
        } else {
          toast({
            title: 'Creation Failed',
            description: `${failed.length} out of ${results.length} milestones failed to create. Please try again.`,
            variant: 'destructive',
          });
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      } catch (error) {
        console.error('Error processing milestones:', error);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred while processing milestones. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsProcessingMilestones(false);
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

  const canCreateProject = (user?.role === 'admin' || user?.role === 'manager');

  if (!canCreateProject) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEditMode ? (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsOpen(true)}
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
                            teams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))
                          )}
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
                          {...field} 
                          data-testid="input-project-start-date"
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
                          {...field} 
                          data-testid="input-project-end-date"
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
                            <SelectItem value="planning">Planning</SelectItem>
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

            {/* Milestones Section */}
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-indigo-600" />
                  {isEditMode ? 'Edit Milestones' : 'Create Milestones'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">Define project milestones and assign team members</p>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-medium text-gray-900">Project Milestones</h4>
                  <p className="text-sm text-gray-600">Define the key deliverables and timeline for your project</p>
                </div>
                <Button 
                  type="button" 
                  variant="default" 
                  onClick={() => setTasks((prev) => [...prev, { name: '', description: '', priority: 'medium' } as NewTaskRow])}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Milestone
                </Button>
              </div>
              {tasks.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <div className="text-gray-400 mb-4">
                    <Plus className="h-16 w-16 mx-auto" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    {isEditMode ? 'No milestones found' : 'No milestones added yet'}
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    {isEditMode ? 'This project doesn\'t have any milestones defined.' : 'Start by adding your first project milestone.'}
                  </p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setTasks((prev) => [...prev, { name: '', description: '', priority: 'medium' } as NewTaskRow])}
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Your First Milestone
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {tasks.map((t, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-6">
                      {/* Milestone Header */}
                      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-blue-700">{idx + 1}</span>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">Milestone #{idx + 1}</h4>
                            {isEditMode && (t as any).id && (
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {(t as any).status}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {(t as any).billingStatus || 'none'}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setTasks((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Basic Milestone Info */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Milestone Name *</label>
                            <Input 
                              placeholder="Enter milestone name" 
                              value={t.name} 
                              onChange={(e) => setTasks((prev)=>{ 
                                const c=[...prev]; 
                                c[idx] = { ...c[idx], name: e.target.value, errors: { ...c[idx].errors, name: undefined } }; 
                                return c; 
                              })} 
                              className="h-11"
                            />
                            {t.errors?.name && <p className="text-xs text-red-600 mt-1">{t.errors.name}</p>}
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                            <Select value={t.priority} onValueChange={(v)=> setTasks((prev)=>{ 
                              const c=[...prev]; 
                              c[idx] = { ...c[idx], priority: v as NewTaskRow['priority'] }; 
                              return c; 
                            })}>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select priority" />
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

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Fee Amount (KSh) *</label>
                            <Input 
                              type="text" 
                              min="0" 
                              placeholder="0.00" 
                              value={t.feeAmount || ''} 
                              onChange={(e)=> {
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
                                
                                setTasks((prev)=>{ 
                                  const c=[...prev]; 
                                  c[idx] = { ...c[idx], feeAmount: formattedValue, errors: { ...c[idx].errors, feeAmount: undefined } }; 
                                  return c; 
                                });
                              }} 
                              className="h-11"
                            />
                            {t.errors?.feeAmount && <p className="text-xs text-red-600 mt-1">{t.errors.feeAmount}</p>}
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                            <Select value={t.assignedUserId || 'none'} onValueChange={(v)=> setTasks((prev)=>{ 
                              const c=[...prev]; 
                              c[idx] = { ...c[idx], assignedUserId: v === 'none' ? undefined : v }; 
                              return c; 
                            })}>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select team member" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  {form.watch('teamId') && form.watch('teamId') !== 'none' 
                                    ? `${getTeamName(form.watch('teamId'))} - Unassigned`
                                    : 'Unassigned'
                                  }
                                </SelectItem>
                                {teamMembers.map((m: any) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    <div className="flex flex-col items-start">
                                      <span className="font-medium">
                                        {m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.email}
                                      </span>
                                      {m.role && (
                                        <span className="text-xs text-gray-500">
                                          {m.role}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {form.watch('teamId') && form.watch('teamId') !== 'none' && (
                              <p className="text-xs text-gray-500 mt-1">
                                💡 Team: {getTeamName(form.watch('teamId'))} • {teamMembers.length} member{teamMembers.length === 1 ? '' : 's'} available
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <Textarea 
                          placeholder="Describe what this milestone involves..." 
                          value={t.description || ''} 
                          onChange={(e)=> setTasks((prev)=>{ 
                            const c=[...prev]; 
                            c[idx] = { ...c[idx], description: e.target.value }; 
                            return c; 
                          })} 
                          rows={3}
                          className="resize-none"
                        />
                      </div>

                      {/* Timeline & Financial */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date (Optional)</label>
                          <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                              type="date" 
                              value={t.startDate || ''} 
                              onChange={(e)=> setTasks((prev)=>{ 
                                const c=[...prev]; 
                                c[idx] = { ...c[idx], startDate: e.target.value, errors: { ...c[idx].errors, startDate: undefined } }; 
                                return c; 
                              })} 
                              className="h-11 pl-10"
                            />
                          </div>
                          {t.errors?.startDate && <p className="text-xs text-red-600 mt-1">{t.errors.startDate}</p>}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Deadline *</label>
                          <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                              type="date" 
                              value={t.dueDate || ''} 
                              onChange={(e)=> setTasks((prev)=>{ 
                                const c=[...prev]; 
                                c[idx] = { ...c[idx], dueDate: e.target.value, errors: { ...c[idx].errors, dueDate: undefined } }; 
                                return c; 
                              })} 
                              className="h-11 pl-10"
                            />
                          </div>
                          {t.errors?.dueDate && <p className="text-xs text-red-600 mt-1">{t.errors.dueDate}</p>}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Expected Invoice Date</label>
                          <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/4 h-4 w-4 text-gray-400" />
                            <Input 
                              type="date" 
                              value={t.expectedInvoiceDate || ''} 
                              onChange={(e)=> setTasks((prev)=>{ 
                                const c=[...prev]; 
                                c[idx] = { ...c[idx], expectedInvoiceDate: e.target.value, errors: { ...c[idx].errors, expectedInvoiceDate: undefined } }; 
                                return c; 
                              })} 
                              className="h-11 pl-10"
                              // Set the min attribute to the deadline date to prevent setting invoice date before deadline
                              min={t.dueDate || undefined}
                              // Set the default month view to the deadline month when calendar opens
                              onFocus={(e) => {
                                if (t.dueDate && !t.expectedInvoiceDate) {
                                  // If there's a deadline but no invoice date, suggest setting it to deadline + 1 day
                                  const deadlineDate = new Date(t.dueDate);
                                  const suggestedInvoiceDate = new Date(deadlineDate);
                                  suggestedInvoiceDate.setDate(deadlineDate.getDate() + 1);
                                  
                                  // Update the task with the suggested invoice date
                                  setTasks((prev) => {
                                    const c = [...prev];
                                    c[idx] = { 
                                      ...c[idx], 
                                      expectedInvoiceDate: suggestedInvoiceDate.toISOString().slice(0, 10),
                                      errors: { ...c[idx].errors, expectedInvoiceDate: undefined }
                                    };
                                    return c;
                                  });
                                }
                              }}
                            />
                          </div>
                          {t.errors?.expectedInvoiceDate && <p className="text-xs text-red-600 mt-1">{t.errors.expectedInvoiceDate}</p>}
                          {t.dueDate && !t.expectedInvoiceDate && (
                            <p className="text-xs text-blue-600 mt-1">
                              💡 Click to set invoice date (suggested: {new Date(t.dueDate).toLocaleDateString()})
                            </p>
                          )}
                          {t.dueDate && t.expectedInvoiceDate && (
                            <p className="text-xs text-green-600 mt-1">
                              ✅ Invoice date set • Collection date: {new Date(t.expectedInvoiceDate).toLocaleDateString()} + 30 days
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Collection Date Note */}
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">Note:</span> Collection date will be automatically calculated as 30 days after the invoice date.
                        </p>
                      </div>

                      {/* Subtasks Section */}
                      <div className="border-t border-gray-200 pt-4">
                        <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                          <div>
                            <h5 className="text-lg font-semibold text-blue-900 mb-1">Subtasks</h5>
                            <p className="text-sm text-blue-700">Break down this milestone into smaller, manageable tasks</p>
                          </div>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const newSubtasks = [...(t.subtasks || []), { 
                                name: '', 
                                description: '', 
                                priority: 'medium' as const,
                                estimatedDays: 0,
                                startDate: '',
                                dueDate: '',
                                assignedUserId: undefined,
                                progressPercent: 0
                              }];
                              setTasks((prev) => {
                                const c = [...prev];
                                c[idx] = { ...c[idx], subtasks: newSubtasks };
                                return c;
                              });
                            }}
                            className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300 hover:bg-blue-50 font-medium"
                          >
                            <Plus className="h-4 w-4 mr-2" /> Add Subtask
                          </Button>
                        </div>

                        {t.subtasks && t.subtasks.length > 0 ? (
                          <div className="space-y-3">
                            {t.subtasks.map((subtask, subtaskIdx) => (
                              <div key={subtaskIdx} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center border-2 border-blue-200">
                                      <span className="text-sm font-semibold text-blue-700">{subtaskIdx + 1}</span>
                                    </div>
                                    <div>
                                      <span className="text-sm font-semibold text-blue-900">Subtask #{subtaskIdx + 1}</span>
                                      <p className="text-xs text-blue-600">Break down this milestone</p>
                                    </div>
                                  </div>
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      const newSubtasks = t.subtasks?.filter((_, i) => i !== subtaskIdx) || [];
                                      setTasks((prev) => {
                                        const c = [...prev];
                                        c[idx] = { ...c[idx], subtasks: newSubtasks };
                                        return c;
                                      });
                                    }}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full p-2"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-blue-900 mb-2">Subtask Name *</label>
                                    <Input 
                                      placeholder="Enter subtask name" 
                                      value={subtask.name} 
                                      onChange={(e) => {
                                        const newSubtasks = [...(t.subtasks || [])];
                                        newSubtasks[subtaskIdx] = { ...newSubtasks[subtaskIdx], name: e.target.value };
                                        setTasks((prev) => {
                                          const c = [...prev];
                                          c[idx] = { ...c[idx], subtasks: newSubtasks };
                                          return c;
                                        });
                                      }}
                                      className="h-10 text-sm border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-semibold text-blue-900 mb-2">Priority</label>
                                    <Select 
                                      value={subtask.priority} 
                                      onValueChange={(v) => {
                                        const newSubtasks = [...(t.subtasks || [])];
                                        newSubtasks[subtaskIdx] = { ...newSubtasks[subtaskIdx], priority: v as 'low' | 'medium' | 'high' | 'critical' };
                                        setTasks((prev) => {
                                          const c = [...prev];
                                          c[idx] = { ...c[idx], subtasks: newSubtasks };
                                          return c;
                                        });
                                      }}
                                    >
                                      <SelectTrigger className="h-10 text-sm border-blue-200 focus:border-blue-400 focus:ring-blue-400">
                                        <SelectValue placeholder="Select priority" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-blue-900 mb-2">Start Date</label>
                                    <Input 
                                      type="date"
                                      value={subtask.startDate ? new Date(subtask.startDate).toISOString().split('T')[0] : ''} 
                                      onChange={(e) => {
                                        const startDate = e.target.value;
                                        const newSubtasks = [...(t.subtasks || [])];
                                        newSubtasks[subtaskIdx] = { ...newSubtasks[subtaskIdx], startDate };
                                        
                                        // Auto-calculate estimated days if both dates are set
                                        if (startDate && subtask.dueDate) {
                                          const start = new Date(startDate);
                                          const due = new Date(subtask.dueDate);
                                          const days = Math.ceil((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                          if (days > 0) {
                                            newSubtasks[subtaskIdx].estimatedDays = days;
                                          }
                                        }
                                        
                                        setTasks((prev) => {
                                          const c = [...prev];
                                          c[idx] = { ...c[idx], subtasks: newSubtasks };
                                          return c;
                                        });
                                      }}
                                      className="h-10 text-sm border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-blue-900 mb-2">Due Date</label>
                                    <Input 
                                      type="date"
                                      value={subtask.dueDate ? new Date(subtask.dueDate).toISOString().split('T')[0] : ''} 
                                      onChange={(e) => {
                                        const dueDate = e.target.value;
                                        const newSubtasks = [...(t.subtasks || [])];
                                        newSubtasks[subtaskIdx] = { ...newSubtasks[subtaskIdx], dueDate };
                                        
                                        // Auto-calculate estimated days if both dates are set
                                        if (subtask.startDate && dueDate) {
                                          const start = new Date(subtask.startDate);
                                          const due = new Date(dueDate);
                                          const days = Math.ceil((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                          if (days > 0) {
                                            newSubtasks[subtaskIdx].estimatedDays = days;
                                          }
                                        }
                                        
                                        setTasks((prev) => {
                                          const c = [...prev];
                                          c[idx] = { ...c[idx], subtasks: newSubtasks };
                                          return c;
                                        });
                                      }}
                                      className="h-10 text-sm border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-blue-900 mb-2">Estimated Days</label>
                                    <Input 
                                      type="number" 
                                      min="1" 
                                      placeholder="Auto-calculated" 
                                      value={subtask.estimatedDays || ''} 
                                      readOnly
                                      className="h-10 text-sm bg-blue-50 text-blue-700 border-blue-200 font-medium"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-blue-900 mb-2">Assigned Employee</label>
                                    {(isEditMode ? projectTeamMembers : teamMembers).length > 0 ? (
                                      <Select 
                                        value={subtask.assignedUserId || ''} 
                                        onValueChange={(v) => {
                                          const newSubtasks = [...(t.subtasks || [])];
                                          newSubtasks[subtaskIdx] = { ...newSubtasks[subtaskIdx], assignedUserId: v || undefined };
                                          setTasks((prev) => {
                                            const c = [...prev];
                                            c[idx] = { ...c[idx], subtasks: newSubtasks };
                                            return c;
                                          });
                                        }}
                                      >
                                        <SelectTrigger className="h-10 text-sm border-blue-200 focus:border-blue-400 focus:ring-blue-400">
                                          <SelectValue placeholder="Select employee" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="">Unassigned</SelectItem>
                                          {(isEditMode ? projectTeamMembers : teamMembers).map((member: any) => (
                                            <SelectItem key={member.id} value={member.id}>
                                              {member.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <div className="h-10 px-3 py-2 text-sm text-gray-500 bg-gray-100 border border-gray-200 rounded-md flex items-center">
                                        <span>{isEditMode ? 'Loading team members...' : 'No team assigned to project'}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-blue-900 mb-2">Description</label>
                                    <Input 
                                      placeholder="Brief description" 
                                      value={subtask.description || ''} 
                                      onChange={(e) => {
                                        const newSubtasks = [...(t.subtasks || [])];
                                        newSubtasks[subtaskIdx] = { ...newSubtasks[subtaskIdx], description: e.target.value };
                                        setTasks((prev) => {
                                          const c = [...prev];
                                          c[idx] = { ...c[idx], subtasks: newSubtasks };
                                          return c;
                                        });
                                      }}
                                      className="h-10 text-sm border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 border-2 border-dashed border-blue-200 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
                            <div className="text-blue-400 mb-3">
                              <Plus className="h-12 w-12 mx-auto" />
                            </div>
                            <p className="text-sm font-medium text-blue-900 mb-1">No subtasks added yet</p>
                            <p className="text-xs text-blue-600">Break down this milestone into smaller, manageable tasks</p>
                          </div>
                        )}
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
                onClick={() => setIsOpen(false)}
                disabled={isProcessingMilestones}
                data-testid="button-cancel-project"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createProjectMutation.isPending || isProcessingMilestones}
                data-testid="button-submit-project"
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
