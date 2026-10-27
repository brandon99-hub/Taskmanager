import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { BarChart3, FolderOpen, Ticket, FileText, Users, Building2, Tags, Layers, Mail, LogOut } from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: typeof BarChart3;
  /** Permission key(s) required to see this item. Omit for items every authenticated user can access. */
  permissions?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { path: "/", label: "Dashboard", icon: BarChart3 },
      { path: "/projects", label: "Projects", icon: FolderOpen },
      { path: "/tickets", label: "Tickets", icon: Ticket },
      { path: "/inbox", label: "Inbox", icon: Mail, permissions: ["inbox.manage"] },
    ],
  },
  {
    label: "Management",
    items: [
      { path: "/companies", label: "Companies", icon: Building2, permissions: ["companies.manage"] },
      { path: "/service-categories", label: "Service Categories", icon: Tags, permissions: ["service_categories.manage"] },
      { path: "/segments", label: "Sectors", icon: Layers, permissions: ["segments.manage"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { path: "/reports", label: "Reports", icon: FileText, permissions: ["reports.view"] },
      { path: "/teams", label: "User Management", icon: Users, permissions: ["users.manage", "teams.manage", "roles.manage"] },
    ],
  },
];

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

export default function AppSidebar() {
  const [location] = useLocation();
  const auth = useAuth() as any;
  const { user, hasAnyPermission, isAdminRole } = auth;
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // A group with no visible items is dropped entirely so users never see an empty section label.
  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.permissions) return true;
        return isAdminRole?.() || hasAnyPermission?.(item.permissions);
      }),
    }))
    .filter((group) => group.items.length > 0);

  // Nested pages (e.g. /tickets/123) keep their section highlighted; "/" must match exactly.
  const isRouteActive = (path: string) =>
    path === "/" ? location === "/" : location === path || location.startsWith(`${path}/`);

  const displayName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email;
  const displayRole = user?.roleName || user?.role;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-slate-100">
        <div className={cn(
          "flex items-center overflow-hidden transition-all duration-200",
          isCollapsed ? "justify-center py-2.5" : "justify-start px-3 py-3"
        )}>
          {isCollapsed ? (
            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-start bg-white border border-slate-200/90 shadow-2xs shrink-0">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-7 max-w-none object-left"
                style={{ width: '110px' }}
              />
            </div>
          ) : (
            <img
              src="/logo.png"
              alt="Ecorenet Logo"
              className="h-9 w-auto max-w-[200px] object-contain"
            />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="scrollbar-modal gap-0 px-2 py-3">
        {visibleGroups.map((group, index) => (
          <SidebarGroup key={group.label} className={cn("p-0", index > 0 && !isCollapsed && "mt-5")}>
            {isCollapsed ? (
              index > 0 && <SidebarSeparator className="mx-0 my-3" />
            ) : (
              <SidebarGroupLabel className="mb-1.5 h-5 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isRouteActive(item.path);
                  return (
                    <SidebarMenuItem key={item.path}>
                      {/* The button carries no padding of its own: the Link fills it, so spacing is set in one place. */}
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn(
                          "group/menu-item relative h-11 rounded-xl p-0 group-data-[collapsible=icon]:!p-0 transition-all duration-200",
                          isActive
                            ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/30 hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                            : "text-slate-500 font-semibold hover:bg-primary/5 hover:text-primary active:bg-primary/10 active:text-primary"
                        )}
                      >
                        <Link
                          href={item.path}
                          aria-current={isActive ? "page" : undefined}
                          data-testid={`nav-${item.path.slice(1) || 'dashboard'}`}
                          className={cn(
                            "flex h-full w-full items-center gap-3.5 rounded-xl px-4",
                            isCollapsed && "justify-center px-0"
                          )}
                        >
                          <Icon className={cn(
                            "h-5 w-5 shrink-0 transition-colors",
                            isActive ? "text-accent-brand" : "text-slate-400 group-hover/menu-item:text-primary"
                          )} />
                          {!isCollapsed && (
                            <span className="truncate text-sm tracking-tight">
                              {item.label}
                            </span>
                          )}
                          {isActive && !isCollapsed && (
                            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary-foreground" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-slate-100 p-2">
        <div className={cn("flex items-center gap-1", isCollapsed && "justify-center")}>
          <Link
            href="/home"
            title="Your profile"
            data-testid="sidebar-user-card"
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-primary/5",
              isCollapsed && "flex-none justify-center p-1"
            )}
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={user?.profileImageUrl} />
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(displayName || 'U')}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{displayRole}</p>
              </div>
            )}
          </Link>
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => logout()}
              aria-label="Log out"
              title="Log out"
              data-testid="button-sidebar-logout"
              className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-primary/5 hover:text-primary"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
