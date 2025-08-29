import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import type { Express, Request, Response, NextFunction } from 'express';

export function setupRateLimiting(app: Express) {
  // Enhanced general API rate limiting
  const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // Max 100 requests per window
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
    
    // Enhanced key generator with better IP detection
    keyGenerator: (req: Request) => {
      // Enhanced IP detection for various proxy configurations
      const clientIP = req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                      req.get('X-Real-IP') ||
                      req.get('X-Client-IP') ||
                      req.get('CF-Connecting-IP') || // Cloudflare
                      req.get('X-Forwarded') ||
                      req.ip ||
                      req.connection.remoteAddress ||
                      req.socket.remoteAddress ||
                      'unknown';
      
      // Add user agent fingerprinting for better rate limiting
      const userAgent = req.get('User-Agent') || 'unknown';
      const userAgentHash = require('crypto').createHash('md5').update(userAgent).digest('hex').substring(0, 8);
      
      return `${clientIP}:${userAgentHash}`;
    },
    
    // Enhanced rate limit handling
    handler: (req: Request, res: Response) => {
      // Log rate limit violations
      console.warn(`Rate limit exceeded: ${req.method} ${req.path} from ${req.ip}`);
      
      // Return enhanced error response
      res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000 / 60),
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
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
    max: 10, // Max 10 requests per hour
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
  
  // Rate limit export endpoints (prevent abuse)
  const exportLimiter = rateLimit({
    windowMs: 3600000, // 1 hour
    max: 20, // Max 20 exports per hour
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
