import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import type { Express, Request, Response, NextFunction } from 'express';

export function setupRateLimiting(app: Express) {
  // Role-based rate limiting configuration (enhanced for concurrent users)
  const roleLimits = {
    admin: { windowMs: 900000, max: 5000 },     // 5000 requests per 15 minutes (was 2000)
    manager: { windowMs: 900000, max: 2500 },  // 2500 requests per 15 minutes (was 1000)
    employee: { windowMs: 900000, max: 1500 },  // 1500 requests per 15 minutes (was 500)
    guest: { windowMs: 900000, max: 100 }       // 100 requests per 15 minutes
  };

  // Enhanced general API rate limiting with role-based limits
  const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: (req: Request) => {
      const user = (req as any).user;
      const role = user?.role || 'guest';
      return roleLimits[role as keyof typeof roleLimits]?.max || 20;
    },
    keyGenerator: (req: Request) => {
      const user = (req as any).user;
      const role = user?.role || 'guest';
      const userId = user?.id || 'anonymous';
      return `${role}:${userId}:${req.ip}`;
    },
    message: {
      error: 'Too many requests',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    
    // Enhanced skip logic for trusted IPs and whitelisted paths
    skip: (req: Request) => {
      const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
      const whitelistedPaths = ['/api/health', '/api/status', '/api/metrics'];
      
      // Skip for trusted IPs
      if (req.ip && trustedIPs.includes(req.ip)) {
        return true;
      }
      
      // Skip for health check endpoints
      if (whitelistedPaths.some(path => req.path.includes(path))) {
        return true;
      }
      
      // Skip for internal requests (if you have internal routing)
      if (req.get('X-Internal-Request') === process.env.INTERNAL_API_KEY) {
        return true;
      }
      
      return false;
    },
    
    // Enhanced rate limit handling
    handler: (req: Request, res: Response) => {
      const user = (req as any).user;
      const role = user?.role || 'guest';
      
      // Log rate limit violations with role information
      console.warn(`Rate limit exceeded: ${req.method} ${req.path} from ${req.ip} (role: ${role})`);
      
      // Return enhanced error response
      res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: `Too many requests from this ${role} account, please try again later.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000 / 60),
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        role: role
      });
    },
    
    // Store rate limit data in memory (consider Redis for production)
    store: new (require('express-rate-limit')).MemoryStore(),
  });
  
  // Strict rate limiting for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'), // Max 5 attempts per window
    message: {
      error: 'Too many authentication attempts',
      message: 'Too many login attempts from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests (only count failed attempts)
    skipSuccessfulRequests: true,
    keyGenerator: (req: Request) => {
      // For auth, we can also rate limit by email if provided
      const email = req.body?.email;
      const ip = req.ip || 'unknown';
      if (email && typeof email === 'string') {
        return `auth:${ip}:${email.toLowerCase()}`;
      }
      return `auth:${ip}`;
    },
  });
  
  // Progressive slowdown for repeated requests
  const speedLimiter = slowDown({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    delayAfter: 50, // Allow 50 requests per windowMs without delay
    delayMs: () => 250, // Add 250ms delay per request after delayAfter (new API)
    maxDelayMs: 5000, // Maximum delay of 5 seconds
    keyGenerator: (req: Request) => req.ip || 'unknown',
    validate: {
      delayMs: false // Disable the deprecation warning
    }
  });
  
  // Endpoint-specific rate limiting (enhanced for concurrent access)
  const endpointLimits = {
    '/api/auth/login': { windowMs: 900000, max: 10 },         // Increased for admin multitasking
    '/api/auth/register': { windowMs: 3600000, max: 3 },
    '/api/auth/reset-password': { windowMs: 3600000, max: 3 },
    '/api/projects': { windowMs: 900000, max: 100 },         // Increased from 50
    '/api/dashboard/metrics': { windowMs: 60000, max: 60 },   // Increased to handle refreshing
    '/api/reports/export': { windowMs: 3600000, max: 10 },
    '/api/users': { windowMs: 3600000, max: 50 },            // Increased from 20
    '/api/milestones': { windowMs: 900000, max: 150 },        // New - high limits for milestone tables
    '/api/modules': { windowMs: 900000, max: 150 }           // New - high limits for module tables
  };

  // Create endpoint-specific limiters
  Object.entries(endpointLimits).forEach(([endpoint, limits]) => {
    const limiter = rateLimit({
      windowMs: limits.windowMs,
      max: (req: Request) => {
        const user = (req as any).user;
        const role = user?.role || 'guest';
        
        // Enhanced multipliers for better concurrent user support
        const multiplier = role === 'admin' ? 3 : role === 'manager' ? 2 : 1.5;
        return Math.floor(limits.max * multiplier);
      },
      keyGenerator: (req: Request) => {
        const user = (req as any).user;
        const role = user?.role || 'guest';
        const userId = user?.id || 'anonymous';
        return `${endpoint}:${role}:${userId}:${req.ip}`;
      },
      message: {
        error: 'Rate limit exceeded',
        message: `Too many requests to ${endpoint}, please try again later.`,
        retryAfter: Math.ceil(limits.windowMs / 1000 / 60) + ' minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    
    app.use(endpoint, limiter);
  });

  // Apply general rate limiting to all API routes
  app.use('/api', generalLimiter);
  
  // Apply speed limiting to all API routes
  app.use('/api', speedLimiter);
  
  // Apply strict rate limiting to authentication routes
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  
  // Additional rate limiting for sensitive operations
  const sensitiveOperationsLimiter = rateLimit({
    windowMs: 3600000, // 1 hour
    max: (req: Request) => {
      const user = (req as any).user;
      const role = user?.role || 'guest';
      return role === 'admin' ? 20 : role === 'manager' ? 15 : 10;
    },
    keyGenerator: (req: Request) => {
      const user = (req as any).user;
      const role = user?.role || 'guest';
      const userId = user?.id || 'anonymous';
      return `sensitive:${role}:${userId}:${req.ip}`;
    },
    message: {
      error: 'Too many sensitive operations',
      message: 'Too many sensitive operations from this IP, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // Apply to sensitive endpoints
  app.use('/api/users', sensitiveOperationsLimiter);
  app.use('/api/auth/reset-password', sensitiveOperationsLimiter);
  
  // Special rate limiting for batch endpoint (significantly higher limits for concurrent users)
  const batchLimiter = rateLimit({
    windowMs: 60000, // 1 minute
    max: (req: Request) => {
      const user = (req as any).user;
      const role = user?.role || 'guest';
      return role === 'admin' ? 500 : role === 'manager' ? 250 : role === 'employee' ? 150 : 10;
    },
    keyGenerator: (req: Request) => {
      const user = (req as any).user;
      const role = user?.role || 'guest';
      const userId = user?.id || 'anonymous';
      return `batch:${role}:${userId}:${req.ip}`;
    },
    message: {
      error: 'Too many batch requests',
      message: 'Batch request limit exceeded, please try again later.',
      retryAfter: '1 minute'
    },
    // Skip successful requests (to reduce congestion)
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  app.use('/api/batch', batchLimiter);
  
  // Rate limit export endpoints (prevent abuse)
  const exportLimiter = rateLimit({
    windowMs: 3600000, // 1 hour
    max: (req: Request) => {
      const user = (req as any).user;
      const role = user?.role || 'guest';
      return role === 'admin' ? 30 : role === 'manager' ? 20 : 10;
    },
    keyGenerator: (req: Request) => {
      const user = (req as any).user;
      const role = user?.role || 'guest';
      const userId = user?.id || 'anonymous';
      return `export:${role}:${userId}:${req.ip}`;
    },
    message: {
      error: 'Too many export requests',
      message: 'Export limit exceeded, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  app.use('/api/reports/export', exportLimiter);
}

// Custom rate limiter for specific use cases
export function createCustomRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: 'Rate limit exceeded',
      message: options.message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
  });
}
