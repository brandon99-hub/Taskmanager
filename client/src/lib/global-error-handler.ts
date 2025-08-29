// Global error handler for fetch and network errors
export function setupGlobalErrorHandling() {
  // Handle unhandled promise rejections (like fetch errors)
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    const error = event.reason;
    
    // Handle database connection errors and security issues
    if (error && typeof error === 'object' && 'message' in error && 
        (typeof error.message === 'string' && (
          error.message.includes('ETIMEDOUT') || 
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('500') ||
          error.message.includes('Internal Server Error') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('timeout')
        ))) {
      
      // Clear any cached data and redirect to login
      localStorage.removeItem('taskflow-auth');
      sessionStorage.clear();
      
      // Redirect to login page
      window.location.href = '/login';
      event.preventDefault(); // Prevent default error handling
    }
  });

  // Handle global JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    const error = event.error;
    
    // Handle database connection errors and security issues
    if (error && typeof error === 'object' && 'message' in error &&
        (typeof error.message === 'string' && (
          error.message.includes('ETIMEDOUT') || 
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('500') ||
          error.message.includes('Internal Server Error') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('timeout')
        ))) {
      
      // Clear any cached data and redirect to login
      localStorage.removeItem('taskflow-auth');
      sessionStorage.clear();
      
      // Redirect to login page
      window.location.href = '/login';
      event.preventDefault(); // Prevent default error handling
    }
  });

  // Handle fetch errors globally
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      
      // Check for server errors
      if (response.status >= 500) {
        const errorText = await response.text();
        if (errorText.includes('ETIMEDOUT') || 
            errorText.includes('ECONNREFUSED') ||
            errorText.includes('Internal Server Error')) {
          
          // Clear any cached data and redirect to login
          localStorage.removeItem('taskflow-auth');
          sessionStorage.clear();
          
          // Redirect to login page
          window.location.href = '/login';
          throw new Error('Database connection error');
        }
      }
      
      return response;
    } catch (error) {
      // Handle network errors
      if (error && typeof error === 'object' && 'message' in error &&
          (typeof error.message === 'string' && (
            error.message.includes('ETIMEDOUT') || 
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('NetworkError') ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('timeout')
          ))) {
        
        // Clear any cached data and redirect to login
        localStorage.removeItem('taskflow-auth');
        sessionStorage.clear();
        
        // Redirect to login page
        window.location.href = '/login';
      }
      
      throw error;
    }
  };
}
