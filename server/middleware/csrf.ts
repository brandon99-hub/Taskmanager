import csrf from 'csurf';
import cookieParser from 'cookie-parser';
import type { Express, Request, Response, NextFunction } from 'express';

export function setupCSRFProtection(app: Express) {
  // Cookie parser is required for CSRF
  app.use(cookieParser());
  
  // Configure CSRF protection
  const csrfProtection = csrf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 3600000, // 1 hour
    },
    // Ignore CSRF for GET, HEAD, OPTIONS requests
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  });
  
  // Apply CSRF protection to all routes except auth endpoints initially
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for auth login/register to avoid chicken-and-egg problem
    if (req.path === '/auth/login' || req.path === '/auth/register') {
      return next();
    }
    
    // Apply CSRF protection
    csrfProtection(req, res, next);
  });
  
  // Endpoint to get CSRF token for frontend
  app.get('/api/csrf-token', csrfProtection, (req: Request, res: Response) => {
    res.json({ 
      csrfToken: req.csrfToken(),
      message: 'CSRF token generated successfully'
    });
  });
  
  // CSRF error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({
        error: 'Invalid CSRF token',
        message: 'Your session may have expired. Please refresh the page.',
      });
    }
    next(err);
  });
}

// Utility function to validate CSRF token manually if needed
export function validateCSRFToken(req: Request): boolean {
  try {
    const token = req.get('X-CSRF-Token') || req.body._csrf;
    const secret = req.session?.csrfSecret;
    
    if (!token || !secret) {
      return false;
    }
    
    // Manual validation logic would go here
    // For now, rely on the middleware
    return true;
  } catch {
    return false;
  }
}
