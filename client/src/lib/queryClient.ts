import { QueryClient, QueryFunction } from "@tanstack/react-query";

// CSRF token management
let csrfToken: string | null = null;

async function getCSRFToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (response.ok) {
      const data = await response.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch (error) {
    console.warn('Failed to get CSRF token:', error);
  }
  
  return null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Clone the response to avoid consuming the body
    const clonedRes = res.clone();
    const text = (await clonedRes.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  // Add Content-Type for requests with data
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add CSRF token for state-changing operations
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const token = await getCSRFToken();
    if (token) {
      headers["X-CSRF-Token"] = token;
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Handle CSRF token errors
  if (res.status === 403) {
    const clonedRes = res.clone();
    const errorText = await clonedRes.text();
    if (errorText.includes('CSRF') || errorText.includes('csrf')) {
      // Clear cached token and retry once
      csrfToken = null;
      const newToken = await getCSRFToken();
      if (newToken && headers["X-CSRF-Token"] !== newToken) {
        headers["X-CSRF-Token"] = newToken;
        const retryRes = await fetch(url, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
        });
        await throwIfResNotOk(retryRes);
        return retryRes;
      }
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      cache: "no-store",
      headers: {
        "cache-control": "no-cache",
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      onError: (error) => {
        console.error('Query error:', error);
        
        // Handle specific error types globally
        if (error instanceof Error) {
          if (error.message.includes('401')) {
            // Redirect to login
            window.location.href = '/login';
          } else if (error.message.includes('403')) {
            // Show access denied message
            console.warn('Access denied for query');
          }
        }
      }
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on 4xx errors
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        return failureCount < 2;
      },
      onError: (error) => {
        console.error('Mutation error:', error);
      }
    },
  },
});

// Enhanced query hook with better error handling
export function useEnhancedQuery<T>(
  queryKey: any[],
  queryFn: () => Promise<T>,
  options?: any
) {
  return queryClient.useQuery({
    queryKey,
    queryFn,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error instanceof Error && error.message.includes('4')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options
  });
}
