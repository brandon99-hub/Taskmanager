import type { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/comprehensiveAuditService';
import { logSecurityEvent } from '../utils/logger';
import { getClientMachineInfo } from '../utils/machineIdentification';

export function comprehensiveAuditMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Capture request data including machine information
    const clientMachineInfo = getClientMachineInfo(req);
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
      machineInfo: {
        serverHostname: clientMachineInfo.clientHostname || 'server',
        clientHostname: clientMachineInfo.clientHostname,
        clientPlatform: clientMachineInfo.clientPlatform,
        clientArch: clientMachineInfo.clientArch,
        clientIP: clientMachineInfo.clientIP,
        clientUserAgent: clientMachineInfo.clientUserAgent
      }
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
        const clientMachineInfo = getClientMachineInfo(req);
        
        // Debug: Log what we're capturing
        console.log('Audit Debug - User object:', {
          userId: (req as any).user?.id,
          userEmail: (req as any).user?.email,
          userObject: (req as any).user
        });
        
        auditService.logUserAction({
          actionType,
          resourceType,
          resourceId,
          resourceName,
          success: true,
        }, {
          userId: (req as any).user?.id,
          userEmail: (req as any).user?.email || (req as any).user?.userEmail || 'No Email Found',
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          sessionId: (req as any).sessionID,
          requestId: (req as any).requestId,
          machineInfo: {
            serverHostname: clientMachineInfo.clientHostname || 'server',
            clientHostname: clientMachineInfo.clientHostname,
            clientPlatform: clientMachineInfo.clientPlatform,
            clientArch: clientMachineInfo.clientArch,
            clientIP: clientMachineInfo.clientIP
          }
        });
      } else {
        // Log failed action
        const clientMachineInfo = getClientMachineInfo(req);
        auditService.logUserAction({
          actionType,
          resourceType,
          resourceId,
          resourceName,
          success: false,
          errorMessage: typeof body === 'string' ? body : body?.message || 'Unknown error',
        }, {
          userId: (req as any).user?.id,
          userEmail: (req as any).user?.email,
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          sessionId: (req as any).sessionID,
          requestId: (req as any).requestId,
          machineInfo: {
            serverHostname: clientMachineInfo.clientHostname || 'server',
            clientHostname: clientMachineInfo.clientHostname,
            clientPlatform: clientMachineInfo.clientPlatform,
            clientArch: clientMachineInfo.clientArch,
            clientIP: clientMachineInfo.clientIP
          }
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
  return async (req: Request, res: Response, next: NextFunction) => {
    const projectId = req.params.id;
    let projectName = req.body?.name || 'Unknown Project';
    
    // Capture old values BEFORE the API call executes
    const oldValues = await getProjectValues(projectId);
    
    // Store the original send function
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Override response methods to capture response data and log after the action
    res.send = function(body: any) {
      // Log after the action is complete
      logProjectActionAsync(actionType, projectId, projectName, req, res, body, oldValues);
      return originalSend.call(this, body);
    };
    
    res.json = function(body: any) {
      // Log after the action is complete
      logProjectActionAsync(actionType, projectId, projectName, req, res, body, oldValues);
      return originalJson.call(this, body);
    };
    
    next();
  };
}

// Async function to log project action with proper name fetching and change tracking
async function logProjectActionAsync(
  actionType: string, 
  projectId: string, 
  projectName: string, 
  req: Request, 
  res: Response, 
  body: any,
  oldValues: any
) {
  try {
    // If we don't have the name in the body, try to fetch it from the database
    if (projectName === 'Unknown Project' && projectId) {
      const { db } = await import('../db');
      const { projects } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [project] = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId));
      
      if (project?.name) {
        projectName = project.name;
      }
    }
    
    // Use the old values we captured before the API call
    const newValues = req.body;
    
    // Now log the action with the correct name and change details
    const clientMachineInfo = getClientMachineInfo(req);
    const { auditService } = await import('../services/comprehensiveAuditService');
    
    await auditService.logUserAction({
      actionType,
      resourceType: 'project',
      resourceId: projectId,
      resourceName: projectName,
      oldValues: oldValues,
      newValues: newValues,
      success: res.statusCode >= 200 && res.statusCode < 400,
      errorMessage: res.statusCode >= 400 ? (typeof body === 'string' ? body : body?.message || 'Unknown error') : undefined,
    }, {
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email || (req as any).user?.userEmail || 'No Email Found',
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      sessionId: (req as any).sessionID,
      requestId: (req as any).requestId,
      machineInfo: {
        serverHostname: clientMachineInfo.clientHostname || 'server',
        clientHostname: clientMachineInfo.clientHostname,
        clientPlatform: clientMachineInfo.clientPlatform,
        clientArch: clientMachineInfo.clientArch,
        clientIP: clientMachineInfo.clientIP
      }
    });
  } catch (error) {
    console.error('Error logging project action:', error);
  }
}

// Middleware to log module-specific actions
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
export function logBillingItemAction(actionType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const billingItemId = req.params.id;
    let billingItemName = req.body?.name || 'Unknown Billing Item';

    // Capture old values BEFORE the API call executes
    const oldValues = await getBillingItemValues(billingItemId);

    // Store the original send function
    const originalSend = res.send;
    const originalJson = res.json;

    // Override response methods to capture response data and log after the action
    res.send = function(body: any) {
      // Log after the action is complete
      logBillingItemActionAsync(actionType, billingItemId, billingItemName, req, res, body, oldValues);
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      // Log after the action is complete
      logBillingItemActionAsync(actionType, billingItemId, billingItemName, req, res, body, oldValues);
      return originalJson.call(this, body);
    };

    next();
  };
}

// Helper function to get current billing item values
async function getBillingItemValues(billingItemId: string): Promise<any> {
  try {
    const { db } = await import('../db');
    const { billingItems } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');

    const [billingItem] = await db
      .select()
      .from(billingItems)
      .where(eq(billingItems.id, billingItemId));

    return billingItem || {};
  } catch (error) {
    console.error('Error fetching billing item values:', error);
    return {};
  }
}

// Helper function to get current project values
async function getProjectValues(projectId: string): Promise<any> {
  try {
    const { db } = await import('../db');
    const { projects } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    
    return project || {};
  } catch (error) {
    console.error('Error fetching project values:', error);
    return {};
  }
}

// Async function to log billing item action with proper name fetching
async function logBillingItemActionAsync(
  actionType: string,
  billingItemId: string,
  billingItemName: string,
  req: Request,
  res: Response,
  body: any,
  oldValues: any
) {
  try {
    // If we don't have the name in the body, try to fetch it from the database
    if (billingItemName === 'Unknown Billing Item' && billingItemId) {
      const { db } = await import('../db');
      const { billingItems, projects } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

      const [billingItem] = await db
        .select({
          name: billingItems.name,
          projectId: billingItems.projectId
        })
        .from(billingItems)
        .where(eq(billingItems.id, billingItemId));

      if (billingItem?.name) {
        billingItemName = billingItem.name;

        // Also get project name for better context
        if (billingItem.projectId) {
          const [project] = await db
            .select({ name: projects.name })
            .from(projects)
            .where(eq(projects.id, billingItem.projectId));

          if (project?.name) {
            billingItemName = `${billingItem.name} (${project.name})`;
          }
        }
      }
    }

    // Now log the action with the correct name
    const clientMachineInfo = getClientMachineInfo(req);
    const { auditService } = await import('../services/comprehensiveAuditService');

    // Use the old values we captured before the API call
    const newValues = req.body;

    await auditService.logUserAction({
      actionType,
      resourceType: 'billing_item',
      resourceId: billingItemId,
      resourceName: billingItemName,
      oldValues: oldValues,
      newValues: newValues,
      success: res.statusCode >= 200 && res.statusCode < 400,
      errorMessage: res.statusCode >= 400 ? (typeof body === 'string' ? body : body?.message || 'Unknown error') : undefined,
    }, {
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email || (req as any).user?.userEmail || 'No Email Found',
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      sessionId: (req as any).sessionID,
      requestId: (req as any).requestId,
      machineInfo: {
        serverHostname: clientMachineInfo.clientHostname || 'server',
        clientHostname: clientMachineInfo.clientHostname,
        clientPlatform: clientMachineInfo.clientPlatform,
        clientArch: clientMachineInfo.clientArch,
        clientIP: clientMachineInfo.clientIP
      }
    });
  } catch (error) {
    console.error('Error logging billing item action:', error);
  }
}

// Middleware to log invoice actions
export function logInvoiceAction(actionType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const invoiceId = req.params.id;
    const invoiceNumber = req.body?.invoiceNumber || 'Unknown Invoice';
    
    return logUserAction(actionType, 'invoice', invoiceId, invoiceNumber)(req, res, next);
  };
}
