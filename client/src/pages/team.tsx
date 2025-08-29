import { useEffect, useState } from "react";
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
import { Users, Plus, Mail, UserPlus, Calendar, BarChart3, Info } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";


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
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);

  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [isTeamDetailOpen, setIsTeamDetailOpen] = useState(false);
  const [isSegmentLeaderModalOpen, setIsSegmentLeaderModalOpen] = useState(false);
  
  // Segment leader form state
  const [segmentLeaderData, setSegmentLeaderData] = useState({
    academic: { name: 'Academic Leader', email: 'academic.leader@company.com' },
    parastals: { name: 'Parastals Leader', email: 'parastals.leader@company.com' },
    private: { name: 'Private Leader', email: 'private.leader@company.com' },
    financeEmail: 'finance@company.com',
    accountManagerEmail: 'accountmanager@company.com'
  });

  // Debug log for initial state
  console.log('Initial segment leader data:', segmentLeaderData);
  
  // Loading state for segment leader save
  const [isSavingSegmentLeaders, setIsSavingSegmentLeaders] = useState(false);
  
  // Fetch finance and account manager emails for auto-fill
  const { data: systemEmails } = useQuery({
    queryKey: ['/api/system-config/emails'],
    queryFn: async () => {
      const res = await fetch('/api/system-config/emails', { 
        credentials: 'include' 
      });
      if (!res.ok) return { financeEmail: '', accountManagerEmail: '' };
      const data = await res.json();
      console.log('System emails loaded:', data); // Debug log
      return data;
    },
    enabled: !!isAuthenticated,
  });
  
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

  // Fetch team details when a team is selected
  const { data: teamDetails, isLoading: teamDetailsLoading, error: teamDetailsError } = useQuery<any>({
    queryKey: ['/api/teams', selectedTeam?.id, 'details'],
    queryFn: async () => {
      if (!selectedTeam?.id) return null;
      const res = await fetch(`/api/teams/${selectedTeam.id}`, { 
        credentials: 'include', 
        cache: 'no-store' 
      });
      if (!res.ok) throw new Error('Failed to fetch team details');
      return res.json();
    },
    enabled: !!selectedTeam?.id && isTeamDetailOpen,
  });

  const handleTeamClick = (team: any) => {
    setSelectedTeam(team);
    setIsTeamDetailOpen(true);
  };

  const handleSaveSegmentLeaders = async () => {
    setIsSavingSegmentLeaders(true);
    try {
      // Save segment leaders to database
      const response = await fetch('/api/segment-leaders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(segmentLeaderData)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Segment leaders updated successfully",
        });
        setIsSegmentLeaderModalOpen(false);
        // Refresh data if needed
        queryClient.invalidateQueries({ queryKey: ['/api/segment-leaders'] });
        // Also refresh the system emails to show the updated values
        queryClient.invalidateQueries({ queryKey: ['/api/system-config/emails'] });
      } else {
        throw new Error('Failed to save segment leaders');
      }
    } catch (error) {
      console.error('Error saving segment leaders:', error);
      toast({
        title: "Error",
        description: "Failed to save segment leaders",
        variant: "destructive",
      });
    } finally {
      setIsSavingSegmentLeaders(false);
    }
  };

  const handleCancelSegmentLeaders = () => {
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
      console.log('Updating segment leader data with system emails:', systemEmails); // Debug log
      setSegmentLeaderData(prev => ({
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
                                    <FormControl>
                                      <Input 
                                        placeholder="finance@company.com" 
                                        className="h-11"
                                        {...field} 
                                      />
                                    </FormControl>
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
                                    <FormControl>
                                      <Input 
                                        placeholder="accountmanager@company.com" 
                                        className="h-11"
                                        {...field} 
                                      />
                                    </FormControl>
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
                
                {/* Segment Leader Management */}
                <Dialog open={isSegmentLeaderModalOpen} onOpenChange={setIsSegmentLeaderModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Manage Segment Leaders
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-semibold text-gray-900">Segment Leader Management</DialogTitle>
                      <DialogDescription className="text-gray-600">
                        Manage segment leaders and their contact information for notifications.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
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
                              value={segmentLeaderData.academic.name}
                              onChange={(e) => setSegmentLeaderData({ ...segmentLeaderData, academic: { ...segmentLeaderData.academic, name: e.target.value } })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <Input 
                              placeholder="leader@academic.com"
                              className="h-10"
                              value={segmentLeaderData.academic.email}
                              onChange={(e) => setSegmentLeaderData({ ...segmentLeaderData, academic: { ...segmentLeaderData.academic, email: e.target.value } })}
                            />
                          </div>
                        </div>
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
                              value={segmentLeaderData.parastals.name}
                              onChange={(e) => setSegmentLeaderData({ ...segmentLeaderData, parastals: { ...segmentLeaderData.parastals, name: e.target.value } })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <Input 
                              placeholder="leader@parastals.com"
                              className="h-10"
                              value={segmentLeaderData.parastals.email}
                              onChange={(e) => setSegmentLeaderData({ ...segmentLeaderData, parastals: { ...segmentLeaderData.parastals, email: e.target.value } })}
                            />
                          </div>
                        </div>
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
                              value={segmentLeaderData.private.name}
                              onChange={(e) => setSegmentLeaderData({ ...segmentLeaderData, private: { ...segmentLeaderData.private, name: e.target.value } })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <Input 
                              placeholder="leader@private.com"
                              className="h-10"
                              value={segmentLeaderData.private.email}
                              onChange={(e) => setSegmentLeaderData({ ...segmentLeaderData, private: { ...segmentLeaderData.private, email: e.target.value } })}
                            />
                          </div>
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
                              value={segmentLeaderData.financeEmail}
                              onChange={(e) => setSegmentLeaderData({ ...segmentLeaderData, financeEmail: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1">For overdue milestones and payment reminders</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Account Manager Email</label>
                            <Input 
                              placeholder="accountmanager@company.com"
                              className="h-10"
                              value={segmentLeaderData.accountManagerEmail}
                              onChange={(e) => setSegmentLeaderData({ ...segmentLeaderData, accountManagerEmail: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1">For project completion forecasts</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3 pt-4 border-t">
                        <Button variant="outline" className="h-10 px-6" onClick={handleCancelSegmentLeaders}>
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={isSavingSegmentLeaders}
                          onClick={handleSaveSegmentLeaders}
                          className="h-10 px-6 bg-blue-600 hover:bg-blue-700"
                        >
                          {isSavingSegmentLeaders ? "Saving..." : "Save Changes"}
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
          <h3 className="text-xl font-medium text-gray-900 mb-4" data-testid="text-teams-section">Teams</h3>
          
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
              {teams.map((team: any) => (
                <Card 
                  key={team.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer" 
                  data-testid={`card-team-${team.id}`}
                  onClick={() => handleTeamClick(team)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="h-5 w-5 mr-2 text-primary" />
                      <span data-testid={`text-team-name-${team.id}`}>{team.name}</span>
                    </CardTitle>
                    {team.description && (
                      <CardDescription data-testid={`text-team-description-${team.id}`}>
                        {team.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      Created {new Date(team.createdAt).toLocaleDateString()}
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
                          variant={member.workloadPercentage >= 80 ? "default" : 
                                 member.workloadPercentage >= 60 ? "secondary" : "outline"}
                          data-testid={`badge-performance-${member.userId}`}
                        >
                          {(() => {
                            // Use the same logic as dashboard for consistency
                            if (member.totalTasks <= 2) {
                              if (member.workloadPercentage >= 80) return "Excellent";
                              if (member.workloadPercentage >= 60) return "Good";
                              return "Normal";
                            } else if (member.totalTasks <= 4) {
                              if (member.workloadPercentage >= 90) return "Overloaded";
                              if (member.workloadPercentage >= 75) return "High";
                              if (member.workloadPercentage >= 50) return "Normal";
                              return "Light";
                            } else {
                              if (member.workloadPercentage >= 80) return "Overloaded";
                              if (member.workloadPercentage >= 60) return "High";
                              return "Normal";
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

      {/* Team Detail Modal */}
      <Dialog open={isTeamDetailOpen} onOpenChange={setIsTeamDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="border-b border-gray-200 pb-4">
            <DialogTitle className="flex items-center text-2xl font-bold text-gray-900">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg mr-3">
                <Users className="h-6 w-6 text-white" />
              </div>
              {selectedTeam?.name}
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base mt-2">
              📊 Team Details & Performance Metrics • {selectedTeam?.segment} segment
            </DialogDescription>
          </DialogHeader>
          
          {teamDetailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : teamDetailsError ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center text-red-600">
                <p className="font-medium">Failed to load team details</p>
                <p className="text-sm">{teamDetailsError.message}</p>
              </div>
            </div>
          ) : teamDetails ? (
            <div className="space-y-6">
              {/* Team Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Team Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <div className="text-3xl font-bold text-blue-700 mb-1">
                        {teamDetails?.members?.length || 0}
                      </div>
                      <div className="text-sm text-blue-600 font-medium">Team Members</div>
                      <div className="text-xs text-blue-500 mt-1">
                        {teamDetails?.members?.filter((m: any) => m.totalTasks > 0).length || 0} active
                      </div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                      <div className="text-3xl font-bold text-green-700 mb-1">
                        {teamDetails?.projects?.length || 0}
                      </div>
                      <div className="text-sm text-green-600 font-medium">Active Projects</div>
                      <div className="text-xs text-green-500 mt-1">
                        {teamDetails?.projects?.filter((p: any) => p.status === 'active').length || 0} running
                      </div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                      <div className="text-3xl font-bold text-purple-700 mb-1">
                        {teamDetails?.totalTasks || 0}
                      </div>
                      <div className="text-sm text-purple-600 font-medium">Total Subtasks</div>
                      <div className="text-xs text-purple-500 mt-1">
                        {teamDetails?.members?.reduce((sum: number, m: any) => sum + (m.completedTasks || 0), 0) || 0} completed
                      </div>
                    </div>
                  </div>
                  
                  {/* Team Role Summary */}
                  {teamDetails?.members && teamDetails.members.length > 0 && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-purple-50 rounded-lg border border-slate-200">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Team Role Distribution</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                        <div className="text-center">
                          <div className="text-lg font-bold text-purple-600">
                            {teamDetails.members.filter((m: any) => m.role === 'BC Developer').length}
                          </div>
                          <div className="text-purple-600">BC Developers</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">
                            {teamDetails.members.filter((m: any) => m.role === 'Functional Consultant').length}
                          </div>
                          <div className="text-green-600">Consultants</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {teamDetails.members.filter((m: any) => m.role === 'Portal Developer').length}
                          </div>
                          <div className="text-blue-600">Portal Devs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-600">
                            {teamDetails.members.filter((m: any) => m.role === 'Account Manager').length}
                          </div>
                          <div className="text-orange-600">Account Mgrs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-red-600">
                            {teamDetails.members.filter((m: any) => m.role === 'Project Leader').length}
                          </div>
                          <div className="text-red-600">Project Leaders</div>
                        </div>
                      </div>
                    </div>
                  )}
                  

                </CardContent>
              </Card>

              {/* Team Members */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Team Members</CardTitle>
                  <CardDescription>Individual performance and workload</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Role Information Note */}
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-blue-800">
                      <Info className="h-4 w-4" />
                      <span className="font-medium">Team Roles:</span>
                      <span>💻 BC Dev • 📋 Consultant • 🌐 Portal Dev • 🎯 Account Mgr • 🚀 Project Lead</span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      Roles are assigned during team creation. Members without specific roles show as "👤 Member".
                    </p>
                  </div>
                  
                  {teamDetails.members && teamDetails.members.length > 0 ? (
                    <div className="space-y-4">
                      {teamDetails.members.map((member: any) => (
                        <div 
                          key={member.userId} 
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center space-x-4">
                            <Avatar>
                              <AvatarImage src={member.user?.profileImageUrl} />
                              <AvatarFallback>
                                {getInitials(member.user?.firstName && member.user?.lastName 
                                  ? `${member.user.firstName} ${member.user.lastName}`
                                  : member.user?.email || 'U'
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {member.user?.firstName && member.user?.lastName 
                                    ? `${member.user.firstName} ${member.user.lastName}`
                                    : member.user?.email
                                  }
                                </p>
                                {member.role && (
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    member.role === 'BC Developer' ? 'bg-purple-100 text-purple-800' :
                                    member.role === 'Functional Consultant' ? 'bg-green-100 text-green-800' :
                                    member.role === 'Portal Developer' ? 'bg-blue-100 text-blue-800' :
                                    member.role === 'Account Manager' ? 'bg-orange-100 text-orange-800' :
                                    member.role === 'Project Leader' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {member.role === 'BC Developer' ? '💻 BC Dev' :
                                     member.role === 'Functional Consultant' ? '📋 Consultant' :
                                     member.role === 'Portal Developer' ? '🌐 Portal Dev' :
                                     member.role === 'Account Manager' ? '🎯 Account Mgr' :
                                     member.role === 'Project Leader' ? '🚀 Project Lead' :
                                     member.role === 'member' ? '👤 Member' :
                                     member.role}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                {member.user?.email && (
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
                              <p className="text-sm font-medium">
                                {member.completedTasks || 0}/{member.totalTasks || 0} subtasks
                              </p>
                              <p className="text-xs text-gray-600">
                                {member.workloadPercentage || 0}% completion rate
                              </p>
                            </div>
                            
                            <div className="w-24">
                              <Progress 
                                value={member.workloadPercentage || 0} 
                                className="h-2"
                              />
                            </div>
                            
                            <Badge 
                              variant={(() => {
                                const percentage = member.workloadPercentage || 0;
                                const totalTasks = member.totalTasks || 0;
                                
                                if (totalTasks <= 2) {
                                  if (percentage >= 80) return "default";
                                  if (percentage >= 60) return "secondary";
                                  return "outline";
                                } else if (totalTasks <= 4) {
                                  if (percentage >= 90) return "destructive";
                                  if (percentage >= 75) return "secondary";
                                  if (percentage >= 50) return "outline";
                                  return "outline";
                                } else {
                                  if (percentage >= 80) return "destructive";
                                  if (percentage >= 60) return "secondary";
                                  return "outline";
                                }
                              })()}
                            >
                              {(() => {
                                const percentage = member.workloadPercentage || 0;
                                const totalTasks = member.totalTasks || 0;
                                
                                if (totalTasks <= 2) {
                                  if (percentage >= 80) return "Excellent";
                                  if (percentage >= 60) return "Good";
                                  return "Normal";
                                } else if (totalTasks <= 4) {
                                  if (percentage >= 90) return "Overloaded";
                                  if (percentage >= 75) return "High";
                                  if (percentage >= 50) return "Normal";
                                  return "Light";
                                } else {
                                  if (percentage >= 80) return "Overloaded";
                                  if (percentage >= 60) return "High";
                                  return "Normal";
                                }
                              })()}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No team members found
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Failed to load team details
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
