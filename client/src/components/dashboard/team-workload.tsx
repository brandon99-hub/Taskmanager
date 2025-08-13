import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default function TeamWorkload() {
  const { data: workload = [], isLoading } = useQuery({
    queryKey: ['/api/dashboard/workload'],
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
          <div className="space-y-4">
            {workload.slice(0, 6).map((member: any) => {
              const workloadStatus = getWorkloadStatus(member.workloadPercentage);
              
              return (
                <div 
                  key={member.userId} 
                  className="flex items-center justify-between"
                  data-testid={`workload-member-${member.userId}`}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={member.user.profileImageUrl} />
                      <AvatarFallback className="text-xs">
                        {getInitials(member.user.firstName && member.user.lastName 
                          ? `${member.user.firstName} ${member.user.lastName}`
                          : member.user.email || 'U'
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-gray-900" data-testid={`text-member-name-${member.userId}`}>
                        {member.user.firstName && member.user.lastName 
                          ? `${member.user.firstName} ${member.user.lastName}`
                          : member.user.email
                        }
                      </p>
                      <p className="text-xs text-gray-600" data-testid={`text-member-role-${member.userId}`}>
                        {member.user.role}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-600" data-testid={`text-member-tasks-${member.userId}`}>
                        {member.completedTasks}/{member.totalTasks} tasks
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${getWorkloadColor(member.workloadPercentage)}`}
                          style={{ width: `${Math.min(member.workloadPercentage, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 w-8" data-testid={`text-member-percentage-${member.userId}`}>
                        {member.workloadPercentage}%
                      </span>
                    </div>
                    
                    <Badge 
                      variant={workloadStatus.variant}
                      className="text-xs"
                      data-testid={`badge-workload-status-${member.userId}`}
                    >
                      {workloadStatus.label}
                    </Badge>
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
