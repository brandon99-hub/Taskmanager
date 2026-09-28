import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, Mail, UserPlus, Calendar, Check, ChevronsUpDown } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

interface TeamProjectOption {
  id: string;
  name: string;
  segmentId?: string | null;
}

const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100, "Team name too long"),
  projectId: z.string().optional().or(z.literal("none")),
  members: z.array(z.string()).optional(),
  bcDevs: z.array(z.string()).min(1, "At least 1 BC Developer is required"),
  consultants: z.array(z.string()).min(1, "At least 1 Functional Consultant is required"),
  portalDev: z.string().min(1, "Portal Developer is required"),
  projectLeader: z.string().min(1, "Project Leader is required"),
});

type CreateTeamData = z.infer<typeof createTeamSchema>;

interface TeamsTabProps {
  search?: string;
  segmentFilter?: string;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

export default function TeamsTab({ search = "", segmentFilter = "all", createOpen, onCreateOpenChange }: TeamsTabProps) {
  const auth = useAuth() as any;
  const { user, isAuthenticated } = auth;
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const teamQuery = search;

  const { data: teamProjects = [] } = useQuery<TeamProjectOption[]>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects', { credentials: 'include' });
      if (!res.ok) return [];
      const all = await res.json();
      return (Array.isArray(all) ? all : []).filter((p: any) => p.status !== 'inactive' && p.status !== 'support_closed');
    },
    enabled: !!isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const [bcDevSearch, setBcDevSearch] = useState("");
  const [consultantSearch, setConsultantSearch] = useState("");
  const [portalDevSearch, setPortalDevSearch] = useState("");
  const [projectLeaderSearch, setProjectLeaderSearch] = useState("");
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);

  const filterEmployeesByRoleAndSearch = (role: string, searchTerm: string) => {
    // Show all employees since job functions are assigned during team creation
    const filteredByRole = employees;

    if (!searchTerm.trim()) return filteredByRole;

    return filteredByRole.filter((emp: any) => {
      const fullName = emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : '';
      const email = emp.email || '';
      const searchLower = searchTerm.toLowerCase();

      return fullName.toLowerCase().includes(searchLower) ||
             email.toLowerCase().includes(searchLower);
    });
  };

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
    enabled: !!isAuthenticated,
  });

  const { data: workload = [], isLoading: workloadLoading, error: workloadError } = useQuery<any[]>({
    queryKey: ['/api/dashboard/workload'],
    enabled: !!isAuthenticated,
  });

  const handleTeamClick = (team: any) => {
    setLocation(`/teams/${team.id}`);
  };

  useEffect(() => {
    const errors = [teamsError, workloadError].filter(Boolean);
    errors.forEach((error) => {
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
      projectId: "none",
      bcDevs: [],
      consultants: [],
      portalDev: "",
      projectLeader: "",
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: CreateTeamData) => {
      const selectedProject = data.projectId && data.projectId !== 'none'
        ? teamProjects.find((p) => p.id === data.projectId)
        : undefined;

      const allMembers = [
        ...data.bcDevs,
        ...data.consultants,
        data.portalDev,
        data.projectLeader
      ].filter(Boolean) as string[];

      const response = await apiRequest("POST", "/api/teams", {
        name: data.name,
        sectorId: selectedProject?.segmentId || undefined,
        projectId: selectedProject?.id,
        members: allMembers,
        roleAssignments: {
          bcDevs: data.bcDevs,
          consultants: data.consultants,
          portalDev: data.portalDev,
          projectLeader: data.projectLeader,
        },
      });
      const newTeam = await response.json();

      if (selectedProject) {
        await apiRequest("PUT", `/api/projects/${selectedProject.id}`, { teamId: newTeam.id });
      }

      return newTeam;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onCreateOpenChange(false);
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

  const onSubmit = (data: CreateTeamData) => {
    createTeamMutation.mutate(data);
  };

  const clearAllSearches = () => {
    setBcDevSearch("");
    setConsultantSearch("");
    setPortalDevSearch("");
    setProjectLeaderSearch("");
  };

  const handleCloseModal = () => {
    onCreateOpenChange(false);
    clearAllSearches();
    form.reset();
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div>
      {user?.role !== 'employee' && (
            <Dialog open={createOpen} onOpenChange={(open) => {
              if (!open) {
                handleCloseModal();
              } else {
                onCreateOpenChange(true);
              }
            }}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-4">
                  <DialogTitle className="text-2xl font-semibold text-gray-900">Create New Team</DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Set up a new team with role-based members and notification preferences.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
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
                          name="projectId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">Project (optional)</FormLabel>
                              <FormControl>
                                <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={projectPopoverOpen}
                                      className="w-full h-11 justify-between font-normal"
                                      data-testid="select-team-project"
                                    >
                                      {field.value && field.value !== 'none'
                                        ? teamProjects.find((p) => p.id === field.value)?.name || "No project (assign later)"
                                        : "No project (assign later)"}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                      <CommandInput placeholder="Search projects..." />
                                      <CommandList>
                                        <CommandEmpty>No project found.</CommandEmpty>
                                        <CommandGroup>
                                          <CommandItem
                                            value="none"
                                            onSelect={() => {
                                              field.onChange("none");
                                              setProjectPopoverOpen(false);
                                            }}
                                          >
                                            <Check className={cn("h-4 w-4 mr-2", (!field.value || field.value === 'none') ? "opacity-100" : "opacity-0")} />
                                            No project (assign later)
                                          </CommandItem>
                                          {teamProjects.map((project) => (
                                            <CommandItem
                                              key={project.id}
                                              value={project.name}
                                              onSelect={() => {
                                                field.onChange(project.id);
                                                setProjectPopoverOpen(false);
                                              }}
                                            >
                                              <Check className={cn("h-4 w-4 mr-2", field.value === project.id ? "opacity-100" : "opacity-0")} />
                                              {project.name}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </FormControl>
                              <p className="text-xs text-gray-500">Linking a project sets this team's sector automatically and assigns the team to that project.</p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6 space-y-6">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Team Composition
                      </h3>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="bcDevs"
                          render={({ field }) => {
                            const filteredBcDevs = filterEmployeesByRoleAndSearch('bc_dev', bcDevSearch);
                            return (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">
                                  BC Developers *
                                </FormLabel>
                                <FormControl>
                                  <div className="space-y-3">
                                    <Input
                                      placeholder="Search BC Developers..."
                                      value={bcDevSearch}
                                      onChange={(e) => setBcDevSearch(e.target.value)}
                                      className="h-9 text-sm"
                                    />
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
                                                className="rounded border-gray-300 text-primary focus:ring-primary"
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

                        <FormField
                          control={form.control}
                          name="consultants"
                          render={({ field }) => {
                            const filteredConsultants = filterEmployeesByRoleAndSearch('consultant', consultantSearch);
                            return (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">
                                  Functional Consultants *
                                </FormLabel>
                                <FormControl>
                                  <div className="space-y-3">
                                    <Input
                                      placeholder="Search Consultants..."
                                      value={consultantSearch}
                                      onChange={(e) => setConsultantSearch(e.target.value)}
                                      className="h-9 text-sm"
                                    />
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
                                                className="rounded border-gray-300 text-primary focus:ring-primary"
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
                        <FormField
                          control={form.control}
                          name="portalDev"
                          render={({ field }) => {
                            const filteredPortalDevs = filterEmployeesByRoleAndSearch('portal_dev', portalDevSearch);
                            return (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">
                                  Portal Developer *
                                </FormLabel>
                                <FormControl>
                                  <div className="space-y-3">
                                    <Input
                                      placeholder="Search Portal Developers..."
                                      value={portalDevSearch}
                                      onChange={(e) => setPortalDevSearch(e.target.value)}
                                      className="h-9 text-sm"
                                    />
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
                                                className="rounded-full border-gray-300 text-primary focus:ring-primary"
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

                        <FormField
                          control={form.control}
                          name="projectLeader"
                          render={({ field }) => {
                          const filteredProjectLeaders = filterEmployeesByRoleAndSearch('all', projectLeaderSearch).filter((emp: any) =>
                            emp.role === 'bc_dev' ||
                            emp.role === 'consultant' ||
                            emp.role === 'portal_dev' ||
                            emp.role === 'account_manager'
                          );

                          return (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">
                                Project Leader *
                              </FormLabel>
                              <FormControl>
                                <div className="space-y-3">
                                  <Input
                                    placeholder="Search Project Leaders..."
                                    value={projectLeaderSearch}
                                    onChange={(e) => setProjectLeaderSearch(e.target.value)}
                                    className="h-9 text-sm"
                                  />
                                  <div className="max-h-32 overflow-auto border rounded-md p-3 bg-white">
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
                                              className="rounded-full border-gray-300 text-primary focus:ring-primary"
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
                    </div>

                    <div className="flex justify-end space-x-3 pt-6 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCloseModal}
                        data-testid="button-cancel-team"
                        className="h-11 px-6"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createTeamMutation.isPending}
                        data-testid="button-submit-team"
                        className="h-11 px-6 bg-primary hover:bg-primary-dark"
                      >
                        {createTeamMutation.isPending ? "Creating..." : "Create Team"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
      )}

      <div className="mb-8">
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
                const matchesSector = segmentFilter === 'all' || team.sectorId === segmentFilter;
                if (!matchesSector) return false;
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
                      <Badge variant="outline">
                        {team.sector?.name || 'Unassigned sector'}
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
                            if (percentage >= 80) return "default";
                            if (percentage >= 60) return "secondary";
                            return "outline";
                          } else if (totalTasks <= 30) {
                            if (percentage >= 80) return "destructive";
                            return "secondary";
                          } else {
                            return "destructive";
                          }
                        })()}
                        data-testid={`badge-performance-${member.userId}`}
                      >
                        {(() => {
                          const totalTasks = member.totalTasks || 0;
                          const percentage = member.workloadPercentage || 0;

                          if (totalTasks <= 10) {
                            if (percentage >= 80) return "Excellent";
                            if (percentage >= 60) return "Good";
                            return "Normal";
                          } else if (totalTasks <= 30) {
                            if (percentage >= 80) return "Overloaded";
                            if (percentage >= 60) return "High";
                            return "High";
                          } else {
                            if (percentage >= 60) return "Overloaded";
                            return "Overloaded";
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
  );
}
