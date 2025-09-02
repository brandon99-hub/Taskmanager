import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useScreenSize } from "@/hooks/use-mobile";
import { BarChart3, Bell, Home, FolderOpen, CheckSquare, FileText, Users, LogOut, Menu, User, X, Check, CheckCheck, Clock, AlertTriangle, Info, FileSignature } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Navigation() {
  const auth = useAuth() as any;
  const { user, getDashboardType, isAdminRole } = auth;
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { isMobile, isTablet } = useScreenSize();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get the user's dashboard role display name
  const getDashboardRoleDisplayName = () => {
    const dashboardType = getDashboardType();
    switch (dashboardType) {
      case 'project_manager': return 'Project Manager';
      case 'finance_head': return 'Finance Head';
      case 'segment_leader_academic': return 'Academic Leader';
      case 'segment_leader_parastals': return 'Parastatal Leader';
      case 'segment_leader_private': return 'Private Leader';
      case 'admin': return 'Admin';
      case 'employee': return 'Employee';
      default: return user?.role || 'Employee';
    }
  };

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/notifications');
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch user notification preferences to filter notifications
  const { data: notificationPreferences } = useQuery<any>({
    queryKey: ['/api/user/notification-preferences'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/notification-preferences');
      return response.json();
    },
    enabled: !!user,
  });

  // Filter notifications based on user preferences
  const filteredNotifications = notifications.filter((notification) => {
    if (!notificationPreferences) return true; // Show all if preferences not loaded yet
    
    switch (notification.type) {
      case 'task_assigned':
        return notificationPreferences.inAppTaskAssigned;
      case 'task_due_soon':
        return notificationPreferences.inAppTaskDueSoon;
      case 'task_overdue':
        return notificationPreferences.inAppTaskOverdue;
      case 'project_deadline':
        return notificationPreferences.inAppProjectDeadline;
      case 'team_update':
        return notificationPreferences.inAppTeamUpdates;
      default:
        return true; // Show unknown types
    }
  });

  const unreadCount = filteredNotifications.filter((n: any) => !n.isRead).length;

  // Refresh notifications when preferences change
  useEffect(() => {
    if (notificationPreferences) {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  }, [notificationPreferences, queryClient]);

  // Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest('PUT', `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('PUT', '/api/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    },
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <Check className="h-4 w-4 text-blue-500" />;
      case 'task_overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'project_deadline':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatNotificationTime = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const navigationItems = [
    { path: "/", label: "Dashboard", icon: BarChart3 },
    { path: "/projects", label: "Projects", icon: FolderOpen },
    { path: "/tasks", label: getDashboardType() === 'project_manager' ? "Modules" : "Milestones", icon: CheckSquare },
    ...(user?.role !== 'employee' ? [{ path: "/reports", label: "Reports", icon: FileText }] : []),
    { path: "/team", label: "Team", icon: Users },
  ];

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const NavContent = () => (
    <>
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.path;
        
        return (
          <Link key={item.path} href={item.path}>
            <Button
              variant={isActive ? "default" : "ghost"}
              className={`w-full justify-start ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              onClick={() => setIsMobileMenuOpen(false)}
              data-testid={`nav-${item.path.slice(1) || 'dashboard'}`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </>
  );

  return (
    <nav className="bg-surface shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16">
          {/* Left side - Logo and Brand */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              {/* AppKings Logo */}
              <img 
                src="/Appkings.png" 
                alt="AppKings Logo" 
                className="h-16 w-auto mr-4"
              />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate" data-testid="text-app-title">
                {isMobile ? "AppKings" : "AppKings Solutions"}
              </h1>
            </div>
          </div>
          
          {/* Center - Desktop Navigation */}
          <div className="hidden md:flex items-center justify-center flex-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  
                  return (
                    <Link key={item.path} href={item.path}>
                      <Button
                        variant="ghost"
                        className={`${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'} transition-colors`}
                        data-testid={`nav-desktop-${item.path.slice(1) || 'dashboard'}`}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
          </div>
          
          {/* Right side with logo and user menu */}
          <div className="flex items-center space-x-4">
            
            {/* Notifications */}
            <DropdownMenu open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size={isMobile ? "sm" : "sm"}
                  className="relative text-gray-600 hover:text-gray-900 p-2"
                  data-testid="button-notifications"
                >
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                  {unreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center text-xs p-0 min-w-0"
                      data-testid="badge-notification-count"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="end" className="w-80 max-h-96">
                <div className="flex items-center justify-between p-3 border-b">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    {notificationPreferences && (
                      <Badge variant="outline" className="text-xs text-gray-500">
                        Filtered
                      </Badge>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      disabled={markAllAsReadMutation.isPending}
                      className="text-xs text-blue-600 hover:text-blue-700 p-1 h-auto"
                    >
                      {markAllAsReadMutation.isPending ? 'Marking...' : 'Mark all read'}
                    </Button>
                  )}
                </div>
                
                {/* Info about filtering */}
                {notificationPreferences && (
                  <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
                    <p className="text-xs text-blue-700">
                      Showing only notifications you've enabled in your preferences
                    </p>
                  </div>
                )}
                
                <ScrollArea className="max-h-96">
                  {filteredNotifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">
                        {notifications.length === 0 
                          ? 'No notifications yet' 
                          : 'No notifications match your current preferences'
                        }
                      </p>
                      {notifications.length > 0 && filteredNotifications.length === 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          Check your notification preferences in Profile settings
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-1">
                      {filteredNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-3 rounded-lg transition-colors ${
                            notification.isRead 
                              ? 'bg-gray-50 hover:bg-gray-100' 
                              : 'bg-blue-50 hover:bg-blue-100'
                          } ${!notification.isRead ? 'border-l-4 border-blue-500' : ''}`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getNotificationIcon(notification.type)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <p className={`text-sm font-medium ${
                                  notification.isRead ? 'text-gray-700' : 'text-gray-900'
                                }`}>
                                  {notification.title}
                                </p>
                                
                                {!notification.isRead && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleMarkAsRead(notification.id)}
                                    disabled={markAsReadMutation.isPending}
                                    className="text-xs text-blue-600 hover:text-blue-700 p-1 h-auto ml-2"
                                  >
                                    <CheckCheck className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              
                              <p className={`text-sm mt-1 ${
                                notification.isRead ? 'text-gray-600' : 'text-gray-700'
                              }`}>
                                {notification.message}
                              </p>
                              
                              <p className="text-xs text-gray-500 mt-2">
                                {formatNotificationTime(notification.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* User Profile */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="hidden lg:block text-right">
                <p className="text-sm text-gray-700 truncate max-w-32" data-testid="text-user-name">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email
                  }
                </p>
                <Badge variant="outline" className="text-xs" data-testid="badge-user-role">
                  {getDashboardRoleDisplayName()}
                </Badge>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-7 w-7 sm:h-8 sm:w-8 rounded-full" data-testid="button-user-menu">
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                      <AvatarImage src={user?.profileImageUrl} />
                      <AvatarFallback className="text-xs">
                        {getInitials(user?.firstName && user?.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user?.email || 'U'
                        )}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* Show user info on mobile/tablet since it's hidden in header */}
                  <div className="lg:hidden px-3 py-2 border-b">
                    <p className="text-sm font-medium text-gray-900 truncate" data-testid="mobile-user-name">
                      {user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}`
                        : user?.email
                      }
                    </p>
                    <Badge variant="outline" className="text-xs mt-1" data-testid="mobile-user-role">
                      {getDashboardRoleDisplayName()}
                    </Badge>
                  </div>
                  <Link href="/home">
                    <DropdownMenuItem data-testid="menu-profile">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                  </Link>
                  {/* Admin Menu Items - Only for Admin and Manager */}
                  {isAdminRole() && (
                    <>
                      <Link href="/contracts">
                        <DropdownMenuItem data-testid="menu-contracts">
                          <FileSignature className="mr-2 h-4 w-4" />
                          <span>Contracts</span>
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/executive-dashboard">
                        <DropdownMenuItem data-testid="menu-executive-dashboard">
                          <BarChart3 className="mr-2 h-4 w-4" />
                          <span>Executive Dashboard</span>
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem 
                    onClick={async () => {
                      try {
                        await fetch('/api/auth/logout', { 
                          method: 'POST', 
                          credentials: 'include' 
                        });
                        window.location.href = '/login';
                      } catch (error) {
                        console.error('Logout error:', error);
                        window.location.href = '/login';
                      }
                    }}
                    data-testid="menu-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Mobile Menu */}
            <div className="md:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2" data-testid="button-mobile-menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 sm:w-80">
                  <SheetHeader className="text-left pb-4">
                    <SheetTitle className="flex items-center">
                      <BarChart3 className="h-6 w-6 text-primary mr-2" />
                      AppKings Dashboard
                    </SheetTitle>
                  </SheetHeader>
                  <div className="py-4">
                    <div className="space-y-1">
                      <NavContent />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
