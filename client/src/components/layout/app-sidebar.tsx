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
      <SidebarContent className="justify-center scrollbar-modal px-2 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      size="lg"
                      className={cn(
                        "group/menu-item transition-all duration-150 rounded-xl",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70",
                        isCollapsed && "justify-center"
                      )}
                    >
                      <Link
                        href={item.path}
                        data-testid={`nav-${item.path.slice(1) || 'dashboard'}`}
                        className={cn(
                          "flex items-center gap-3 w-full rounded-xl px-3 py-2.5 relative",
                          isCollapsed && "justify-center px-0"
                        )}
                      >
                        {isActive && !isCollapsed && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-accent-brand" />
                        )}
                        <Icon className={cn(
                          "w-5 h-5 shrink-0 transition-colors",
                          isCollapsed && isActive && "rounded-lg bg-primary/15 text-accent-brand p-0.5 w-7 h-7 ring-1 ring-primary/25",
                          !isCollapsed && (isActive ? "text-accent-brand" : "text-slate-500 group-hover/menu-item:text-slate-800")
                        )} />
                        {!isCollapsed && (
                          <span className="truncate text-sm font-medium tracking-tight">
                            {item.label}
                          </span>
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
