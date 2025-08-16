import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useScreenSize } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, Star } from "lucide-react";

export default function TeamWorkload() {
  const auth = useAuth() as any;
  const { user } = auth;
  const { isMobile, isTablet } = useScreenSize();
  const { data: workload = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/dashboard/workload'],
  });

  // For admin/manager: get best performing team
  const { data: bestTeam, isLoading: bestTeamLoading } = useQuery<{
    teamId: string;
    team: { id: string; name: string; description?: string };
    completionRate: number;
    onTimeDeliveryRate: number;
    overallScore: number;
    members: any[];
  } | null>({
    queryKey: ['/api/dashboard/best-team'],
    enabled: user?.role !== 'employee',
  });

  const getWorkloadColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-error';
    if (percentage >= 75) return 'bg-warning';
    return 'bg-success';
  };

  const getWorkloadStatus = (percentage: number) => {
    if (percentage >= 90) return { label: 'Overloaded', variant: 'destructive' as const };
    if (percentage >= 75) return { label: 'High', variant: 'secondary' as const };
    if (percentage >= 50) return { label: 'Normal', variant: 'outline' as const };
    return { label: 'Light', variant: 'outline' as const };
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading) {
    return (
      <Card className="bg-surface shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Team Workload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-20 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 h-2 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-8"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (user?.role === 'employee' && workload.length === 0) {
    return null;
  }

  // For admin/manager, show best performing team if available
  if (user?.role !== 'employee' && bestTeam && !bestTeamLoading) {
    return (
      <Card className="bg-surface shadow-sm border border-gray-200" data-testid="best-team">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between" data-testid="text-best-team-title">
            <div className="flex items-center">
              <Trophy className="h-5 w-5 mr-2 text-amber-500" />
              Best Performing Team
            </div>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Star className="h-3 w-3" />
              <span>{bestTeam.overallScore}% score</span>
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <h3 className="font-medium text-amber-900">{bestTeam.team.name}</h3>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-amber-700">Completion: {bestTeam.completionRate}%</span>
              <span className="text-amber-700">On-Time: {bestTeam.onTimeDeliveryRate}%</span>
            </div>
          </div>
          
                      <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Top Team Members</h4>
              {bestTeam.members.slice(0, isMobile ? 3 : 4).map((member) => (
                <div key={member.userId} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <Avatar className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} flex-shrink-0`}>
                      <AvatarImage src={member.user.profileImageUrl} />
                      <AvatarFallback className="text-xs">
                        {getInitials(member.user.firstName && member.user.lastName 
                          ? `${member.user.firstName} ${member.user.lastName}`
                          : member.user.email || 'U'
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-900 truncate`}>
                        {member.user.firstName && member.user.lastName 
                          ? `${member.user.firstName} ${member.user.lastName}`
                          : member.user.email
                        }
                      </p>
                      <p className="text-xs text-gray-600">
                        {member.completedTasks}/{member.totalTasks} tasks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <div className={`${isMobile ? 'w-12' : 'w-16'} bg-gray-200 rounded-full h-2`}>
                      <div 
                        className={`h-2 rounded-full ${getWorkloadColor(member.workloadPercentage)}`}
                        style={{ width: `${Math.min(member.workloadPercentage, 100)}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs text-gray-600 ${isMobile ? 'w-6' : 'w-8'}`}>
                      {member.workloadPercentage}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface shadow-sm border border-gray-200" data-testid="team-workload">
      <CardHeader>
        <CardTitle className="text-lg flex items-center" data-testid="text-workload-title">
          <Users className="h-5 w-5 mr-2" />
          Team Workload
        </CardTitle>
      </CardHeader>
      <CardContent>
        {workload.length === 0 ? (
          <div className="text-center py-8 text-gray-500" data-testid="text-no-workload">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p>No workload data available</p>
          </div>
        ) : (
          <div className={`space-y-${isMobile ? '3' : '4'}`}>
            {workload.slice(0, isMobile ? 4 : 6).map((member: any) => {
              const workloadStatus = getWorkloadStatus(member.workloadPercentage);
              
              return (
                <div 
                  key={member.userId} 
                  className={`flex items-center ${isMobile ? 'flex-col space-y-2' : 'justify-between'}`}
                  data-testid={`workload-member-${member.userId}`}
                >
                  <div className={`flex items-center space-x-2 sm:space-x-3 ${isMobile ? 'w-full' : 'min-w-0 flex-1'}`}>
                    <Avatar className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} flex-shrink-0`}>
                      <AvatarImage src={member.user.profileImageUrl} />
                      <AvatarFallback className="text-xs">
                        {getInitials(member.user.firstName && member.user.lastName 
                          ? `${member.user.firstName} ${member.user.lastName}`
                          : member.user.email || 'U'
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-900 truncate`} data-testid={`text-member-name-${member.userId}`}>
                        {member.user.firstName && member.user.lastName 
                          ? `${member.user.firstName} ${member.user.lastName}`
                          : member.user.email
                        }
                      </p>
                      <p className="text-xs text-gray-600" data-testid={`text-member-role-${member.userId}`}>
                        {member.user.role}
                      </p>
                    </div>
                    {isMobile && (
                      <Badge 
                        variant={workloadStatus.variant}
                        className="text-xs flex-shrink-0"
                        data-testid={`badge-workload-status-${member.userId}`}
                      >
                        {workloadStatus.label}
                      </Badge>
                    )}
                  </div>
                  
                  <div className={`flex items-center ${isMobile ? 'w-full justify-between' : 'space-x-3'}`}>
                    <div className={`${isMobile ? 'text-left' : 'text-right'}`}>
                      <p className="text-xs text-gray-600" data-testid={`text-member-tasks-${member.userId}`}>
                        {member.completedTasks}/{member.totalTasks} tasks
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className={`${isMobile ? 'w-20' : 'w-16'} bg-gray-200 rounded-full h-2`}>
                        <div 
                          className={`h-2 rounded-full ${getWorkloadColor(member.workloadPercentage)}`}
                          style={{ width: `${Math.min(member.workloadPercentage, 100)}%` }}
                        ></div>
                      </div>
                      <span className={`text-xs text-gray-600 ${isMobile ? 'w-6' : 'w-8'}`} data-testid={`text-member-percentage-${member.userId}`}>
                        {member.workloadPercentage}%
                      </span>
                    </div>
                    
                    {!isMobile && (
                      <Badge 
                        variant={workloadStatus.variant}
                        className="text-xs"
                        data-testid={`badge-workload-status-${member.userId}`}
                      >
                        {workloadStatus.label}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
            
            {workload.length > 6 && (
              <div className="text-center pt-2">
                <Badge variant="outline" data-testid="badge-more-members">
                  +{workload.length - 6} more team members
                </Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
