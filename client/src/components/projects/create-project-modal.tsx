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
import { Plus, Download, X, CalendarDays, UserCircle2 } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200, "Project name too long"),
  description: z.string().min(1, "Description is required"),
  client: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  teamId: z.string().optional(),
  budget: z.string().optional(),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).optional(),
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
  name: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate?: string;
  dueDate?: string;
  assignedUserId?: string;
  feeAmount?: string;
  errors?: { startDate?: string; dueDate?: string; name?: string; feeAmount?: string };
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

  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ['/api/teams'],
    enabled: isOpen, // load when modal opens
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const form = useForm<CreateProjectData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      client: "",
      startDate: "",
      endDate: "",
      teamId: "",
      budget: "",
      status: "planning",
    },
  });

  // Auto-open modal in edit mode and prefill form
  useEffect(() => {
    if (project) {
      setIsOpen(true);
      form.reset({
        name: project.name || "",
        description: project.description || "",
        client: project.client || "",
        startDate: project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : "",
        endDate: project.endDate ? new Date(project.endDate).toISOString().slice(0, 10) : "",
        teamId: project.teamId || "",
        budget: project.budget ? String(project.budget) : "",
        status: project.status || "planning",
      });
    }
  }, [project]);

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

  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/team-members', form.watch('teamId')],
    queryFn: async () => {
      const teamId = form.getValues('teamId');
      if (!teamId) return [];
      const res = await fetch(`/api/teams/${teamId}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.members?.map((m: any) => m.user) ?? [];
    },
    enabled: isOpen && !!form.watch('teamId'),
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
        status: m.status,
        billingStatus: m.billingStatus,
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
        teamId: data.teamId || undefined,
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

  // New function to handle milestone processing with batch processing and retry logic
  const processMilestones = async (validated: any[], project: any, isEditMode: boolean) => {
    const batchSize = 3; // Process 3 milestones at a time
    const maxRetries = 3;
    const results: { milestone: any; success: boolean; error?: string; retries: number }[] = [];
    
    setIsProcessingMilestones(true);
    setMilestoneProgress({ current: 0, total: validated.length, message: 'Starting milestone updates...' });
    
    try {
      // Process milestones in batches
      for (let i = 0; i < validated.length; i += batchSize) {
        const batch = validated.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(validated.length / batchSize);
        
        setMilestoneProgress({ 
          current: i, 
          total: validated.length, 
          message: `Processing batch ${batchNumber}/${totalBatches}...` 
        });
        
        // Process each milestone in the current batch
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
              };

              if (isEditMode && (t as any).id) {
                // Update existing milestone
                await apiRequest('PUT', `/api/tasks/${(t as any).id}`, payload);
              } else {
                // Create new milestone
                await apiRequest('POST', '/api/tasks', payload);
              }
              
              success = true;
            } catch (e: any) {
              retries++;
              error = e?.message || 'Unknown error';
              
              if (retries < maxRetries) {
                // Wait a bit before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
              }
            }
          }
          
          return { milestone: t, success, error, retries };
        });
        
        // Wait for all milestones in the current batch to complete
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches to avoid overwhelming the server
        if (i + batchSize < validated.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Process deletion of removed milestones in edit mode
      if (isEditMode && existingMilestones.length > 0) {
        const currentMilestoneIds = validated.map((t: any) => t.id).filter(Boolean);
        const milestonesToDelete = existingMilestones.filter((m: any) => 
          !currentMilestoneIds.includes(m.id)
        );
        
        if (milestonesToDelete.length > 0) {
          console.log(`🗑️ Processing ${milestonesToDelete.length} milestones for deletion`);
          
          for (const milestone of milestonesToDelete) {
            try {
              await apiRequest('DELETE', `/api/tasks/${milestone.id}`);
              console.log(`✅ Deleted milestone: ${milestone.name}`);
            } catch (e: any) {
              console.error('Failed to delete milestone:', e);
              toast({ title: 'Warning', description: `Failed to delete milestone: ${milestone.name}`, variant: 'destructive' });
            }
          }
        }
      }
      
      // Generate comprehensive results report
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      // Show detailed results to user
      if (failed.length === 0) {
        toast({
          title: 'Success',
          description: `All ${successful.length} milestones processed successfully!`,
        });
      } else if (failed.length < successful.length) {
        // Partial success
        toast({
          title: 'Partial Success',
          description: `${successful.length} milestones updated, ${failed.length} failed.`,
          variant: 'default',
        });
      } else {
        // Mostly failed
        toast({
          title: 'Update Failed',
          description: `${failed.length} out of ${results.length} milestones failed to update. Please try again.`,
          variant: 'destructive',
        });
      }
      
      // Invalidate queries to refresh data
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
      setMilestoneProgress({ current: 0, total: 0, message: '' });
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-create-project">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Project' : 'Create New Project'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update project details.' : 'Create a new project to organize tasks and track progress.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter project name" 
                        {...field} 
                        data-testid="input-project-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="client"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Client name (optional)" 
                        {...field} 
                        data-testid="input-project-client"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the project goals and requirements" 
                      rows={3}
                      {...field} 
                      data-testid="textarea-project-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
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
                    <FormLabel>End Date *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        data-testid="input-project-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="teamId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Team</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} 
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-project-team">
                          <SelectValue placeholder="Select team (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No team assigned</SelectItem>
                        {teams.map((team: any) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        min="0" 
                        step="0.01"
                        {...field} 
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
                      <FormLabel>Project Status</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || 'planning'}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-project-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Milestones Builder */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{isEditMode ? 'Edit Milestones' : 'Create Milestones'}</h4>
                <Button type="button" variant="outline" onClick={() => setTasks((prev) => [...prev, { name: '', description: '', priority: 'medium' } as NewTaskRow])}>
                  <Plus className="h-4 w-4 mr-2" /> Add Milestone
                </Button>
              </div>
              {tasks.length === 0 ? (
                <p className="text-sm text-gray-500">{isEditMode ? 'No milestones found.' : 'No milestones added yet.'}</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((t, idx) => (
                    <div key={idx} className="p-3 border rounded-md space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">Milestone #{idx + 1}</span>
                          {isEditMode && (t as any).id && (
                            <Badge variant="outline" className="text-xs">
                              {(t as any).status} • {(t as any).billingStatus || 'none'}
                            </Badge>
                          )}
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setTasks((prev) => prev.filter((_, i) => i !== idx))}><X className="h-4 w-4" /></Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                                                      <Input placeholder="Milestone name *" value={t.name} onChange={(e) => setTasks((prev)=>{ const c=[...prev]; c[idx] = { ...c[idx], name: e.target.value, errors: { ...c[idx].errors, name: undefined } }; return c; })} />
                          {t.errors?.name && <p className="text-xs text-error mt-1">{t.errors.name}</p>}
                        </div>
                        <Select value={t.priority} onValueChange={(v)=> setTasks((prev)=>{ const c=[...prev]; c[idx] = { ...c[idx], priority: v as NewTaskRow['priority'] }; return c; })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea placeholder="Milestone description" value={t.description || ''} onChange={(e)=> setTasks((prev)=>{ const c=[...prev]; c[idx] = { ...c[idx], description: e.target.value }; return c; })} className="md:col-span-2" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:col-span-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-gray-400" />
                              <Input type="date" value={t.startDate || ''} onChange={(e)=> setTasks((prev)=>{ const c=[...prev]; c[idx] = { ...c[idx], startDate: e.target.value, errors: { ...c[idx].errors, startDate: undefined } }; return c; })} placeholder="Start (optional)" />
                            </div>
                            {t.errors?.startDate && <p className="text-xs text-error">{t.errors.startDate}</p>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-gray-400" />
                              <Input type="date" value={t.dueDate || ''} onChange={(e)=> setTasks((prev)=>{ const c=[...prev]; c[idx] = { ...c[idx], dueDate: e.target.value, errors: { ...c[idx].errors, dueDate: undefined } }; return c; })} placeholder="Deadline *" />
                            </div>
                            {t.errors?.dueDate && <p className="text-xs text-error">{t.errors.dueDate}</p>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Input type="number" min="0" step="0.01" placeholder="Fee amount *" value={t.feeAmount || ''} onChange={(e)=> setTasks((prev)=>{ const c=[...prev]; c[idx] = { ...c[idx], feeAmount: e.target.value, errors: { ...c[idx].errors, feeAmount: undefined } }; return c; })} />
                            </div>
                            {t.errors?.feeAmount && <p className="text-xs text-error">{t.errors.feeAmount}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <UserCircle2 className="h-4 w-4 text-gray-400" />
                            <Select value={t.assignedUserId || 'none'} onValueChange={(v)=> setTasks((prev)=>{ const c=[...prev]; c[idx] = { ...c[idx], assignedUserId: v === 'none' ? undefined : v }; return c; })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Assign to" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Unassigned</SelectItem>
                                {teamMembers.map((m: any) => (
                                  <SelectItem key={m.id} value={m.id}>{m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.email}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
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
