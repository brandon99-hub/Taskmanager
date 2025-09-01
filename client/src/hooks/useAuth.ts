import { useQuery } from "@tanstack/react-query";

export interface DashboardRoleData {
  role: string;
  isProjectManager: boolean;
  isFinanceHead: boolean;
  assignedSegment?: string;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Query for dashboard role data
  const { data: dashboardRole, isLoading: roleLoading } = useQuery<DashboardRoleData>({
    queryKey: ["/api/user/dashboard-role"],
    retry: false,
    enabled: !!user, // Only fetch when user is authenticated
  });

  // Handle errors after the query
  if (error) {
    // Handle database connection errors and security issues
    if (error?.message?.includes('ETIMEDOUT') || 
        error?.message?.includes('ECONNREFUSED') ||
        error?.message?.includes('500') ||
        error?.message?.includes('Internal Server Error') ||
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('Failed to fetch')) {
      
      // Clear any cached data and redirect to login
      localStorage.removeItem('taskflow-auth');
      sessionStorage.clear();
      
      // Redirect to login page
      window.location.href = '/login';
    }
  }

  const getDashboardType = (): string => {
    if (!dashboardRole) return 'employee';
    
    // Check admin role assignments first
    if (dashboardRole?.isProjectManager) return 'project_manager';
    if (dashboardRole?.isFinanceHead) return 'finance_head';
    if (dashboardRole?.assignedSegment) return `segment_leader_${dashboardRole.assignedSegment}`;
    
    // Check base user roles
    if (dashboardRole?.role === 'admin' || dashboardRole?.role === 'manager') return 'admin';
    
    return 'employee';
  };

  const getSegment = (): string | undefined => {
    return dashboardRole?.assignedSegment;
  };

  const isAdminRole = (): boolean => {
    if (!dashboardRole) {
      console.log('isAdminRole: No dashboard role found');
      return false;
    }
    
    const isAdmin = dashboardRole?.isProjectManager || 
           dashboardRole?.isFinanceHead || 
           !!dashboardRole?.assignedSegment ||
           ['admin', 'manager'].includes(dashboardRole?.role);
    
    console.log('isAdminRole check:', {
      dashboardRole,
      isProjectManager: dashboardRole?.isProjectManager,
      isFinanceHead: dashboardRole?.isFinanceHead,
      assignedSegment: dashboardRole?.assignedSegment,
      role: dashboardRole?.role,
      isAdmin
    });
    
    return isAdmin;
  };

  return {
    user,
    isLoading: isLoading || roleLoading,
    isAuthenticated: !!user,
    error,
    dashboardRole,
    getDashboardType,
    getSegment,
    isAdminRole,
  };
}
