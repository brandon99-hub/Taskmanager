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
import { BarChart3, FolderOpen, Ticket, FileText, Users, Building2, Tags, Layers } from "lucide-react";

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
      <SidebarHeader>
        <div className={cn(
          "flex items-center overflow-hidden transition-all duration-200",
          isCollapsed ? "justify-center p-2" : "justify-start px-3 py-2.5"
        )}>
          {isCollapsed ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-start bg-white border border-slate-200/90 shadow-2xs shrink-0">
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
      <SidebarContent className="justify-center">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
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
                        "transition-all duration-150 rounded-lg",
                        isActive 
                          ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15 shadow-2xs" 
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80",
                        isCollapsed && isActive && "bg-primary/15 text-accent-brand ring-1 ring-primary/25"
                      )}
                    >
                      <Link 
                        href={item.path} 
                        data-testid={`nav-${item.path.slice(1) || 'dashboard'}`}
                        className={cn(
                          "flex items-center gap-3 w-full px-3 py-2.5",
                          isActive && !isCollapsed && "border-l-4 border-accent-brand -ml-1 pl-2.5",
                          isCollapsed && "justify-center px-0"
                        )}
                      >
                        <Icon className={cn(
                          "w-5 h-5 shrink-0 transition-colors",
                          isActive ? "text-accent-brand" : "text-slate-500 group-hover/menu-item:text-slate-800"
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
