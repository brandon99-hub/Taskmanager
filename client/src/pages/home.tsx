import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  User, 
  Settings, 
  Shield, 
  Key, 
  Calendar,
  Camera,
  LogOut,
  Clock,
  Mail,
  Users,
  Bell,
  ExternalLink
} from "lucide-react";
import PasswordChangeModal from "@/components/profile/password-change-modal";
import NotificationPreferences from "@/components/profile/notification-preferences";
import GoogleCalendarIntegration from "@/components/profile/google-calendar-integration";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const auth = useAuth() as any;
  const { user } = auth;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'employee': return 'secondary';
      default: return 'outline';
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST', 
        credentials: 'include' 
      });
      setLocation('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setLocation('/login');
    }
  };

  // Test notification function
  const createTestNotifications = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/notifications/test');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Created ${data.count} test notifications. Check the bell icon in the navbar!`,
      });
      // Invalidate notifications query to refresh the count
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create test notifications",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setLocation('/')}
                className="text-gray-600 hover:text-gray-900"
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
            <div className="flex items-center space-x-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900" data-testid="header-user-name">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email
                  }
                </p>
                <Badge variant={getRoleBadgeVariant(user?.role)} className="text-xs">
                  {user?.role || 'Employee'}
                </Badge>
              </div>
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImageUrl} />
                <AvatarFallback className="text-xs">
                  {getInitials(user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email || 'U'
                  )}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Profile Header Section */}
        <div className="mb-6 sm:mb-8">
          <Card className="bg-white shadow-sm border-0 shadow-md">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
                <div className="relative mx-auto sm:mx-0">
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-white shadow-lg">
                    <AvatarImage src={user?.profileImageUrl} />
                    <AvatarFallback className="text-xl sm:text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {getInitials(user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}`
                        : user?.email || 'U'
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute -bottom-2 -right-2 h-7 w-7 sm:h-8 sm:w-8 rounded-full shadow-lg"
                    data-testid="button-change-avatar"
                  >
                    <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-1" data-testid="profile-user-name">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email || 'User'
                    }
                  </h1>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-3">
                    <Badge variant={getRoleBadgeVariant(user?.role)} className="text-sm" data-testid="profile-user-role">
                      {user?.role || 'Employee'}
                    </Badge>
                    <span className="text-gray-500 hidden sm:inline">•</span>
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">{user?.email}</span>
                      <span className="sm:hidden">{user?.email?.split('@')[0]}...</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start text-sm text-gray-500">
                    <Clock className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Last login: </span>
                    {user?.lastLoginAt 
                      ? new Date(user.lastLoginAt).toLocaleDateString()
                      : 'Never'
                    }
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-gray-900 w-full sm:w-auto"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          
          {/* Account Security */}
          <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <Shield className="h-5 w-5 mr-2 text-blue-600" />
                Account Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsPasswordModalOpen(true)}
                data-testid="button-change-password"
              >
                <Key className="h-4 w-4 mr-2" />
                Change Password
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled
              >
                <Clock className="h-4 w-4 mr-2" />
                Login History
                <Badge variant="secondary" className="ml-auto text-xs">Soon</Badge>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled
              >
                <Shield className="h-4 w-4 mr-2" />
                Two-Factor Auth
                <Badge variant="secondary" className="ml-auto text-xs">Soon</Badge>
              </Button>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <Bell className="h-5 w-5 mr-2 text-blue-600" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NotificationPreferences />
              
              {/* Test Notifications Button */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createTestNotifications.mutate()}
                  disabled={createTestNotifications.isPending}
                  className="w-full text-xs"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  {createTestNotifications.isPending ? 'Creating...' : 'Create Test Notifications'}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Click to create sample notifications for testing
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Integrations */}
          <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <Calendar className="h-5 w-5 mr-2 text-purple-600" />
                Integrations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GoogleCalendarIntegration />
              
              <Button
                variant="outline"
                className="w-full justify-start mt-3"
                disabled
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Microsoft Teams
                <Badge variant="secondary" className="ml-auto text-xs">Future</Badge>
              </Button>
            </CardContent>
          </Card>



        </div>

        {/* Account Info Footer */}
        <Card className="mt-6 sm:mt-8 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm text-gray-500 space-y-3 sm:space-y-0">
              <div className="text-center sm:text-left">
                Account created: {user?.createdAt 
                  ? new Date(user.createdAt).toLocaleDateString()
                  : 'Unknown'
                }
              </div>
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 text-center sm:text-left">
                <span>TaskFlow v1.0</span>
                <Separator orientation="horizontal" className="w-full sm:hidden" />
                <Separator orientation="vertical" className="hidden sm:block h-4" />
                <span>© 2024 AppKings Solutions</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Password Change Modal */}
      <PasswordChangeModal 
        open={isPasswordModalOpen}
        onOpenChange={setIsPasswordModalOpen}
      />
    </div>
  );
}
