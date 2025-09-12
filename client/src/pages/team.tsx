import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, Plus, Mail, UserPlus, Calendar, BarChart3, Info, User, Briefcase, RefreshCw } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";


const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100, "Team name too long"),
  description: z.string().optional(),
  segment: z.enum(["academic", "parastals", "private"]).default("private"),
  members: z.array(z.string()).optional(),
  // New fields for enhanced team creation
  bcDevs: z.array(z.string()).min(1, "At least 1 BC Developer is required"),
  consultants: z.array(z.string()).length(2, "Exactly 2 Functional Consultants are required"),
  portalDev: z.string().min(1, "Portal Developer is required"),
  accountManager: z.string().min(1, "Account Manager is required"),
  projectLeader: z.string().min(1, "Project Leader is required"),
  // Credential management
  sendCredentials: z.boolean().default(true),
  financeNotifications: z.boolean().default(true),
  accountManagerNotifications: z.boolean().default(true),
  financeEmail: z.string().email("Invalid finance email").optional(),
  accountManagerEmail: z.string().email("Invalid account manager email").optional(),
});

type CreateTeamData = z.infer<typeof createTeamSchema>;

export default function Team() {
  const auth = useAuth() as any;
  const { user, isAuthenticated, isLoading } = auth;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);

  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [teamQuery, setTeamQuery] = useState<string>("");

  const [isSegmentLeaderModalOpen, setIsSegmentLeaderModalOpen] = useState(false);
  
  // Segment leader form state (now admin role management state)
  const [adminRoleData, setAdminRoleData] = useState({
    academic: { name: 'Academic Leader', email: 'academic.leader@company.com' },
    parastals: { name: 'Parastals Leader', email: 'parastals.leader@company.com' },
    private: { name: 'Private Leader', email: 'private.leader@company.com' },
    projectManager: { name: 'Project Manager', email: 'project.manager@company.com' },
    financeHead: { name: 'Finance Head', email: 'finance.head@company.com' },
    financeEmail: 'finance@company.com',
    accountManagerEmail: 'accountmanager@company.com'
  });

  // Loading state for admin role save
  const [isSavingAdminRoles, setIsSavingAdminRoles] = useState(false);
  // Resend button disabled states
  const [resending, setResending] = useState<Record<string, boolean>>({});

  // Dynamic manager rows per head (staged until Save)
  const [pmManagerRows, setPmManagerRows] = useState<Array<{ name: string; email: string }>>([]);
  const [fhManagerRows, setFhManagerRows] = useState<Array<{ name: string; email: string }>>([]);
  const [segAcManagerRows, setSegAcManagerRows] = useState<Array<{ name: string; email: string }>>([]);
  const [segPaManagerRows, setSegPaManagerRows] = useState<Array<{ name: string; email: string }>>([]);
  const [segPrManagerRows, setSegPrManagerRows] = useState<Array<{ name: string; email: string }>>([]);

  // Fetch finance and account manager emails for auto-fill
  const { data: systemEmails } = useQuery({
    queryKey: ['/api/system-config/emails'],
    queryFn: async () => {
      const res = await fetch('/api/system-config/emails', { 
        credentials: 'include' 
      });
      if (!res.ok) return { financeEmail: '', accountManagerEmail: '' };
      const data = await res.json();
      return data;
    },
    enabled: !!isAuthenticated,
  });
  
  // Fetch admin roles data when modal opens
  const { data: adminRolesData } = useQuery({
    queryKey: ['/api/admin/roles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/roles', { 
        credentials: 'include' 
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!isAuthenticated && isSegmentLeaderModalOpen,
  });

  // Helper: validate email
  const isValidEmail = (email: string | undefined) => !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.includes('@company.com');

  // Helper: does role exist already (or had been sent before)
  const roleExists = (roleType: 'project_manager' | 'finance_head' | 'segment_leader', segment?: 'academic' | 'parastals' | 'private') => {
    if (!adminRolesData) return false;
    if (roleType === 'segment_leader') {
      return !!adminRolesData.find((r: any) => r.roleType === 'segment_leader' && r.segment === segment && r.isActive);
    }
    return !!adminRolesData.find((r: any) => r.roleType === roleType && r.isActive);
  };

  // Resend credentials handler
  const handleResend = async (key: string, params: { roleType: 'project_manager' | 'finance_head' | 'segment_leader'; segment?: 'academic' | 'parastals' | 'private'; email: string | undefined; displayName: string; }) => {
    if (!isValidEmail(params.email)) {
      toast({ title: 'Invalid email', description: `Enter a valid email for ${params.displayName} before resending.`, variant: 'destructive' });
      return;
    }
    if (!roleExists(params.roleType, params.segment)) {
      toast({ title: 'Not yet assigned', description: `Assign ${params.displayName} first, then you can resend credentials.`, variant: 'destructive' });
      return;
    }
    setResending(prev => ({ ...prev, [key]: true }));
    try {
      await apiRequest('POST', '/api/admin/users/resend', {
        email: params.email,
        roleType: params.roleType,
        segment: params.segment,
      });
      toast({ title: 'Credentials re-sent', description: `New temporary password emailed to ${params.email}.` });
    } catch (e: any) {
      toast({ title: 'Resend failed', description: e?.message || 'Failed to resend credentials', variant: 'destructive' });
    } finally {
      // brief cooldown to prevent double send
      setTimeout(() => setResending(prev => ({ ...prev, [key]: false })), 1500);
    }
  };

  // Update form state when data is loaded
  useEffect(() => {
    if (systemEmails) {
      setAdminRoleData(prev => ({
        ...prev,
        financeEmail: systemEmails.financeEmail || prev.financeEmail,
        accountManagerEmail: systemEmails.accountManagerEmail || prev.accountManagerEmail,
      }));
    }
  }, [systemEmails]);

  // Update form state when admin roles data is loaded
  useEffect(() => {
    if (adminRolesData && isSegmentLeaderModalOpen) {
      // Extract segment leaders from admin roles data
      const segmentLeaders = adminRolesData.filter((role: any) => role.roleType === 'segment_leader');
      const projectManager = adminRolesData.find((role: any) => role.roleType === 'project_manager');
      const financeHead = adminRolesData.find((role: any) => role.roleType === 'finance_head');

      setAdminRoleData(prev => ({
        ...prev,
        academic: segmentLeaders.find((s: any) => s.segment === 'academic')?.user ? {
          name: `${segmentLeaders.find((s: any) => s.segment === 'academic')?.user.firstName || ''} ${segmentLeaders.find((s: any) => s.segment === 'academic')?.user.lastName || ''}`.trim(),
          email: segmentLeaders.find((s: any) => s.segment === 'academic')?.user.email || ''
        } : prev.academic,
        parastals: segmentLeaders.find((s: any) => s.segment === 'parastals')?.user ? {
          name: `${segmentLeaders.find((s: any) => s.segment === 'parastals')?.user.firstName || ''} ${segmentLeaders.find((s: any) => s.segment === 'parastals')?.user.lastName || ''}`.trim(),
          email: segmentLeaders.find((s: any) => s.segment === 'parastals')?.user.email || ''
        } : prev.parastals,
        private: segmentLeaders.find((s: any) => s.segment === 'private')?.user ? {
          name: `${segmentLeaders.find((s: any) => s.segment === 'private')?.user.firstName || ''} ${segmentLeaders.find((s: any) => s.segment === 'private')?.user.lastName || ''}`.trim(),
          email: segmentLeaders.find((s: any) => s.segment === 'private')?.user.email || ''
        } : prev.private,
        projectManager: projectManager?.user ? {
          name: `${projectManager.user.firstName || ''} ${projectManager.user.lastName || ''}`.trim(),
          email: projectManager.user.email || ''
        } : prev.projectManager,
        financeHead: financeHead?.user ? {
          name: `${financeHead.user.firstName || ''} ${financeHead.user.lastName || ''}`.trim(),
          email: financeHead.user.email || ''
        } : prev.financeHead,
      }));
    }
  }, [adminRolesData, isSegmentLeaderModalOpen]);
  
  // Search states for each role in team composition
  const [bcDevSearch, setBcDevSearch] = useState("");
  const [consultantSearch, setConsultantSearch] = useState("");
  const [portalDevSearch, setPortalDevSearch] = useState("");
  const [accountManagerSearch, setAccountManagerSearch] = useState("");
  const [projectLeaderSearch, setProjectLeaderSearch] = useState("");

  // Helper function to filter employees by role and search term
  const filterEmployeesByRoleAndSearch = (role: string, searchTerm: string) => {
    // Show all employees since job functions are assigned during team creation
    // The role parameter is used for display purposes only
    const filteredByRole = employees; // Remove role filtering - show all employees
    
    if (!searchTerm.trim()) return filteredByRole;
    
    return filteredByRole.filter((emp: any) => {
      const fullName = emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : '';
      const email = emp.email || '';
      const searchLower = searchTerm.toLowerCase();
      
      return fullName.toLowerCase().includes(searchLower) || 
             email.toLowerCase().includes(searchLower);
    });
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: teams = [], isLoading: teamsLoading, error: teamsError } = useQuery<any[]>({
    queryKey: ['/api/teams'],
    enabled: !!isAuthenticated,
  });


  const { data: employees = [], isLoading: employeesLoading } = useQuery<any[]>({
    queryKey: ['/api/users', 'employee'],
    queryFn: async () => {
      const params = new URLSearchParams({ role: 'employee' });
      const res = await fetch(`/api/users?${params}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: !!isAuthenticated, // Always fetch when authenticated, not just when modal is open
  });

  const { data: workload = [], isLoading: workloadLoading, error: workloadError } = useQuery<any[]>({
    queryKey: ['/api/dashboard/workload'],
    enabled: !!isAuthenticated,
  });



  const handleTeamClick = (team: any) => {
    setLocation(`/teams/${team.id}`);
  };



  const handleSaveAdminRoles = async () => {
    setIsSavingAdminRoles(true);
    try {
      // Validate email addresses first
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validationErrors: string[] = [];

      const rolesConfig = [
        {
          email: adminRoleData.projectManager.email,
          name: adminRoleData.projectManager.name,
          firstName: adminRoleData.projectManager.name.split(' ')[0] || 'Project',
          lastName: adminRoleData.projectManager.name.split(' ').slice(1).join(' ') || 'Manager',
          role: 'project_manager',
          displayName: 'Project Manager'
        },
        {
          email: adminRoleData.financeHead.email,
          name: adminRoleData.financeHead.name,
          firstName: adminRoleData.financeHead.name.split(' ')[0] || 'Finance',
          lastName: adminRoleData.financeHead.name.split(' ').slice(1).join(' ') || 'Head',
          role: 'finance_head',
          displayName: 'Finance Head'
        },
        {
          email: adminRoleData.academic.email,
          name: adminRoleData.academic.name,
          firstName: adminRoleData.academic.name.split(' ')[0] || 'Academic',
          lastName: adminRoleData.academic.name.split(' ').slice(1).join(' ') || 'Leader',
          role: 'segment_leader',
          segment: 'academic',
          displayName: 'Academic Segment Leader'
        },
        {
          email: adminRoleData.parastals.email,
          name: adminRoleData.parastals.name,
          firstName: adminRoleData.parastals.name.split(' ')[0] || 'Parastals',
          lastName: adminRoleData.parastals.name.split(' ').slice(1).join(' ') || 'Leader',
          role: 'segment_leader',
          segment: 'parastals',
          displayName: 'Parastals Segment Leader'
        },
        {
          email: adminRoleData.private.email,
          name: adminRoleData.private.name,
          firstName: adminRoleData.private.name.split(' ')[0] || 'Private',
          lastName: adminRoleData.private.name.split(' ').slice(1).join(' ') || 'Leader',
          role: 'segment_leader',
          segment: 'private',
          displayName: 'Private Segment Leader'
        }
      ];

      // Validate emails and names
      rolesConfig.forEach(config => {
        // Skip validation for placeholder emails
        if (config.email.includes('@company.com')) {
          return;
        }
        
        if (config.email && !emailRegex.test(config.email)) {
          validationErrors.push(`${config.displayName}: Invalid email format`);
        }
        
        if (config.email && (!config.name || config.name.trim().length < 2)) {
          validationErrors.push(`${config.displayName}: Name is required when email is provided`);
        }
      });

      // If validation fails, show errors and don't close modal
      if (validationErrors.length > 0) {
        toast({
          title: "Validation Error",
          description: validationErrors.join('; '),
          variant: "destructive",
        });
        return; // Don't close modal, don't proceed
      }

      // Track results for detailed feedback
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      const updated: { displayName: string; oldEmail: string; newEmail: string }[] = [];
      const assigned: { displayName: string; email: string }[] = [];
      const unchanged: { displayName: string; email: string }[] = [];

      // Build map of existing assignments (from loaded adminRolesData)
      const currentAssignments: Record<string, string | undefined> = {};
      if (adminRolesData) {
        const pm = adminRolesData.find((r: any) => r.roleType === 'project_manager');
        const fh = adminRolesData.find((r: any) => r.roleType === 'finance_head');
        const segA = adminRolesData.find((r: any) => r.roleType === 'segment_leader' && r.segment === 'academic');
        const segP = adminRolesData.find((r: any) => r.roleType === 'segment_leader' && r.segment === 'parastals');
        const segPr = adminRolesData.find((r: any) => r.roleType === 'segment_leader' && r.segment === 'private');
        currentAssignments['Project Manager'] = pm?.user?.email;
        currentAssignments['Finance Head'] = fh?.user?.email;
        currentAssignments['Academic Segment Leader'] = segA?.user?.email;
        currentAssignments['Parastals Segment Leader'] = segP?.user?.email;
        currentAssignments['Private Segment Leader'] = segPr?.user?.email;
      }

      // Create users with admin roles - this will trigger credential emails (only for new users)
      for (const roleConfig of rolesConfig) {
        try {
          // Skip if email is empty or default placeholder
          if (!roleConfig.email || 
              roleConfig.email.includes('@company.com') || 
              roleConfig.email.includes('@') === false) {
            continue;
          }

          // Change detection: find current assigned email for this head
          const prev = currentAssignments[roleConfig.displayName];
          const isSameEmail = prev && prev.toLowerCase() === roleConfig.email.toLowerCase();

          const response = await apiRequest('POST', '/api/admin/users', {
            email: roleConfig.email,
            firstName: roleConfig.firstName,
            lastName: roleConfig.lastName,
            role: roleConfig.role,
            segment: roleConfig.segment
          });

          if (response.ok) {
            successCount++;
            if (isSameEmail) {
              // Name-only change
              unchanged.push({ displayName: roleConfig.displayName, email: roleConfig.email });
            } else if (prev && prev !== roleConfig.email) {
              updated.push({ displayName: roleConfig.displayName, oldEmail: prev, newEmail: roleConfig.email });
            } else {
              assigned.push({ displayName: roleConfig.displayName, email: roleConfig.email });
            }
          }
        } catch (error: any) {
          errorCount++;
          errors.push(`${roleConfig.displayName}: ${error?.message || 'Unknown error'}`);
          console.error(`Error creating/updating user for ${roleConfig.displayName}:`, error);
        }
      }

      // Save segment leaders to database (backward compatibility)
      try {
        const segmentResponse = await fetch('/api/segment-leaders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            academic: adminRoleData.academic,
            parastals: adminRoleData.parastals,
            private: adminRoleData.private,
            financeEmail: adminRoleData.financeEmail,
            accountManagerEmail: adminRoleData.accountManagerEmail
          })
        });

        if (!segmentResponse.ok) {
          throw new Error('Failed to save segment leaders');
        }
      } catch (error) {
        console.error('Error saving segment leaders:', error);
        errors.push('Failed to save segment leader configuration');
        errorCount++;
      }

      // Save managers in batches per head (auto-sends credentials server-side)
      const addRows = async (headId: string | undefined, rows: Array<{ name: string; email: string }>, label: string) => {
        if (!headId || !rows.length) return;
        const payload = rows
          .filter(r => r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
          .map(r => {
            const name = (r.name || '').trim();
            const [firstName, ...rest] = name ? name.split(' ') : [r.email.split('@')[0]];
            return { email: r.email.trim(), firstName, lastName: rest.join(' ') };
          });
        if (!payload.length) return;
        const res = await apiRequest('POST', `/api/admin/roles/${headId}/managers`, { managers: payload });
        if (!res.ok) {
          const txt = await res.clone().text();
          throw new Error(`${label}: ${txt || res.statusText}`);
        }
      };

      try {
        await addRows(adminRolesData?.find((r:any)=>r.roleType==='project_manager')?.id, pmManagerRows, 'Project Manager managers');
        await addRows(adminRolesData?.find((r:any)=>r.roleType==='finance_head')?.id, fhManagerRows, 'Finance Head managers');
        await addRows(adminRolesData?.find((r:any)=>r.roleType==='segment_leader' && r.segment==='academic')?.id, segAcManagerRows, 'Academic segment managers');
        await addRows(adminRolesData?.find((r:any)=>r.roleType==='segment_leader' && r.segment==='parastals')?.id, segPaManagerRows, 'Parastals segment managers');
        await addRows(adminRolesData?.find((r:any)=>r.roleType==='segment_leader' && r.segment==='private')?.id, segPrManagerRows, 'Private segment managers');
      } catch (e:any) {
        errorCount++;
        errors.push(e?.message || 'Failed to save managers');
      }

      // Show appropriate feedback
      if (errorCount === 0) {
        const lines: string[] = [];
        if (updated.length) {
          lines.push(`Updated: ${updated.map(u => `${u.displayName}: ${u.oldEmail} → ${u.newEmail}`).join('; ')}`);
        }
        if (assigned.length) {
          lines.push(`Assigned: ${assigned.map(a => `${a.displayName} → ${a.email}`).join('; ')}`);
        }
        if (unchanged.length) {
          lines.push(`Unchanged (already assigned): ${unchanged.map(u => `${u.displayName} → ${u.email}`).join('; ')}`);
        }
        if (pmManagerRows.length + fhManagerRows.length + segAcManagerRows.length + segPaManagerRows.length + segPrManagerRows.length > 0) {
          lines.push('Managers added and credentials sent.');
        }
        toast({ title: 'Admin roles saved', description: lines.join(' | ') });
        setIsSegmentLeaderModalOpen(false);
        // Clear staged rows after success
        setPmManagerRows([]);
        setFhManagerRows([]);
        setSegAcManagerRows([]);
        setSegPaManagerRows([]);
        setSegPrManagerRows([]);
      } else if (successCount > 0) {
        const parts: string[] = [];
        if (updated.length) parts.push(`Updated: ${updated.map(u => `${u.displayName}: ${u.oldEmail} → ${u.newEmail}`).join('; ')}`);
        if (assigned.length) parts.push(`Assigned: ${assigned.map(a => `${a.displayName} → ${a.email}`).join('; ')}`);
        if (unchanged.length) parts.push(`Unchanged: ${unchanged.map(u => `${u.displayName} → ${u.email}`).join('; ')}`);
        parts.push(`Errors: ${errors.join(', ')}`);
        toast({
          title: "Partial update",
          description: parts.join('\n'),
          variant: "default",
        });
        console.error('Admin role assignment errors:', errors);
        // Don't close modal on partial success so user can review and retry
      } else {
        throw new Error(`All operations failed: ${errors.join(', ')}`);
      }
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/segment-leaders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system-config/emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles'] });
    } catch (error) {
      console.error('Error saving admin roles:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save admin roles",
        variant: "destructive",
      });
      // Don't close modal on error
    } finally {
      setIsSavingAdminRoles(false);
    }
  };

  const handleCancelAdminRoles = () => {
    setIsSegmentLeaderModalOpen(false);
    // Reset form data to original values if needed
  };

  useEffect(() => {
    const errors = [teamsError, workloadError].filter(Boolean);
    errors.forEach(error => {
      if (error && isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
      }
    });
  }, [teamsError, workloadError, toast]);

  const form = useForm<CreateTeamData>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: "",
      description: "",
      segment: "private",
      bcDevs: [],
      consultants: [],
      portalDev: "",
      accountManager: "",
      projectLeader: "",
      sendCredentials: true,
      financeNotifications: true,
      accountManagerNotifications: true,
      financeEmail: "",
      accountManagerEmail: "",
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: CreateTeamData) => {
      const response = await apiRequest("POST", "/api/teams", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setIsCreateTeamOpen(false);
      form.reset();

      toast({
        title: "Success",
        description: "Team created successfully",
      });
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
      toast({
        title: "Error",
        description: "Failed to create team",
        variant: "destructive",
      });
    },
  });

  // Auto-fill finance and account manager emails when modal opens
  useEffect(() => {
    if (isCreateTeamOpen && systemEmails) {
      form.setValue('financeEmail', systemEmails.financeEmail || '');
      form.setValue('accountManagerEmail', systemEmails.accountManagerEmail || '');
    }
  }, [isCreateTeamOpen, systemEmails, form]);

  // Auto-fill segment leader emails when system emails are loaded
  useEffect(() => {
    if (systemEmails) {
      // console.debug('Updating segment leader data with system emails:', systemEmails);
      setAdminRoleData(prev => ({
        ...prev,
        financeEmail: systemEmails.financeEmail || 'finance@company.com',
        accountManagerEmail: systemEmails.accountManagerEmail || 'accountmanager@company.com'
      }));
    }
  }, [systemEmails]);

  // Fetch teams and workload data

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const onSubmit = (data: CreateTeamData) => {
    // Combine all selected members from different roles
    const allMembers = [
      ...data.bcDevs,
      ...data.consultants,
      data.portalDev,
      data.accountManager,
      data.projectLeader !== 'segment_leader' ? data.projectLeader : null
    ].filter(Boolean) as string[];

    // Use only the role-based members
    const finalMembers = allMembers;
    
    // Create the final payload
    const payload = {
      ...data,
      members: finalMembers,
      // Store role-specific assignments
      roleAssignments: {
        bcDevs: data.bcDevs,
        consultants: data.consultants,
        portalDev: data.portalDev,
        accountManager: data.accountManager,
        projectLeader: data.projectLeader
      },
      // Store notification preferences
      notifications: {
        sendCredentials: data.sendCredentials,
        financeNotifications: data.financeNotifications,
        accountManagerNotifications: data.accountManagerNotifications,
        financeEmail: data.financeEmail,
        accountManagerEmail: data.accountManagerEmail
      }
    };

    createTeamMutation.mutate(payload);
  };

  // Function to clear all search terms
  const clearAllSearches = () => {
    setBcDevSearch("");
    setConsultantSearch("");
    setPortalDevSearch("");
    setAccountManagerSearch("");
    setProjectLeaderSearch("");
  };

  // Clear searches when modal is closed
  const handleCloseModal = () => {
    setIsCreateTeamOpen(false);
    clearAllSearches();
    form.reset();

  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background-page">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h2 className="text-3xl font-medium text-gray-900 mb-2" data-testid="text-title">Team Management</h2>
            <p className="text-gray-600" data-testid="text-subtitle">Manage teams and monitor member workloads</p>
          </div>
          <div className="flex space-x-3 mt-4 md:mt-0">
            {user?.role !== 'employee' ? (
              <>
                <Dialog open={isCreateTeamOpen} onOpenChange={(open) => {
          if (!open) {
            handleCloseModal();
          } else {
            setIsCreateTeamOpen(true);
          }
        }}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary-dark" data-testid="button-create-team">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Team
                  </Button>
                </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="border-b pb-4">
                      <DialogTitle className="text-2xl font-semibold text-gray-900">Create New Team</DialogTitle>
                      <DialogDescription className="text-gray-600">
                        Set up a new team with role-based members and notification preferences.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                        {/* Basic Team Information */}
                        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            Basic Team Information
                          </h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Team Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter team name" 
                                      className="h-11"
                                {...field} 
                                data-testid="input-team-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                            
                            <FormField
                              control={form.control}
                              name="segment"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Team Segment *</FormLabel>
                                  <FormControl>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <SelectTrigger className="h-11" data-testid="select-team-segment">
                                        <SelectValue placeholder="Select team segment" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="private">Private</SelectItem>
                                        <SelectItem value="academic">Academic</SelectItem>
                                        <SelectItem value="parastals">Parastals</SelectItem>
                                      </SelectContent>
                                    </Select>
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
                                <FormLabel className="text-sm font-medium text-gray-700">Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Describe the team's purpose and responsibilities" 
                                    className="min-h-[80px] resize-none"
                                {...field} 
                                data-testid="textarea-team-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                        </div>

                        {/* Enhanced Role-based Team Member Selection */}
                        <div className="bg-blue-50 rounded-lg p-6 space-y-6">
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-blue-600" />
                            Team Composition
                          </h3>
                          
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* BC Developers */}
                      <FormField
                        control={form.control}
                              name="bcDevs"
                              render={({ field }) => {
                                const filteredBcDevs = filterEmployeesByRoleAndSearch('bc_dev', bcDevSearch);
                                return (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                      <Badge variant="secondary" className="text-xs">Required</Badge>
                                      BC Developers * (Select at least 1)
                                    </FormLabel>
                                    <FormControl>
                                      <div className="space-y-3">
                                        {/* Search Input */}
                                        <Input
                                          placeholder="Search BC Developers..."
                                          value={bcDevSearch}
                                          onChange={(e) => setBcDevSearch(e.target.value)}
                                          className="h-9 text-sm"
                                        />
                                        
                                        {/* Employees List */}
                                        <div className="max-h-32 overflow-auto border rounded-md p-3 bg-white">
                                          {employeesLoading ? (
                                            <div className="text-sm text-gray-500 text-center py-4">Loading employees...</div>
                                          ) : filteredBcDevs.length === 0 ? (
                                            <div className="text-sm text-gray-500 text-center py-4">
                                              {bcDevSearch ? `No BC Developers found matching "${bcDevSearch}"` : "No BC Developers found"}
                                            </div>
                                          ) : (
                                            filteredBcDevs.map((emp: any) => {
                                              const checked = field.value.includes(emp.id);
                                              return (
                                                <label key={emp.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                      if (e.target.checked) {
                                                        field.onChange([...field.value, emp.id]);
                                                      } else {
                                                        field.onChange(field.value.filter((id) => id !== emp.id));
                                                      }
                                                    }}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                  />
                                                  <div className="flex-1">
                                                    <span className="text-sm font-medium text-gray-900">
                                                      {emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : emp.email}
                                                    </span>
                                                    {emp.email && (
                                                      <p className="text-xs text-gray-500">{emp.email}</p>
                                                    )}
                                                  </div>
                                                </label>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />

                            {/* Functional Consultants */}
                            <FormField
                              control={form.control}
                              name="consultants"
                              render={({ field }) => {
                                const filteredConsultants = filterEmployeesByRoleAndSearch('consultant', consultantSearch);
                                return (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                      <Badge variant="secondary" className="text-xs">Required</Badge>
                                      Functional Consultants * (Select exactly 2)
                                    </FormLabel>
                                    <FormControl>
                                      <div className="space-y-3">
                                        {/* Search Input */}
                                        <Input
                                          placeholder="Search Consultants..."
                                          value={consultantSearch}
                                          onChange={(e) => setConsultantSearch(e.target.value)}
                                          className="h-9 text-sm"
                                        />
                                        
                                        {/* Employees List */}
                                        <div className="max-h-32 overflow-auto border rounded-md p-3 bg-white">
                                          {employeesLoading ? (
                                            <div className="text-sm text-gray-500 text-center py-4">Loading employees...</div>
                                          ) : filteredConsultants.length === 0 ? (
                                            <div className="text-sm text-gray-500 text-center py-4">
                                              {consultantSearch ? `No Consultants found matching "${consultantSearch}"` : "No Consultants found"}
                                            </div>
                                          ) : (
                                            filteredConsultants.map((emp: any) => {
                                              const checked = field.value.includes(emp.id);
                                              const disabled = !checked && field.value.length >= 2;
                                              return (
                                                <label key={emp.id} className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer ${
                                                  disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                                                }`}>
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={disabled}
                                                    onChange={(e) => {
                                                      if (e.target.checked) {
                                                        field.onChange([...field.value, emp.id]);
                                                      } else {
                                                        field.onChange(field.value.filter((id) => id !== emp.id));
                                                      }
                                                    }}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                  />
                                                  <div className="flex-1">
                                                    <span className="text-sm font-medium text-gray-900">
                                                      {emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : emp.email}
                                                    </span>
                                                    {emp.email && (
                                                      <p className="text-xs text-gray-500">{emp.email}</p>
                                                    )}
                                                  </div>
                                                </label>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Portal Developer */}
                            <FormField
                              control={form.control}
                              name="portalDev"
                              render={({ field }) => {
                                const filteredPortalDevs = filterEmployeesByRoleAndSearch('portal_dev', portalDevSearch);
                                return (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                      <Badge variant="secondary" className="text-xs">Required</Badge>
                                      Portal Developer *
                                    </FormLabel>
                                    <FormControl>
                                      <div className="space-y-3">
                                        {/* Search Input */}
                                        <Input
                                          placeholder="Search Portal Developers..."
                                          value={portalDevSearch}
                                          onChange={(e) => setPortalDevSearch(e.target.value)}
                                          className="h-9 text-sm"
                                        />
                                        
                                        {/* Employees List */}
                                        <div className="max-h-32 overflow-auto border rounded-md p-3 bg-white">
                                          {employeesLoading ? (
                                            <div className="text-sm text-gray-500 text-center py-4">Loading employees...</div>
                                          ) : filteredPortalDevs.length === 0 ? (
                                            <div className="text-sm text-gray-500 text-center py-4">
                                              {portalDevSearch ? `No Portal Developers found matching "${portalDevSearch}"` : "No Portal Developers found"}
                                            </div>
                                          ) : (
                                            filteredPortalDevs.map((emp: any) => {
                                              const selected = field.value === emp.id;
                                              return (
                                                <label key={emp.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                                  <input
                                                    type="radio"
                                                    checked={selected}
                                                    onChange={() => field.onChange(emp.id)}
                                                    className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                                                  />
                                                  <div className="flex-1">
                                                    <span className="text-sm font-medium text-gray-900">
                                                      {emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : emp.email}
                                                    </span>
                                                    {emp.email && (
                                                      <p className="text-xs text-gray-500">{emp.email}</p>
                                                    )}
                                                  </div>
                                                </label>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />

                            {/* Account Manager */}
                            <FormField
                              control={form.control}
                              name="accountManager"
                              render={({ field }) => {
                                const filteredAccountManagers = filterEmployeesByRoleAndSearch('account_manager', accountManagerSearch);
                                return (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                      <Badge variant="secondary" className="text-xs">Required</Badge>
                                      Account Manager *
                                    </FormLabel>
                                    <FormControl>
                                      <div className="space-y-3">
                                        {/* Search Input */}
                                        <Input
                                          placeholder="Search Account Managers..."
                                          value={accountManagerSearch}
                                          onChange={(e) => setAccountManagerSearch(e.target.value)}
                                          className="h-9 text-sm"
                                        />
                                        
                                        {/* Employees List */}
                                        <div className="max-h-32 overflow-auto border rounded-md p-3 bg-white">
                                          {employeesLoading ? (
                                            <div className="text-sm text-gray-500 text-center py-4">Loading employees...</div>
                                          ) : filteredAccountManagers.length === 0 ? (
                                            <div className="text-sm text-gray-500 text-center py-4">
                                              {accountManagerSearch ? `No Account Managers found matching "${accountManagerSearch}"` : "No Account Managers found"}
                                            </div>
                                          ) : (
                                            filteredAccountManagers.map((emp: any) => {
                                              const selected = field.value === emp.id;
                                              return (
                                                <label key={emp.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                                  <input
                                                    type="radio"
                                                    checked={selected}
                                                    onChange={() => field.onChange(emp.id)}
                                                    className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                                                  />
                                                  <div className="flex-1">
                                                    <span className="text-sm font-medium text-gray-900">
                                                      {emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : emp.email}
                                                    </span>
                                                    {emp.email && (
                                                      <p className="text-xs text-gray-500">{emp.email}</p>
                                                    )}
                                                  </div>
                                                </label>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />
                          </div>

                          {/* Project Leader */}
                          <FormField
                            control={form.control}
                            name="projectLeader"
                            render={({ field }) => {
                              const eligibleEmployees = employees.filter((emp: any) => 
                                emp.role === 'bc_dev' || 
                                emp.role === 'consultant' || 
                                emp.role === 'portal_dev' || 
                                emp.role === 'account_manager'
                              );
                              const filteredProjectLeaders = filterEmployeesByRoleAndSearch('all', projectLeaderSearch).filter((emp: any) => 
                                emp.role === 'bc_dev' || 
                                emp.role === 'consultant' || 
                                emp.role === 'portal_dev' || 
                                emp.role === 'account_manager'
                              );
                              
                              return (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">Required</Badge>
                                    Project Leader *
                                  </FormLabel>
                                  <FormControl>
                                    <div className="space-y-3">
                                      {/* Search Input */}
                                      <Input
                                        placeholder="Search Project Leaders..."
                                        value={projectLeaderSearch}
                                        onChange={(e) => setProjectLeaderSearch(e.target.value)}
                                        className="h-9 text-sm"
                                      />
                                      
                                      {/* Leaders List */}
                                      <div className="max-h-32 overflow-auto border rounded-md p-3 bg-white">
                                        {/* Segment Leader Option */}
                                        <label className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer border-b border-gray-100 mb-2">
                                          <input
                                            type="radio"
                                            checked={field.value === "segment_leader"}
                                            onChange={() => field.onChange("segment_leader")}
                                            className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <div className="flex-1">
                                            <span className="text-sm font-medium text-gray-900">
                                              Segment Leader (Auto-assigned)
                                            </span>
                                            <p className="text-xs text-gray-500">Automatically assigned based on project segment</p>
                                          </div>
                                        </label>
                                        
                                        {employeesLoading ? (
                                          <div className="text-sm text-gray-500 text-center py-4">Loading employees...</div>
                                        ) : filteredProjectLeaders.length === 0 ? (
                                          <div className="text-sm text-gray-500 text-center py-4">
                                            {projectLeaderSearch ? `No Project Leaders found matching "${projectLeaderSearch}"` : "No eligible employees found"}
                                          </div>
                                        ) : (
                                          filteredProjectLeaders.map((emp: any) => {
                                            const selected = field.value === emp.id;
                                            return (
                                              <label key={emp.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  checked={selected}
                                                  onChange={() => field.onChange(emp.id)}
                                                  className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div className="flex-1">
                                                  <span className="text-sm font-medium text-gray-900">
                                                    {emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : emp.email}
                                                  </span>
                                                  <div className="flex items-center gap-2">
                                                    {emp.email && (
                                                      <p className="text-xs text-gray-500">{emp.email}</p>
                                                    )}
                                                    <Badge variant="outline" className="text-xs">
                                                      {emp.role?.replace('_', ' ')?.toUpperCase()}
                                                    </Badge>
                                                  </div>
                                                </div>
                                              </label>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        </div>

                        {/* Credential Management */}
                        <div className="bg-green-50 rounded-lg p-6 space-y-6">
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Mail className="h-5 w-5 text-green-600" />
                            Credential Management
                          </h3>
                          
                          <FormField
                            control={form.control}
                            name="sendCredentials"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm font-medium text-gray-700">Send temporary credentials to new team members</FormLabel>
                                  <p className="text-sm text-gray-600">
                                    Automatically generate and email temporary passwords to selected team members
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <FormField
                              control={form.control}
                              name="financeNotifications"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <input
                                      type="checkbox"
                                      checked={field.value}
                                      onChange={field.onChange}
                                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-medium text-gray-700">Enable Finance Team Notifications</FormLabel>
                                    <p className="text-sm text-gray-600">
                                      Finance team will receive notifications for overdue milestones and payment reminders
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />

                            {form.watch('financeNotifications') && (
                              <FormField
                                control={form.control}
                                name="financeEmail"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium text-gray-700">
                                      Finance Team Email
                                      {!systemEmails && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
                                      {systemEmails?.financeEmail && <span className="text-xs text-green-600 ml-2">(Auto-filled)</span>}
                                    </FormLabel>
                                    <div className="flex items-center gap-2">
                                      <FormControl>
                                        <Input 
                                          placeholder="finance@company.com" 
                                          className="h-11"
                                          {...field} 
                                        />
                                      </FormControl>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleResend('financeEmail', { roleType: 'finance_head', email: field.value, displayName: 'Finance Head' })}
                                        disabled={!isValidEmail(field.value) || resending['financeEmail'] || !roleExists('finance_head')}
                                        className="h-11 px-3"
                                      >
                                        <RefreshCw className={`h-4 w-4 ${resending['financeEmail'] ? 'animate-spin' : ''}`} />
                                      </Button>
                                    </div>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <FormField
                              control={form.control}
                              name="accountManagerNotifications"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <input
                                      type="checkbox"
                                      checked={field.value}
                                      onChange={field.onChange}
                                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-medium text-gray-700">Enable Account Manager Notifications</FormLabel>
                                    <p className="text-sm text-gray-600">
                                      Account managers will receive project completion forecasts and client updates
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />

                            {form.watch('accountManagerNotifications') && (
                              <FormField
                                control={form.control}
                                name="accountManagerEmail"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium text-gray-700">
                                      Account Manager Email
                                      {!systemEmails && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
                                      {systemEmails?.accountManagerEmail && <span className="text-xs text-green-600 ml-2">(Auto-filled)</span>}
                                    </FormLabel>
                                    <div className="flex items-center gap-2">
                                      <FormControl>
                                        <Input 
                                          placeholder="accountmanager@company.com" 
                                          className="h-11"
                                          {...field} 
                                        />
                                      </FormControl>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleResend('accountManagerEmail', { roleType: 'project_manager', email: field.value, displayName: 'Project Manager' })}
                                        disabled={!isValidEmail(field.value) || resending['accountManagerEmail'] || !roleExists('project_manager')}
                                        className="h-11 px-3"
                                      >
                                        <RefreshCw className={`h-4 w-4 ${resending['accountManagerEmail'] ? 'animate-spin' : ''}`} />
                                      </Button>
                                    </div>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                          </div>
                        </div>



                        <div className="flex justify-end space-x-3 pt-6 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateTeamOpen(false)}
                          data-testid="button-cancel-team"
                            className="h-11 px-6"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createTeamMutation.isPending}
                          data-testid="button-submit-team"
                            className="h-11 px-6 bg-blue-600 hover:bg-blue-700"
                        >
                          {createTeamMutation.isPending ? "Creating..." : "Create Team"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
                
                {/* Admin Role Management */}
                <Dialog open={isSegmentLeaderModalOpen} onOpenChange={setIsSegmentLeaderModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Manage Admin Roles
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-semibold text-gray-900">Admin Role Management</DialogTitle>
                      <DialogDescription className="text-gray-600">
                        Manage admin roles including segment leaders, project manager, and finance head for system operations.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                      {/* Global Admin Roles Section */}
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 space-y-4">
                        <h3 className="font-medium text-purple-900 text-lg mb-4">Global Admin Roles</h3>
                        
                        {/* Project Manager */}
                        <div className="bg-white rounded-lg p-4 space-y-3 border border-purple-200">
                          <h4 className="font-medium text-purple-800 flex items-center gap-2">
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800">Project Manager</Badge>
                            Project Manager
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Manager Name</label>
                              <Input 
                                placeholder="Enter project manager name"
                                className="h-10"
                                value={adminRoleData.projectManager.name}
                                onChange={(e) => setAdminRoleData({ ...adminRoleData, projectManager: { ...adminRoleData.projectManager, name: e.target.value } })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                              <div className="flex items-center gap-2">
                                <Input 
                                  placeholder="manager@company.com"
                                  className="h-10"
                                  value={adminRoleData.projectManager.email}
                                  onChange={(e) => setAdminRoleData({ ...adminRoleData, projectManager: { ...adminRoleData.projectManager, email: e.target.value } })}
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleResend('pm', { roleType: 'project_manager', email: adminRoleData.projectManager.email, displayName: 'Project Manager' })}
                                  disabled={!!resending['pm'] || !isValidEmail(adminRoleData.projectManager.email) || !roleExists('project_manager')}
                                  title="Resend credentials"
                                  className="h-9 w-9"
                                >
                                  <span className="sr-only">Resend credentials</span>
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Managers under Project Manager */}
                          <Accordion type="single" collapsible className="w-full pt-2">
                            <AccordionItem value="pm-managers">
                              <AccordionTrigger className="text-sm">Managers under Project Manager</AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2">
                                  {pmManagerRows.map((row, idx) => (
                                    <div key={`pm-row-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <Input placeholder="Full name" className="h-9" value={row.name} onChange={(e)=>{
                                        const v=[...pmManagerRows]; v[idx]={...v[idx], name:e.target.value}; setPmManagerRows(v);
                                      }} />
                                      <Input placeholder="Email" className="h-9" value={row.email} onChange={(e)=>{
                                        const v=[...pmManagerRows]; v[idx]={...v[idx], email:e.target.value}; setPmManagerRows(v);
                                      }} />
                                      <div className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={()=>{
                                          const v=[...pmManagerRows]; v.splice(idx,1); setPmManagerRows(v);
                                        }}>Remove</Button>
                                      </div>
                                    </div>
                                  ))}
                                  <Button size="sm" variant="outline" onClick={()=> setPmManagerRows([...pmManagerRows, { name: '', email: '' }])}>Add manager</Button>
                                  <div className="text-xs text-gray-500">Managers are saved when you click "Save Changes".</div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>

                        {/* Finance Head */}
                        <div className="bg-white rounded-lg p-4 space-y-3 border border-purple-200">
                          <h4 className="font-medium text-purple-800 flex items-center gap-2">
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800">Finance Head</Badge>
                            Finance Head
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Finance Head Name</label>
                              <Input 
                                placeholder="Enter finance head name"
                                className="h-10"
                                value={adminRoleData.financeHead.name}
                                onChange={(e) => setAdminRoleData({ ...adminRoleData, financeHead: { ...adminRoleData.financeHead, name: e.target.value } })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                              <div className="flex items-center gap-2">
                                <Input 
                                  placeholder="finance.head@company.com"
                                  className="h-10"
                                  value={adminRoleData.financeHead.email}
                                  onChange={(e) => setAdminRoleData({ ...adminRoleData, financeHead: { ...adminRoleData.financeHead, email: e.target.value } })}
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleResend('fh', { roleType: 'finance_head', email: adminRoleData.financeHead.email, displayName: 'Finance Head' })}
                                  disabled={!!resending['fh'] || !isValidEmail(adminRoleData.financeHead.email) || !roleExists('finance_head')}
                                  title="Resend credentials"
                                  className="h-9 w-9"
                                >
                                  <span className="sr-only">Resend credentials</span>
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Managers under Finance Head */}
                          <Accordion type="single" collapsible className="w-full pt-2">
                            <AccordionItem value="fh-managers">
                              <AccordionTrigger className="text-sm">Managers under Finance Head</AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2">
                                  {fhManagerRows.map((row, idx) => (
                                    <div key={`fh-row-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <Input placeholder="Full name" className="h-9" value={row.name} onChange={(e)=>{
                                        const v=[...fhManagerRows]; v[idx]={...v[idx], name:e.target.value}; setFhManagerRows(v);
                                      }} />
                                      <Input placeholder="Email" className="h-9" value={row.email} onChange={(e)=>{
                                        const v=[...fhManagerRows]; v[idx]={...v[idx], email:e.target.value}; setFhManagerRows(v);
                                      }} />
                                      <div className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={()=>{
                                          const v=[...fhManagerRows]; v.splice(idx,1); setFhManagerRows(v);
                                        }}>Remove</Button>
                                      </div>
                                    </div>
                                  ))}
                                  <Button size="sm" variant="outline" onClick={()=> setFhManagerRows([...fhManagerRows, { name: '', email: '' }])}>Add manager</Button>
                                  <div className="text-xs text-gray-500">Managers are saved when you click "Save Changes".</div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      </div>
                      
                      {/* Segment Leaders Section */}
                      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6 space-y-4">
                        <h3 className="font-medium text-blue-900 text-lg mb-4">Segment Leaders</h3>
                      {/* Academic Segment */}
                      <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                        <h3 className="font-medium text-blue-900 flex items-center gap-2">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">Academic</Badge>
                          Academic Segment Leader
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Leader Name</label>
                            <Input 
                              placeholder="Enter leader name"
                              className="h-10"
                              value={adminRoleData.academic.name}
                              onChange={(e) => setAdminRoleData({ ...adminRoleData, academic: { ...adminRoleData.academic, name: e.target.value } })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="flex items-center gap-2">
                              <Input 
                                placeholder="leader@academic.com"
                                className="h-10"
                                value={adminRoleData.academic.email}
                                onChange={(e) => setAdminRoleData({ ...adminRoleData, academic: { ...adminRoleData.academic, email: e.target.value } })}
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleResend('seg-academic', { roleType: 'segment_leader', segment: 'academic', email: adminRoleData.academic.email, displayName: 'Academic Segment Leader' })}
                                disabled={!!resending['seg-academic'] || !isValidEmail(adminRoleData.academic.email) || !roleExists('segment_leader', 'academic')}
                                title="Resend credentials"
                                className="h-9 w-9"
                              >
                                <span className="sr-only">Resend credentials</span>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Managers under Academic Segment */}
                        <Accordion type="single" collapsible className="w-full pt-2">
                          <AccordionItem value="seg-ac-managers">
                            <AccordionTrigger className="text-sm">Managers under Academic Segment Leader</AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2">
                                {segAcManagerRows.map((row, idx) => (
                                  <div key={`seg-ac-row-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <Input placeholder="Full name" className="h-9" value={row.name} onChange={(e)=>{
                                      const v=[...segAcManagerRows]; v[idx]={...v[idx], name:e.target.value}; setSegAcManagerRows(v);
                                    }} />
                                    <Input placeholder="Email" className="h-9" value={row.email} onChange={(e)=>{
                                      const v=[...segAcManagerRows]; v[idx]={...v[idx], email:e.target.value}; setSegAcManagerRows(v);
                                    }} />
                                    <div className="flex items-center gap-2">
                                      <Button size="sm" variant="outline" onClick={()=>{
                                        const v=[...segAcManagerRows]; v.splice(idx,1); setSegAcManagerRows(v);
                                      }}>Remove</Button>
                                    </div>
                                  </div>
                                ))}
                                <Button size="sm" variant="outline" onClick={()=> setSegAcManagerRows([...segAcManagerRows, { name: '', email: '' }])}>Add manager</Button>
                                <div className="text-xs text-gray-500">Managers are saved when you click "Save Changes".</div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>

                      {/* Parastals Segment */}
                      <div className="bg-green-50 rounded-lg p-4 space-y-3">
                        <h3 className="font-medium text-green-900 flex items-center gap-2">
                          <Badge variant="secondary" className="bg-green-100 text-green-800">Parastals</Badge>
                          Parastals Segment Leader
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Leader Name</label>
                            <Input 
                              placeholder="Enter leader name"
                              className="h-10"
                              value={adminRoleData.parastals.name}
                              onChange={(e) => setAdminRoleData({ ...adminRoleData, parastals: { ...adminRoleData.parastals, name: e.target.value } })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="flex items-center gap-2">
                              <Input 
                                placeholder="leader@parastals.com"
                                className="h-10"
                                value={adminRoleData.parastals.email}
                                onChange={(e) => setAdminRoleData({ ...adminRoleData, parastals: { ...adminRoleData.parastals, email: e.target.value } })}
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleResend('seg-parastals', { roleType: 'segment_leader', segment: 'parastals', email: adminRoleData.parastals.email, displayName: 'Parastals Segment Leader' })}
                                disabled={!!resending['seg-parastals'] || !isValidEmail(adminRoleData.parastals.email) || !roleExists('segment_leader', 'parastals')}
                                title="Resend credentials"
                                className="h-9 w-9"
                              >
                                <span className="sr-only">Resend credentials</span>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Managers under Parastals Segment */}
                        <Accordion type="single" collapsible className="w-full pt-2">
                          <AccordionItem value="seg-pa-managers">
                            <AccordionTrigger className="text-sm">Managers under Parastals Segment Leader</AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2">
                                {segPaManagerRows.map((row, idx) => (
                                  <div key={`seg-pa-row-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <Input placeholder="Full name" className="h-9" value={row.name} onChange={(e)=>{
                                      const v=[...segPaManagerRows]; v[idx]={...v[idx], name:e.target.value}; setSegPaManagerRows(v);
                                    }} />
                                    <Input placeholder="Email" className="h-9" value={row.email} onChange={(e)=>{
                                      const v=[...segPaManagerRows]; v[idx]={...v[idx], email:e.target.value}; setSegPaManagerRows(v);
                                    }} />
                                    <div className="flex items-center gap-2">
                                      <Button size="sm" variant="outline" onClick={()=>{
                                        const v=[...segPaManagerRows]; v.splice(idx,1); setSegPaManagerRows(v);
                                      }}>Remove</Button>
                                    </div>
                                  </div>
                                ))}
                                <Button size="sm" variant="outline" onClick={()=> setSegPaManagerRows([...segPaManagerRows, { name: '', email: '' }])}>Add manager</Button>
                                <div className="text-xs text-gray-500">Managers are saved when you click "Save Changes".</div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>

                      {/* Private Segment */}
                      <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                        <h3 className="font-medium text-purple-900 flex items-center gap-2">
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">Private</Badge>
                          Private Segment Leader
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Leader Name</label>
                            <Input 
                              placeholder="Enter leader name"
                              className="h-10"
                              value={adminRoleData.private.name}
                              onChange={(e) => setAdminRoleData({ ...adminRoleData, private: { ...adminRoleData.private, name: e.target.value } })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="flex items-center gap-2">
                              <Input 
                                placeholder="leader@private.com"
                                className="h-10"
                                value={adminRoleData.private.email}
                                onChange={(e) => setAdminRoleData({ ...adminRoleData, private: { ...adminRoleData.private, email: e.target.value } })}
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleResend('seg-private', { roleType: 'segment_leader', segment: 'private', email: adminRoleData.private.email, displayName: 'Private Segment Leader' })}
                                disabled={!!resending['seg-private'] || !isValidEmail(adminRoleData.private.email) || !roleExists('segment_leader', 'private')}
                                title="Resend credentials"
                                className="h-9 w-9"
                              >
                                <span className="sr-only">Resend credentials</span>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Managers under Private Segment */}
                        <Accordion type="single" collapsible className="w-full pt-2">
                          <AccordionItem value="seg-pr-managers">
                            <AccordionTrigger className="text-sm">Managers under Private Segment Leader</AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2">
                                {segPrManagerRows.map((row, idx) => (
                                  <div key={`seg-pr-row-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <Input placeholder="Full name" className="h-9" value={row.name} onChange={(e)=>{
                                      const v=[...segPrManagerRows]; v[idx]={...v[idx], name:e.target.value}; setSegPrManagerRows(v);
                                    }} />
                                    <Input placeholder="Email" className="h-9" value={row.email} onChange={(e)=>{
                                      const v=[...segPrManagerRows]; v[idx]={...v[idx], email:e.target.value}; setSegPrManagerRows(v);
                                    }} />
                                    <div className="flex items-center gap-2">
                                      <Button size="sm" variant="outline" onClick={()=>{
                                        const v=[...segPrManagerRows]; v.splice(idx,1); setSegPrManagerRows(v);
                                      }}>Remove</Button>
                                    </div>
                                  </div>
                                ))}
                                <Button size="sm" variant="outline" onClick={()=> setSegPrManagerRows([...segPrManagerRows, { name: '', email: '' }])}>Add manager</Button>
                                <div className="text-xs text-gray-500">Managers are saved when you click "Save Changes".</div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                      </div>

                      {/* Global Notification Settings */}
                      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                        <h3 className="font-medium text-gray-900">Global Notification Settings</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Finance Team Email</label>
                            <Input 
                              placeholder="finance@company.com"
                              className="h-10"
                              value={adminRoleData.financeEmail}
                              onChange={(e) => setAdminRoleData({ ...adminRoleData, financeEmail: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1">For overdue milestones and payment reminders</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Account Manager Email</label>
                            <Input 
                              placeholder="accountmanager@company.com"
                              className="h-10"
                              value={adminRoleData.accountManagerEmail}
                              onChange={(e) => setAdminRoleData({ ...adminRoleData, accountManagerEmail: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1">For project completion forecasts</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3 pt-4 border-t">
                        <Button variant="outline" className="h-10 px-6" onClick={handleCancelAdminRoles}>
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={isSavingAdminRoles}
                          onClick={handleSaveAdminRoles}
                          className="h-10 px-6 bg-blue-600 hover:bg-blue-700"
                        >
                          {isSavingAdminRoles ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : null}
          </div>
        </div>

        {/* Teams Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-medium text-gray-900" data-testid="text-teams-section">Teams</h3>
            
            {/* Search + Segment Filter */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Input
                  placeholder="Search teams..."
                  value={teamQuery}
                  onChange={(e) => setTeamQuery(e.target.value)}
                  className="pl-3 h-9 w-56"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Segment:</label>
                <select
                  value={segmentFilter}
                  onChange={(e) => setSegmentFilter(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="academic">Academic</option>
                  <option value="parastals">Parastals</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>
          </div>
          
          {teamsLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : teams.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2" data-testid="text-no-teams">No teams yet</h3>
                <p className="text-gray-600">You are not currently a member of any team.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams
                .filter((team: any) => {
                  // Segment filter
                  const matchesSegment = segmentFilter === 'all' || team.segment === segmentFilter || team.projects?.some((p: any) => p.segment === segmentFilter);
                  if (!matchesSegment) return false;
                  // Name search filter
                  const q = teamQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (team.name || '').toLowerCase().includes(q);
                })
                .map((team: any) => (
                <Card 
                  key={team.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer border rounded-lg" 
                  data-testid={`card-team-${team.id}`}
                  onClick={() => handleTeamClick(team)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="h-5 w-5 mr-2 text-primary" />
                      <span data-testid={`text-team-name-${team.id}`}>{team.name}</span>
                    </CardTitle>
                    {team.description && (
                      <CardDescription data-testid={`text-team-description-${team.id}`} className="truncate">
                        {team.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {(team.segment || team.projects?.[0]?.segment || 'private')}
                        </Badge>
                        <span className="text-gray-500">• {team.projects?.length || 0} projects</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(team.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Team Members Workload */}
        {((user?.role !== 'employee') || teams.length > 0) && (
        <div>
          <h3 className="text-xl font-medium text-gray-900 mb-4" data-testid="text-workload-section">Team Workload</h3>
          
          {workloadLoading ? (
            <Card className="animate-pulse">
              <CardContent className="py-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 py-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                    </div>
                    <div className="w-24 h-2 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : workload.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2" data-testid="text-no-workload">No workload data available</h3>
                <p className="text-gray-600">Team members with assigned subtasks will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Team Member Performance</CardTitle>
                <CardDescription>Individual workload and task completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workload.map((member: any) => (
                    <div 
                      key={member.userId} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      data-testid={`workload-member-${member.userId}`}
                    >
                      <div className="flex items-center space-x-4">
                        <Avatar>
                          <AvatarImage src={member.user.profileImageUrl} />
                          <AvatarFallback>
                            {getInitials(member.user.firstName && member.user.lastName 
                              ? `${member.user.firstName} ${member.user.lastName}`
                              : member.user.email || 'U'
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium" data-testid={`text-member-name-${member.userId}`}>
                            {member.user.firstName && member.user.lastName 
                              ? `${member.user.firstName} ${member.user.lastName}`
                              : member.user.email
                            }
                          </p>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs" data-testid={`badge-member-role-${member.userId}`}>
                              {member.user.role}
                            </Badge>
                            {member.user.email && (
                              <span className="text-xs text-gray-500 flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                {member.user.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <p className="text-sm font-medium" data-testid={`text-member-tasks-${member.userId}`}>
                            {member.completedTasks}/{member.totalTasks} subtasks
                          </p>
                          <p className="text-xs text-gray-600">
                            {member.workloadPercentage}% completion rate
                          </p>
                        </div>
                        
                        <div className="w-24">
                          <Progress 
                            value={member.workloadPercentage} 
                            className="h-2"
                            data-testid={`progress-member-${member.userId}`}
                          />
                        </div>
                        
                        <Badge 
                          variant={(() => {
                            const totalTasks = member.totalTasks || 0;
                            const percentage = member.workloadPercentage || 0;
                            
                            if (totalTasks <= 10) {
                              if (percentage >= 80) return "default"; // Excellent - blue
                              if (percentage >= 60) return "secondary"; // Good - gray
                              return "outline"; // Normal - outline
                            } else if (totalTasks <= 30) {
                              if (percentage >= 80) return "destructive"; // Overloaded - red
                              return "secondary"; // High - gray
                            } else {
                              return "destructive"; // Overloaded - red
                            }
                          })()}
                          data-testid={`badge-performance-${member.userId}`}
                        >
                          {(() => {
                            // Use the same logic as dashboard for consistency
                            const totalTasks = member.totalTasks || 0;
                            const percentage = member.workloadPercentage || 0;
                            
                            if (totalTasks <= 10) {
                              // Low task count - focus on completion rate
                              if (percentage >= 80) return "Excellent";
                              if (percentage >= 60) return "Good";
                              return "Normal";
                            } else if (totalTasks <= 30) {
                              // Medium task count - minimum "High" workload
                              if (percentage >= 80) return "Overloaded";
                              if (percentage >= 60) return "High";
                              return "High"; // Minimum high for 11-30 tasks
                            } else {
                              // High task count (31+) - minimum "Overloaded" workload
                              if (percentage >= 60) return "Overloaded";
                              return "Overloaded"; // Minimum overloaded for 31+ tasks
                            }
                          })()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        )}
      </div>






    </div>
  );
}
