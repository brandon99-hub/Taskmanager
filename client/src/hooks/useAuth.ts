import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
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

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
