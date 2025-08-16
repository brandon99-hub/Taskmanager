import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, User, Settings, Bell } from "lucide-react";

export default function Home() {
  const auth = useAuth() as any;
  const { user } = auth;

  return (
    <div className="min-h-screen bg-background-page">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome back!</h1>
            <p className="text-gray-600 mt-2">
              Hello {user?.firstName || user?.email || 'User'}, ready to manage your projects?
            </p>
          </div>
          <Button 
            variant="outline"
            onClick={() => window.location.href = '/api/logout'}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* User Profile Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              User Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              {user?.profileImageUrl && (
                <img 
                  src={user.profileImageUrl} 
                  alt="Profile" 
                  className="w-16 h-16 rounded-full object-cover"
                  data-testid="img-profile"
                />
              )}
              <div>
                <p className="font-medium text-lg" data-testid="text-username">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email
                  }
                </p>
                <p className="text-gray-600" data-testid="text-email">{user?.email}</p>
                <p className="text-sm text-primary font-medium" data-testid="text-role">
                  Role: {user?.role || 'Employee'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">Dashboard</CardTitle>
              <CardDescription>
                View project metrics and team performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                onClick={() => window.location.href = '/'}
                data-testid="button-dashboard"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">Projects</CardTitle>
              <CardDescription>
                Manage and track your active projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                onClick={() => window.location.href = '/projects'}
                data-testid="button-projects"
              >
                View Projects
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">Milestones</CardTitle>
              <CardDescription>
                View and manage your assigned tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                onClick={() => window.location.href = '/tasks'}
                data-testid="button-tasks"
              >
                View Milestones
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">Reports</CardTitle>
              <CardDescription>
                Generate and export project reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                onClick={() => window.location.href = '/reports'}
                data-testid="button-reports"
              >
                View Reports
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">Team</CardTitle>
              <CardDescription>
                Manage team members and workloads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                onClick={() => window.location.href = '/team'}
                data-testid="button-team"
              >
                View Team
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer opacity-75">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </CardTitle>
              <CardDescription>
                Configure your preferences and notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled data-testid="button-settings">
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
