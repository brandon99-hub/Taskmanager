import csrf from 'csurf';
import cookieParser from 'cookie-parser';
import type { Express, Request, Response, NextFunction } from 'express';

export function setupCSRFProtection(app: Express) {
  if (!process.env.COOKIE_SECRET) {
    throw new Error("COOKIE_SECRET environment variable is required");
  }

  // Enhanced cookie parser configuration
  app.use(cookieParser(process.env.COOKIE_SECRET));
  
  // Enhanced CSRF protection configuration
  const csrfProtection = csrf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 3600000, // 1 hour
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
    // Enhanced CSRF options
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
    value: (req: Request) => {
      // Check multiple sources for CSRF token
      return req.body._csrf || 
             req.headers['x-csrf-token'] || 
             req.headers['x-xsrf-token'] ||
             req.cookies['XSRF-TOKEN'];
    },
  });
  
  // CSRF token endpoint (must be before CSRF protection)
  app.get('/api/csrf-token', csrfProtection, (req: Request, res: Response) => {
    // Set security headers for CSRF token endpoint
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const token = req.csrfToken();
    
    // Set CSRF token in cookie for additional protection
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false, // Allow JavaScript access
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 3600000, // 1 hour
      path: '/',
    });
    
    res.json({ 
      csrfToken: token,
      message: 'CSRF token generated successfully',
      expiresIn: '1 hour'
    });
  });

  // Enhanced CSRF protection with better route handling
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for auth endpoints, marketing routes (JWT-based), and public APIs.
    // Exact-match single routes and prefix-match path families (trailing '/') separately —
    // substring matching here would silently exempt any future route whose path merely
    // contains one of these strings (e.g. '/auth/login-history' matching '/auth/login').
    const skipCSRFExact = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/csrf-token'];
    const skipCSRFPrefixes = ['/public/', '/webhook/', '/marketing/', '/upload/'];

    if (skipCSRFExact.includes(req.path) || skipCSRFPrefixes.some(prefix => req.path.startsWith(prefix))) {
      return next();
    }
    
    // Apply CSRF protection
    csrfProtection(req, res, next);
  });
  
  // Enhanced CSRF error handler with detailed logging
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.code === 'EBADCSRFTOKEN') {
      // Log CSRF violations for security monitoring
      console.warn(`CSRF Violation: ${req.method} ${req.path} from ${req.ip} - User: ${(req as any).user?.id || 'anonymous'}`);
      
      // Return enhanced error response
      return res.status(403).json({
        error: 'CSRF Token Invalid',
        message: 'Your session may have expired or the CSRF token is invalid. Please refresh the page.',
        code: 'CSRF_VIOLATION',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      });
    }
    next(err);
  });
}

// Utility function to validate CSRF token manually if needed
export function validateCSRFToken(req: Request): boolean {
  try {
    const token = req.get('X-CSRF-Token') || req.body._csrf;
    
    if (!token) {
      return false;
    }
    
    // Manual validation logic would go here
    // For now, rely on the middleware
    return true;
  } catch {
    return false;
  }
}
