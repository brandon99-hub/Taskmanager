import type { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/comprehensiveAuditService';
import { logSecurityEvent } from '../utils/logger';

export function comprehensiveAuditMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Capture request data
    const requestData = {
      method: req.method,
      endpoint: req.path,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      userId: (req as any).user?.id,
      sessionId: (req as any).sessionID,
      requestId: (req as any).requestId || generateRequestId(),
      queryParams: req.query,
      requestBodySize: req.method !== 'GET' ? JSON.stringify(req.body || {}).length : 0,
    };

    // Override response methods to capture response data
    res.send = function(body: any) {
      const responseTime = Date.now() - startTime;
      const responseSize = typeof body === 'string' ? body.length : JSON.stringify(body || {}).length;
      
      // Skip API request logging - only log user activities and system events
      // auditService.logApiRequest({
        // method: requestData.method,
        // endpoint: requestData.endpoint,
        // statusCode: res.statusCode,
        // responseTimeMs: responseTime,
        // requestSizeBytes: requestData.requestBodySize,
        // responseSizeBytes: responseSize,
        // queryParams: requestData.queryParams,
        // requestBodySize: requestData.requestBodySize,
      // }, {
        // userId: requestData.userId,
        // ipAddress: requestData.ipAddress,
        // userAgent: requestData.userAgent,
        // sessionId: requestData.sessionId,
        // requestId: requestData.requestId,
      // });

      // Log security events for failed requests
      if (res.statusCode >= 400) {
        logSecurityEvent({
          eventType: 'api_error',
          userId: requestData.userId,
          userEmail: (req as any).user?.email,
          ipAddress: requestData.ipAddress,
          userAgent: requestData.userAgent,
          success: false,
          details: {
            method: requestData.method,
            endpoint: requestData.endpoint,
            statusCode: res.statusCode,
            responseTime: responseTime,
          },
          severity: res.statusCode >= 500 ? 'high' : 'medium',
        });
      }

      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      const responseTime = Date.now() - startTime;
      const responseSize = JSON.stringify(body || {}).length;
      
      // Skip API request logging - only log user activities and system events
      // auditService.logApiRequest({
        // method: requestData.method,
        // endpoint: requestData.endpoint,
        // statusCode: res.statusCode,
        // responseTimeMs: responseTime,
        // requestSizeBytes: requestData.requestBodySize,
        // responseSizeBytes: responseSize,
        // queryParams: requestData.queryParams,
        // requestBodySize: requestData.requestBodySize,
      // }, {
        // userId: requestData.userId,
        // ipAddress: requestData.ipAddress,
        // userAgent: requestData.userAgent,
        // sessionId: requestData.sessionId,
        // requestId: requestData.requestId,
      // });

      // Log security events for failed requests
      if (res.statusCode >= 400) {
        logSecurityEvent({
          eventType: 'api_error',
          userId: requestData.userId,
          userEmail: (req as any).user?.email,
          ipAddress: requestData.ipAddress,
          userAgent: requestData.userAgent,
          success: false,
          details: {
            method: requestData.method,
            endpoint: requestData.endpoint,
            statusCode: res.statusCode,
            responseTime: responseTime,
          },
          severity: res.statusCode >= 500 ? 'high' : 'medium',
        });
      }

      return originalJson.call(this, body);
    };

    next();
  };
}

// Helper function to generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Middleware to log specific user actions
export function logUserAction(actionType: string, resourceType: string, resourceId?: string, resourceName?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const originalJson = res.json;
    
    res.send = function(body: any) {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        // Log successful action
        auditService.logUserAction({
          actionType,
          resourceType,
          resourceId,
          resourceName,
          success: true,
        }, {
          userId: (req as any).user?.id,
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          sessionId: (req as any).sessionID,
          requestId: (req as any).requestId,
        });
      } else {
        // Log failed action
        auditService.logUserAction({
          actionType,
          resourceType,
          resourceId,
          resourceName,
          success: false,
          errorMessage: typeof body === 'string' ? body : body?.message || 'Unknown error',
        }, {
          userId: (req as any).user?.id,
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          sessionId: (req as any).sessionID,
          requestId: (req as any).requestId,
        });
      }
      
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        // Log successful action
        auditService.logUserAction({
          actionType,
          resourceType,
          resourceId,
          resourceName,
          success: true,
        }, {
          userId: (req as any).user?.id,
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          sessionId: (req as any).sessionID,
          requestId: (req as any).requestId,
        });
      } else {
        // Log failed action
        auditService.logUserAction({
          actionType,
          resourceType,
          resourceId,
          resourceName,
          success: false,
          errorMessage: body?.message || 'Unknown error',
        }, {
          userId: (req as any).user?.id,
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          sessionId: (req as any).sessionID,
          requestId: (req as any).requestId,
        });
      }
      
      return originalJson.call(this, body);
    };

    next();
  };
}

// Middleware to log project-specific actions
export function logProjectAction(actionType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const projectId = req.params.id;
    const projectName = req.body?.name || 'Unknown Project';
    
    return logUserAction(actionType, 'project', projectId, projectName)(req, res, next);
  };
}

// Middleware to log module-specific actions
export function logModuleAction(actionType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const moduleId = req.params.id;
    const moduleName = req.body?.name || 'Unknown Module';
    
    return logUserAction(actionType, 'module', moduleId, moduleName)(req, res, next);
  };
}

// Middleware to log user management actions
export function logUserManagementAction(actionType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id || req.body?.userId;
    const userName = req.body?.firstName && req.body?.lastName 
      ? `${req.body.firstName} ${req.body.lastName}` 
      : req.body?.email || 'Unknown User';
    
    return logUserAction(actionType, 'user', userId, userName)(req, res, next);
  };
}

// Middleware to log team management actions
export function logTeamAction(actionType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const teamId = req.params.id;
    const teamName = req.body?.name || 'Unknown Team';
    
    return logUserAction(actionType, 'team', teamId, teamName)(req, res, next);
  };
}

// Middleware to log milestone actions
export function logMilestoneAction(actionType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const milestoneId = req.params.id;
    const milestoneName = req.body?.name || 'Unknown Milestone';
    
    return logUserAction(actionType, 'milestone', milestoneId, milestoneName)(req, res, next);
  };
}

// Middleware to log invoice actions
export function logInvoiceAction(actionType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const invoiceId = req.params.id;
    const invoiceNumber = req.body?.invoiceNumber || 'Unknown Invoice';
    
    return logUserAction(actionType, 'invoice', invoiceId, invoiceNumber)(req, res, next);
  };
}
