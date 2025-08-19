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
import { Users, Plus, Mail, UserPlus, Calendar } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100, "Team name too long"),
  description: z.string().optional(),
  segment: z.enum(["academic", "parastals", "private"]).default("private"),
  members: z.array(z.string()).optional(),
});

type CreateTeamData = z.infer<typeof createTeamSchema>;

export default function Team() {
  const auth = useAuth() as any;
  const { user, isAuthenticated, isLoading } = auth;
  const { toast } = useToast();
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [isTeamDetailOpen, setIsTeamDetailOpen] = useState(false);

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

  const [searchTerm, setSearchTerm] = useState("");
  const { data: employees = [], isLoading: employeesLoading } = useQuery<any[]>({
    queryKey: ['/api/users', 'employee', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({ role: 'employee', q: searchTerm, limit: '20' });
      const res = await fetch(`/api/users?${params}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: isCreateTeamOpen && !!isAuthenticated,
  });

  const { data: workload = [], isLoading: workloadLoading, error: workloadError } = useQuery<any[]>({
    queryKey: ['/api/dashboard/workload'],
    enabled: !!isAuthenticated,
  });

  // Fetch team details when a team is selected
  const { data: teamDetails, isLoading: teamDetailsLoading } = useQuery<any>({
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
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: CreateTeamData) => {
      const payload = { ...data, members: selectedMembers };
      const response = await apiRequest("POST", "/api/teams", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setIsCreateTeamOpen(false);
      form.reset();
      setSelectedMembers([]);
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

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const onSubmit = (data: CreateTeamData) => {
    createTeamMutation.mutate(data);
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
              <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary-dark" data-testid="button-create-team">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Team
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Team</DialogTitle>
                    <DialogDescription>
                      Create a new team to organize your projects and members.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Team Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter team name" 
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
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Describe the team's purpose and responsibilities" 
                                {...field} 
                                data-testid="textarea-team-description"
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
                            <FormLabel>Team Segment *</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger data-testid="select-team-segment">
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

                      {/* Members Selector (only for managers/admins) */}
                      <div className="space-y-2">
                        <FormLabel>Members</FormLabel>
                        <Input 
                          placeholder="Search employees by name or email"
                          value={searchTerm}
                          onChange={(e)=> setSearchTerm(e.target.value)}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-auto border rounded-md p-2">
                          {employeesLoading ? (
                            <div className="text-sm text-gray-500">Loading employees…</div>
                          ) : employees.length === 0 ? (
                            <div className="text-sm text-gray-500">No employees found</div>
                          ) : (
                            employees.map((emp: any) => {
                              const checked = selectedMembers.includes(emp.id);
                              return (
                                <label key={emp.id} className="flex items-center space-x-2 p-2 border rounded-md cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setSelectedMembers((prev) => {
                                        if (e.target.checked) return [...prev, emp.id];
                                        return prev.filter((id) => id !== emp.id);
                                      });
                                    }}
                                  />
                                  <span className="text-sm">
                                    {emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : emp.email}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                        {selectedMembers.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedMembers.map((id) => {
                              const emp = employees.find((e: any) => e.id === id);
                              const label = emp ? (emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : emp.email) : id;
                              return (
                                <Badge key={id} variant="secondary" className="text-xs">
                                  {label}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end space-x-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateTeamOpen(false)}
                          data-testid="button-cancel-team"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createTeamMutation.isPending}
                          data-testid="button-submit-team"
                        >
                          {createTeamMutation.isPending ? "Creating..." : "Create Team"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
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
                <p className="text-gray-600">Team members with assigned tasks will appear here</p>
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
                            {member.completedTasks}/{member.totalTasks} tasks
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
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2 text-primary" />
              {selectedTeam?.name} - Team Details
            </DialogTitle>
            <DialogDescription>
              View team members and their performance metrics
            </DialogDescription>
          </DialogHeader>
          
          {teamDetailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : teamDetails ? (
            <div className="space-y-6">
              {/* Team Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Team Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{teamDetails.members?.length || 0}</div>
                      <div className="text-sm text-gray-600">Team Members</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {teamDetails.projects?.length || 0}
                      </div>
                      <div className="text-sm text-gray-600">Active Projects</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {teamDetails.totalTasks || 0}
                      </div>
                      <div className="text-sm text-gray-600">Total Tasks</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Members */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Team Members</CardTitle>
                  <CardDescription>Individual performance and workload</CardDescription>
                </CardHeader>
                <CardContent>
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
                              <p className="font-medium">
                                {member.user?.firstName && member.user?.lastName 
                                  ? `${member.user.firstName} ${member.user.lastName}`
                                  : member.user?.email
                                }
                              </p>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-xs">
                                  {member.user?.role || 'member'}
                                </Badge>
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
                                {member.completedTasks || 0}/{member.totalTasks || 0} tasks
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
