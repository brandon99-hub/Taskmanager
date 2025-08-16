import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useScreenSize } from "@/hooks/use-mobile";
import { BarChart3, Bell, Home, FolderOpen, CheckSquare, FileText, Users, LogOut, Menu, User, X } from "lucide-react";

export default function Navigation() {
  const auth = useAuth() as any;
  const { user } = auth;
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isMobile, isTablet } = useScreenSize();

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ['/api/notifications'],
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const navigationItems = [
    { path: "/", label: "Dashboard", icon: BarChart3 },
    { path: "/projects", label: "Projects", icon: FolderOpen },
    { path: "/tasks", label: "Milestones", icon: CheckSquare },
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
          <div className="flex items-center min-w-0 flex-1">
            <div className="flex-shrink-0 flex items-center">
              <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-primary mr-2 sm:mr-3" />
              <h1 className="text-lg sm:text-xl font-medium text-gray-900 truncate" data-testid="text-app-title">
                {isMobile ? "AppKings" : "AppKings Dashboard"}
              </h1>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:block ml-10">
              <div className="flex items-baseline space-x-4">
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
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Notifications */}
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
                  {user?.role || 'Employee'}
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
                      {user?.role || 'Employee'}
                    </Badge>
                  </div>
                  <Link href="/home">
                    <DropdownMenuItem data-testid="menu-profile">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
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
