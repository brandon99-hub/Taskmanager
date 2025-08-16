import type { Request, Response, NextFunction } from 'express';
import { logSecurityEvent, SecurityEvent } from '../utils/logger';
import { db } from '../db';
import { securityEvents } from '../schemas/security';

// Database schema for security events (to be added to shared/schema.ts)
interface SecurityEventRecord {
  id?: string;
  userId?: string;
  eventType: string;
  eventDetails?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt?: Date;
}

// Audit middleware for tracking security events
export function auditMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    // Capture response to determine success/failure
    res.send = function(body: any) {
      const statusCode = res.statusCode;
      const isSuccess = statusCode >= 200 && statusCode < 400;
      
      // Log security-relevant events
      if (shouldAuditRequest(req, statusCode)) {
        const event = createSecurityEvent(req, res, isSuccess);
        logAndStoreSecurityEvent(event);
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
}

// Determine if a request should be audited
function shouldAuditRequest(req: Request, statusCode: number): boolean {
  const auditPaths = [
    '/api/auth/',
    '/api/users',
    '/api/admin/',
  ];
  
  const sensitiveActions = [
    'POST', 'PUT', 'DELETE'
  ];
  
  // Always audit auth endpoints
  if (auditPaths.some(path => req.path.includes(path))) {
    return true;
  }
  
  // Audit failed requests (4xx, 5xx)
  if (statusCode >= 400) {
    return true;
  }
  
  // Audit sensitive actions
  if (sensitiveActions.includes(req.method)) {
    return true;
  }
  
  return false;
}

// Create security event from request/response
function createSecurityEvent(req: Request, res: Response, success: boolean): SecurityEvent {
  const user = (req as any).user;
  const statusCode = res.statusCode;
  
  let eventType = 'unknown';
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  
  // Determine event type based on request
  if (req.path.includes('/auth/login')) {
    eventType = success ? 'auth_success' : 'auth_failure';
    severity = success ? 'low' : 'medium';
  } else if (req.path.includes('/auth/register')) {
    eventType = success ? 'user_registration' : 'registration_failure';
    severity = 'medium';
  } else if (req.path.includes('/auth/logout')) {
    eventType = 'auth_logout';
    severity = 'low';
  } else if (req.method === 'DELETE') {
    eventType = success ? 'resource_deletion' : 'deletion_failure';
    severity = success ? 'medium' : 'high';
  } else if (req.method === 'POST' || req.method === 'PUT') {
    eventType = success ? 'resource_modification' : 'modification_failure';
    severity = 'low';
  } else if (statusCode === 403) {
    eventType = 'permission_denied';
    severity = 'medium';
  } else if (statusCode === 401) {
    eventType = 'unauthorized_access';
    severity = 'medium';
  } else if (statusCode >= 500) {
    eventType = 'server_error';
    severity = 'high';
  }
  
  // Extract relevant details
  const details: Record<string, any> = {
    method: req.method,
    path: req.path,
    statusCode,
    responseTime: Date.now() - (req as any).startTime,
  };
  
  // Add query parameters for GET requests
  if (req.method === 'GET' && Object.keys(req.query).length > 0) {
    details.queryParams = req.query;
  }
  
  // Add body size for POST/PUT requests (without sensitive data)
  if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
    details.bodySize = JSON.stringify(req.body).length;
  }
  
  return {
    eventType,
    userId: user?.id,
    userEmail: user?.email,
    ipAddress: getClientIP(req),
    userAgent: req.get('User-Agent'),
    success,
    details,
    severity,
  };
}

// Extract client IP address
function getClientIP(req: Request): string {
  return (
    req.get('X-Forwarded-For') ||
    req.get('X-Real-IP') ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

// Log and store security event
async function logAndStoreSecurityEvent(event: SecurityEvent) {
  try {
    // Log to file system
    logSecurityEvent(event);
    
    // Store in database (commented out until schema is added)
    /*
    await db.insert(securityEvents).values({
      userId: event.userId,
      eventType: event.eventType,
      eventDetails: event.details,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: event.success,
      severity: event.severity,
      createdAt: new Date(),
    });
    */
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// Account lockout tracking
interface FailedAttempt {
  count: number;
  lastAttempt: Date;
  lockoutUntil?: Date;
}

const failedAttempts = new Map<string, FailedAttempt>();

export function trackFailedLogin(identifier: string): { 
  shouldLock: boolean; 
  lockoutDuration: number;
  attemptsRemaining: number;
} {
  const key = `login:${identifier}`;
  const now = new Date();
  const attempt = failedAttempts.get(key) || { count: 0, lastAttempt: now };
  
  // Reset if enough time has passed
  const resetWindow = 15 * 60 * 1000; // 15 minutes
  if (now.getTime() - attempt.lastAttempt.getTime() > resetWindow) {
    attempt.count = 0;
  }
  
  attempt.count++;
  attempt.lastAttempt = now;
  
  let shouldLock = false;
  let lockoutDuration = 0;
  
  // Progressive lockout policy
  if (attempt.count >= 10) {
    // 10+ failures: 24 hour lockout
    lockoutDuration = 24 * 60 * 60 * 1000;
    shouldLock = true;
  } else if (attempt.count >= 5) {
    // 5-9 failures: 30 minute lockout
    lockoutDuration = 30 * 60 * 1000;
    shouldLock = true;
  } else if (attempt.count >= 3) {
    // 3-4 failures: 5 minute lockout
    lockoutDuration = 5 * 60 * 1000;
    shouldLock = true;
  }
  
  if (shouldLock) {
    attempt.lockoutUntil = new Date(now.getTime() + lockoutDuration);
  }
  
  failedAttempts.set(key, attempt);
  
  const maxAttempts = 10;
  const attemptsRemaining = Math.max(0, maxAttempts - attempt.count);
  
  return {
    shouldLock,
    lockoutDuration,
    attemptsRemaining,
  };
}

export function isAccountLocked(identifier: string): boolean {
  const key = `login:${identifier}`;
  const attempt = failedAttempts.get(key);
  
  if (!attempt || !attempt.lockoutUntil) {
    return false;
  }
  
  const now = new Date();
  if (now >= attempt.lockoutUntil) {
    // Lockout expired, reset
    attempt.lockoutUntil = undefined;
    attempt.count = 0;
    failedAttempts.set(key, attempt);
    return false;
  }
  
  return true;
}

export function clearFailedAttempts(identifier: string): void {
  const key = `login:${identifier}`;
  failedAttempts.delete(key);
}

// Request timing middleware
export function requestTimingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    (req as any).startTime = Date.now();
    next();
  };
}
