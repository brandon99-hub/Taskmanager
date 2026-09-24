import { ReactNode } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, BarChart3, Shield, ListChecks, LogOut } from "lucide-react";
import AppSidebar from "@/components/layout/app-sidebar";
import NotificationsMenu from "@/components/layout/notifications-menu";

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const auth = useAuth() as any;
  const { user, getDashboardType, isAdminRole } = auth;

  const getDashboardRoleDisplayName = () => {
    if (user?.roleName) return user.roleName;
    switch (getDashboardType()) {
      case 'segment_leader_academic': return 'Academic Leader';
      case 'segment_leader_parastals': return 'Parastatal Leader';
      case 'segment_leader_private': return 'Private Leader';
      case 'admin': return 'Admin';
      case 'employee': return 'Employee';
      default: return user?.role || 'Employee';
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-surface px-3 sm:px-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <NotificationsMenu />

            <div className="hidden lg:block text-right">
              <p className="text-sm text-gray-700 truncate max-w-32" data-testid="text-user-name">
                {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email}
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
                      {getInitials(user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'U')}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="lg:hidden px-3 py-2 border-b">
                  <p className="text-sm font-medium text-gray-900 truncate" data-testid="mobile-user-name">
                    {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email}
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
                <Link href="/tasks">
                  <DropdownMenuItem data-testid="menu-tasks">
                    <ListChecks className="mr-2 h-4 w-4" />
                    <span>Tasks</span>
                  </DropdownMenuItem>
                </Link>
                {isAdminRole() && (
                  <>
                    <Link href="/executive-dashboard">
                      <DropdownMenuItem data-testid="menu-executive-dashboard">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        <span>Executive Dashboard</span>
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/logs">
                      <DropdownMenuItem data-testid="menu-logs">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>System Logs</span>
                        <Badge variant="secondary" className="ml-2 text-xs">Audit</Badge>
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
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
        </header>

        <div className="flex-1 min-w-0 overflow-x-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
