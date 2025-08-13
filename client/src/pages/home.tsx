import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Users, Lock, Eye, LogOut } from "lucide-react";

export default function Home() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-5 h-5 text-red-600" />;
      case 'manager':
        return <Users className="w-5 h-5 text-blue-600" />;
      case 'employee':
        return <Lock className="w-5 h-5 text-green-600" />;
      case 'viewer':
        return <Eye className="w-5 h-5 text-gray-600" />;
      default:
        return <Lock className="w-5 h-5 text-green-600" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'manager':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'employee':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      default:
        return 'bg-green-100 text-green-800 hover:bg-green-200';
    }
  };

  const getRolePermissions = (role: string) => {
    switch (role) {
      case 'admin':
        return [
          'Full system control',
          'Manage all users and roles',
          'Access all projects and data',
          'System configuration',
          'Security settings'
        ];
      case 'manager':
        return [
          'Create and manage projects',
          'Assign tasks to team members',
          'View team progress and metrics',
          'Generate reports',
          'Manage team assignments'
        ];
      case 'employee':
        return [
          'View assigned tasks',
          'Update task progress',
          'Access personal dashboard',
          'View team tasks',
          'Submit status updates'
        ];
      case 'viewer':
        return [
          'View project overviews',
          'Access reports and analytics',
          'Read-only dashboard access',
          'View team performance',
          'Export data (limited)'
        ];
      default:
        return ['Basic access permissions'];
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                AppKings Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Welcome to your internal portal</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/api/logout'}
            className="flex items-center space-x-2"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Button>
        </div>

        {/* User Profile Card */}
        <Card className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your Profile</span>
              <Badge className={getRoleBadgeColor(user?.role || 'employee')}>
                <div className="flex items-center space-x-1">
                  {getRoleIcon(user?.role || 'employee')}
                  <span className="capitalize">{user?.role || 'employee'}</span>
                </div>
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user?.profileImageUrl || ''} alt={user?.firstName || 'User'} />
                <AvatarFallback className="bg-blue-100 text-blue-800 text-lg">
                  {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email || 'User'
                  }
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-2">{user?.email}</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Member since {new Date(user?.createdAt || '').toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role Permissions Card */}
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getRoleIcon(user?.role || 'employee')}
              <span>Your Access Permissions</span>
            </CardTitle>
            <CardDescription>
              Based on your <span className="font-medium capitalize">{user?.role || 'employee'}</span> role, you have the following permissions:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {getRolePermissions(user?.role || 'employee').map((permission, index) => (
                <div 
                  key={index}
                  className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">{permission}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-16 text-center">
          <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 border-0 text-white max-w-md mx-auto">
            <CardContent className="p-4">
              <p className="text-sm text-blue-100">
                AppKings Internal Portal - Secure Access System
              </p>
              <p className="text-xs text-blue-200 mt-1">
                Contact your administrator for role changes or technical support
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}