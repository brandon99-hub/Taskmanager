import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { BarChart3, FolderOpen, Ticket, FileText, Users, Building2, Tags, Layers, Mail } from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: typeof BarChart3;
  /** Permission key(s) required to see this item. Omit for items every authenticated user can access. */
  permissions?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "Dashboard", icon: BarChart3 },
  { path: "/companies", label: "Companies", icon: Building2, permissions: ["companies.manage"] },
  { path: "/projects", label: "Projects", icon: FolderOpen },
  { path: "/service-categories", label: "Service Categories", icon: Tags, permissions: ["service_categories.manage"] },
  { path: "/tickets", label: "Tickets", icon: Ticket },
  { path: "/inbox", label: "Inbox", icon: Mail, permissions: ["inbox.manage"] },
  { path: "/reports", label: "Reports", icon: FileText, permissions: ["reports.view"] },
  { path: "/segments", label: "Sectors", icon: Layers, permissions: ["segments.manage"] },
  { path: "/teams", label: "User Management", icon: Users, permissions: ["users.manage", "teams.manage", "roles.manage"] },
];

export default function AppSidebar() {
  const [location] = useLocation();
  const auth = useAuth() as any;
  const { hasAnyPermission, isAdminRole } = auth;
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.permissions) return true;
    return isAdminRole?.() || hasAnyPermission?.(item.permissions);
  });

  // Nested pages (e.g. /tickets/123) keep their section highlighted; "/" must match exactly.
  const isRouteActive = (path: string) =>
    path === "/" ? location === "/" : location === path || location.startsWith(`${path}/`);

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
      <SidebarContent className="scrollbar-modal px-2 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {visibleItems.map((item) => {
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
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
