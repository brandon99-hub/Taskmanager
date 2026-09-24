import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Users, 
  Calendar, 
  BarChart3, 
  User, 
  Briefcase, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Target,
  Zap,
  Star,
  Award,
  Activity,
  Globe,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  Eye,
  Filter,
  Search
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function TeamDetail() {
  const { teamId } = useParams();
  const [, setLocation] = useLocation();
  const auth = useAuth() as any;
  const { user, isAuthenticated, isLoading } = auth;
  const { toast } = useToast();
  
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isMemberDetailOpen, setIsMemberDetailOpen] = useState(false);

  // Fetch member assignments (projects + subtasks across all teams)
  const { data: memberAssignments, isLoading: memberAssignmentsLoading } = useQuery<any>({
    queryKey: ['/api/users', selectedMember?.userId, 'assignments'],
    queryFn: async () => {
      if (!selectedMember?.userId) return null;
      const res = await fetch(`/api/users/${selectedMember.userId}/assignments`, {
        credentials: 'include', 
        cache: 'no-store' 
      });
      if (!res.ok) throw new Error('Failed to fetch member assignments');
      return res.json();
    },
    enabled: !!selectedMember?.userId && isMemberDetailOpen,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: segmentsList = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/segments'],
    enabled: !!isAuthenticated,
  });
  const segmentNameById: Record<string, string> = Object.fromEntries(segmentsList.map((s) => [s.id, s.name]));

  // Fetch team details
  const { data: teamDetails, isLoading: teamDetailsLoading, error: teamDetailsError } = useQuery<any>({
    queryKey: ['/api/teams', teamId, 'details'],
    queryFn: async () => {
      if (!teamId) return null;
      const res = await fetch(`/api/teams/${teamId}`, { 
        credentials: 'include', 
        cache: 'no-store' 
      });
      if (!res.ok) throw new Error('Failed to fetch team details');
      return res.json();
    },
    enabled: !!teamId && isAuthenticated,
  });

  const handleMemberClick = (member: any) => {
    setSelectedMember(member);
    setIsMemberDetailOpen(true);
  };

  const handleBackClick = () => {
    setLocation('/teams');
  };

  if (teamDetailsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="h-64 bg-gray-200 rounded"></div>
                </div>
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (teamDetailsError || !teamDetails) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Team Not Found</h1>
              <p className="text-gray-600 mb-6">The team you're looking for doesn't exist or you don't have access to it.</p>
              <Button onClick={handleBackClick} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Teams
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { team, members, projects, totalTasks } = teamDetails;
  const allUserProjects = selectedMember && memberAssignments?.projects ? memberAssignments.projects : projects;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700"></div>
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <Button 
                onClick={handleBackClick} 
                variant="outline" 
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Teams
              </Button>
              <div className="flex items-center space-x-3">
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Users className="w-3 h-3 mr-1" />
                  {members.length} Members
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30 backdrop-blur-sm">
                  <Activity className="w-3 h-3 mr-1" />
                  Active Team
                </Badge>
              </div>
            </div>
            
            <div className="text-white">
              <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                {team.name}
              </h1>
              <p className="text-xl text-blue-100 mb-6 max-w-2xl">
                {team.description || 'A high-performing team dedicated to delivering exceptional results and driving innovation forward.'}
              </p>
              
              {/* Quick Stats */}
              <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-100">All systems operational</span>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-green-100">Performance trending up</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-100">High performance team</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 -mt-16 relative z-10">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Team Members</p>
                    <p className="text-3xl font-bold text-gray-900">{members.length}</p>
                    <p className="text-xs text-green-600 mt-1">Active team</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Active Projects</p>
                    <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
                    <p className="text-xs text-blue-600 mt-1">{projects.filter((p: any) => p.status === 'active').length} active</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
                    <Briefcase className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Total Tasks</p>
                    <p className="text-3xl font-bold text-gray-900">{totalTasks}</p>
                    <p className="text-xs text-purple-600 mt-1">Total subtasks</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Success Rate</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {totalTasks > 0 ? Math.round((members.reduce((sum: number, member: any) => sum + member.completedTasks, 0) / totalTasks) * 100) : 0}%
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      {totalTasks > 0 ? Math.round((members.reduce((sum: number, member: any) => sum + member.completedTasks, 0) / totalTasks) * 100) : 0}% completion
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl">
                    <Award className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Enhanced Team Members Section */}
            <div className="xl:col-span-2">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center text-2xl font-bold text-gray-900">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg mr-3">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        Team Members
                      </CardTitle>
                      <CardDescription className="text-gray-600 mt-2">
                        Click on any member to view their detailed assignments and performance metrics
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" className="bg-white/50">
                        <Filter className="w-4 h-4 mr-2" />
                        Filter
                      </Button>
                      <Button variant="outline" size="sm" className="bg-white/50">
                        <Search className="w-4 h-4 mr-2" />
                        Search
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {members.map((member: any, index: number) => (
                      <div
                        key={member.userId}
                        onClick={() => handleMemberClick(member)}
                        className="group relative p-6 bg-gradient-to-r from-white to-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg cursor-pointer transition-all duration-300 hover:-translate-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <Avatar className="h-14 w-14 ring-4 ring-white shadow-lg">
                                <AvatarImage src={member.user.avatar} />
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg">
                                  {(member.user.firstName && member.user.lastName 
                                    ? `${member.user.firstName} ${member.user.lastName}`
                                    : member.user.email
                                  )?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 text-lg">
                              {member.user.firstName && member.user.lastName 
                                ? `${member.user.firstName} ${member.user.lastName}`
                                : member.user.email
                              }
                            </h3>
                              <p className="text-gray-600 text-sm flex items-center">
                                <Mail className="w-3 h-3 mr-1" />
                                {member.user.email}
                              </p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    member.role === 'BC Developer' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                    member.role === 'Functional Consultant' ? 'bg-green-100 text-green-800 border-green-200' :
                                    member.role === 'Portal Developer' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                    member.role === 'Account Manager' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                    member.role === 'Project Leader' ? 'bg-red-100 text-red-800 border-red-200' :
                                    'bg-gray-100 text-gray-800 border-gray-200'
                                  }`}
                                >
                                  {member.role}
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                                  <Zap className="w-3 h-3 mr-1" />
                                  Active
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">{member.workloadPercentage}%</p>
                                <p className="text-xs text-gray-600">Workload</p>
                              </div>
                              <div className="w-20">
                                <Progress 
                                  value={member.workloadPercentage} 
                                  className="h-2 bg-gray-200"
                                />
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span className="flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                                {member.completedTasks} completed
                              </span>
                              <span className="flex items-center">
                                <Clock className="w-3 h-3 mr-1 text-blue-500" />
                                {member.totalTasks - member.completedTasks} pending
                              </span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors ml-auto mt-2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Projects Section */}
            <div>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-xl font-bold text-gray-900">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg mr-3">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    Active Projects
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Projects currently assigned to this team
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projects.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Briefcase className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">No projects assigned yet</p>
                      </div>
                    ) : (
                      projects.map((project: any) => (
                        <div key={project.id} className="group p-4 bg-gradient-to-r from-white to-gray-50 rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-md transition-all duration-300">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 text-sm mb-1">{project.name}</h4>
                              <p className="text-xs text-gray-600 flex items-center mb-2">
                                <Globe className="w-3 h-3 mr-1" />
                                {project.client}
                              </p>
                            </div>
                            <Badge 
                              variant={project.status === 'active' ? 'default' : 'secondary'}
                              className="text-xs bg-green-100 text-green-800 border-green-200"
                            >
                              {project.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                              {segmentNameById[project.segmentId] || 'Unassigned'}
                            </Badge>
                            <Button variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-blue-600">
                              <Eye className="w-3 h-3 mr-1" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Member Detail Modal */}
      <Dialog open={isMemberDetailOpen} onOpenChange={setIsMemberDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white to-gray-50">
          <DialogHeader className="border-b border-gray-200 pb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="h-16 w-16 ring-4 ring-blue-100">
                  <AvatarImage src={selectedMember?.user?.avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-xl">
                    {(selectedMember?.user?.firstName && selectedMember?.user?.lastName 
                      ? `${selectedMember.user.firstName} ${selectedMember.user.lastName}`
                      : selectedMember?.user?.email
                    )?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-3 border-white flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex-1">
                <DialogTitle className="text-3xl font-bold text-gray-900 mb-2">
                  {selectedMember?.user?.firstName && selectedMember?.user?.lastName 
                    ? `${selectedMember.user.firstName} ${selectedMember.user.lastName}`
                    : selectedMember?.user?.email
                  }
                </DialogTitle>
                <DialogDescription className="text-lg text-gray-600">
                  {selectedMember?.role} • Complete performance breakdown and project assignments
                </DialogDescription>
                <div className="flex items-center space-x-4 mt-3">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    <Mail className="w-3 h-3 mr-1" />
                    {selectedMember?.user?.email}
                  </Badge>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                    <Zap className="w-3 h-3 mr-1" />
                    Active Member
                  </Badge>
                </div>
              </div>
            </div>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-8">
              {/* Enhanced Performance Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-700 mb-1">Total Tasks</p>
                        <p className="text-3xl font-bold text-blue-900">{selectedMember.totalTasks}</p>
                        <p className="text-xs text-blue-600 mt-1">Assigned</p>
                      </div>
                      <div className="p-3 bg-blue-500 rounded-xl">
                        <Target className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-700 mb-1">Completed</p>
                        <p className="text-3xl font-bold text-green-900">{selectedMember.completedTasks}</p>
                        <p className="text-xs text-green-600 mt-1">Finished</p>
                      </div>
                      <div className="p-3 bg-green-500 rounded-xl">
                        <CheckCircle className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-700 mb-1">In Progress</p>
                        <p className="text-3xl font-bold text-orange-900">{selectedMember.totalTasks - selectedMember.completedTasks}</p>
                        <p className="text-xs text-orange-600 mt-1">Pending</p>
                      </div>
                      <div className="p-3 bg-orange-500 rounded-xl">
                        <Clock className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-700 mb-1">Success Rate</p>
                        <p className="text-3xl font-bold text-purple-900">{selectedMember.workloadPercentage}%</p>
                        <p className="text-xs text-purple-600 mt-1">Performance</p>
                      </div>
                      <div className="p-3 bg-purple-500 rounded-xl">
                        <Award className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Enhanced Role & Contact Information */}
              <Card className="bg-gradient-to-r from-gray-50 to-blue-50 border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl font-bold text-gray-900">
                    <div className="p-2 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg mr-3">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    Professional Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">Role & Position</p>
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                          {selectedMember.role}
                        </Badge>
                        <Star className="w-4 h-4 text-yellow-500" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">Contact Email</p>
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{selectedMember.user.email}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">Status</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="font-medium text-green-700">Active & Available</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Project Assignments */}
              <Card className="bg-white border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl font-bold text-gray-900">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg mr-3">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    Project Assignments & Task Breakdown
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Detailed view of all projects and assigned subtasks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {projects.map((project: any) => (
                      <div key={project.id} className="border border-gray-200 rounded-xl p-6 bg-gradient-to-r from-white to-gray-50 hover:shadow-md transition-all duration-300">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 text-lg mb-2">{project.name}</h4>
                            <p className="text-gray-600 flex items-center mb-3">
                              <Globe className="w-4 h-4 mr-2" />
                              {project.client}
                            </p>
                            <div className="flex items-center space-x-3">
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                {project.status}
                              </Badge>
                              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                                {segmentNameById[project.segmentId] || 'Unassigned'}
                              </Badge>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="bg-white/50">
                            <Eye className="w-4 h-4 mr-2" />
                            View Project
                          </Button>
                        </div>
                        
                        {/* Enhanced Subtasks Section */}
                        <div className="space-y-3">
                          <h5 className="font-semibold text-gray-800 flex items-center">
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Assigned Subtasks
                          </h5>
                          {memberAssignmentsLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            </div>
                          ) : memberAssignments ? (
                            <div className="space-y-2">
                              {(memberAssignments.subtasks || [])
                                .filter((subtask: any) => subtask.project?.id === project.id)
                                .slice(0, 5)
                                .map((subtask: any, index: number) => {
                                  const getStatusColor = (status: string) => {
                                    switch (status) {
                                      case 'completed': return 'from-green-50 to-green-100 border-green-200';
                                      case 'in_progress': return 'from-blue-50 to-blue-100 border-blue-200';
                                      case 'fc_review': return 'from-orange-50 to-orange-100 border-orange-200';
                                      case 'client_review': return 'from-purple-50 to-purple-100 border-purple-200';
                                      case 'overdue': return 'from-red-50 to-red-100 border-red-200';
                                      default: return 'from-gray-50 to-gray-100 border-gray-200';
                                    }
                                  };
                                  
                                  const getBadgeColor = (status: string) => {
                                    switch (status) {
                                      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
                                      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
                                      case 'fc_review': return 'bg-orange-100 text-orange-800 border-orange-200';
                                      case 'client_review': return 'bg-purple-100 text-purple-800 border-purple-200';
                                      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
                                      default: return 'bg-gray-100 text-gray-800 border-gray-200';
                                    }
                                  };

                                  const getStatusText = (status: string) => {
                                    switch (status) {
                                      case 'completed': return 'Completed';
                                      case 'in_progress': return 'In Progress';
                                      case 'fc_review': return 'FC Review';
                                      case 'client_review': return 'Client Review';
                                      case 'overdue': return 'Overdue';
                                      default: return status.charAt(0).toUpperCase() + status.slice(1);
                                    }
                                  };

                                  return (
                                    <div key={subtask.id} className={`flex items-center justify-between p-3 bg-gradient-to-r ${getStatusColor(subtask.status)} rounded-lg border`}>
                                      <div className="flex items-center space-x-3">
                                        <div className={`w-2 h-2 rounded-full ${
                                          subtask.status === 'completed' ? 'bg-green-500' :
                                          subtask.status === 'in_progress' ? 'bg-blue-500' :
                                          subtask.status === 'fc_review' ? 'bg-orange-500' :
                                          subtask.status === 'client_review' ? 'bg-purple-500' :
                                          subtask.status === 'overdue' ? 'bg-red-500' :
                                          'bg-gray-500'
                                        }`}></div>
                                        <span className="font-medium text-gray-900">{subtask.name}</span>
                                      </div>
                                      <div className="flex items-center space-x-3">
                                        <Badge className={getBadgeColor(subtask.status)}>
                                          {getStatusText(subtask.status)}
                                        </Badge>
                                        <span className="text-sm text-gray-600">
                                          {subtask.dueDate ? `Due: ${new Date(subtask.dueDate).toLocaleDateString()}` : 'No due date'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              {(memberAssignments.subtasks || []).filter((subtask: any) => subtask.project?.id === project.id).length === 0 && (
                                <div className="text-center py-4 text-gray-500">
                                  <p>No subtasks assigned to this member</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500">
                              <p>Failed to load subtasks</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
