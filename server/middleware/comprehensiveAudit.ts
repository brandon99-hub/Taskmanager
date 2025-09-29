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
export function logModuleAction(actionType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const moduleId = req.params.id;
    const moduleName = req.body?.name || 'Unknown Module';
    
    return logUserAction(actionType, 'module', moduleId, moduleName)(req, res, next);
  };
}

// Middleware to log subtask-specific actions
export function logSubtaskAction(actionType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const subtaskId = req.params.id;
    let subtaskName = req.body?.name || 'Unknown Subtask';
    
    // Capture old values BEFORE the API call executes
    const oldValues = await getSubtaskValues(subtaskId);
    
    // Store the original send function
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Override response methods to capture response data and log after the action
    res.send = function(body: any) {
      // Log after the action is complete
      logSubtaskActionAsync(actionType, subtaskId, subtaskName, req, res, body, oldValues);
      return originalSend.call(this, body);
    };
    
    res.json = function(body: any) {
      // Log after the action is complete
      logSubtaskActionAsync(actionType, subtaskId, subtaskName, req, res, body, oldValues);
      return originalJson.call(this, body);
    };
    
    next();
  };
}

// Async function to log subtask action with proper name fetching and change tracking
async function logSubtaskActionAsync(
  actionType: string, 
  subtaskId: string, 
  subtaskName: string, 
  req: Request, 
  res: Response, 
  body: any,
  oldValues: any
) {
  try {
    // If we don't have the name in the body, try to fetch it from the database
    if (subtaskName === 'Unknown Subtask' && subtaskId) {
      const { db } = await import('../db');
      const { subtasks, modules, projects } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [subtask] = await db
        .select({ 
          name: subtasks.name,
          moduleId: subtasks.moduleId
        })
        .from(subtasks)
        .where(eq(subtasks.id, subtaskId));
      
      if (subtask?.name) {
        subtaskName = subtask.name;
        
        // Also get module and project names for better context
        if (subtask.moduleId) {
          const [module] = await db
            .select({ 
              name: modules.name,
              projectId: modules.projectId
            })
            .from(modules)
            .where(eq(modules.id, subtask.moduleId));
          
          if (module?.name) {
            subtaskName = `${subtask.name} (${module.name})`;
            
            if (module.projectId) {
              const [project] = await db
                .select({ name: projects.name })
                .from(projects)
                .where(eq(projects.id, module.projectId));
              
              if (project?.name) {
                subtaskName = `${subtask.name} (${module.name} - ${project.name})`;
              }
            }
          }
        }
      }
    }
    
    // Use the old values we captured before the API call
    const newValues = req.body;
    
    // Now log the action with the correct name and change details
    const clientMachineInfo = getClientMachineInfo(req);
    const { auditService } = await import('../services/comprehensiveAuditService');
    
    await auditService.logUserAction({
      actionType,
      resourceType: 'subtask',
      resourceId: subtaskId,
      resourceName: subtaskName,
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
    console.error('Error logging subtask action:', error);
  }
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
  return async (req: Request, res: Response, next: NextFunction) => {
    const milestoneId = req.params.id;
    let milestoneName = req.body?.name || 'Unknown Milestone';
    
    // Capture old values BEFORE the API call executes
    const oldValues = await getMilestoneValues(milestoneId);
    
    // Store the original send function
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Override response methods to capture response data and log after the action
    res.send = function(body: any) {
      // Log after the action is complete
      logMilestoneActionAsync(actionType, milestoneId, milestoneName, req, res, body, oldValues);
      return originalSend.call(this, body);
    };
    
    res.json = function(body: any) {
      // Log after the action is complete
      logMilestoneActionAsync(actionType, milestoneId, milestoneName, req, res, body, oldValues);
      return originalJson.call(this, body);
    };
    
    next();
  };
}

// Helper function to get current milestone values
async function getMilestoneValues(milestoneId: string): Promise<any> {
  try {
    const { db } = await import('../db');
    const { milestones } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const [milestone] = await db
      .select()
      .from(milestones)
      .where(eq(milestones.id, milestoneId));
    
    return milestone || {};
  } catch (error) {
    console.error('Error fetching milestone values:', error);
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

// Helper function to get current subtask values
async function getSubtaskValues(subtaskId: string): Promise<any> {
  try {
    const { db } = await import('../db');
    const { subtasks } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const [subtask] = await db
      .select()
      .from(subtasks)
      .where(eq(subtasks.id, subtaskId));
    
    return subtask || {};
  } catch (error) {
    console.error('Error fetching subtask values:', error);
    return {};
  }
}

// Async function to log milestone action with proper name fetching
async function logMilestoneActionAsync(
  actionType: string, 
  milestoneId: string, 
  milestoneName: string, 
  req: Request, 
  res: Response, 
  body: any,
  oldValues: any
) {
  try {
    // If we don't have the name in the body, try to fetch it from the database
    if (milestoneName === 'Unknown Milestone' && milestoneId) {
      const { db } = await import('../db');
      const { milestones, projects } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [milestone] = await db
        .select({ 
          name: milestones.name,
          projectId: milestones.projectId
        })
        .from(milestones)
        .where(eq(milestones.id, milestoneId));
      
      if (milestone?.name) {
        milestoneName = milestone.name;
        
        // Also get project name for better context
        if (milestone.projectId) {
          const [project] = await db
            .select({ name: projects.name })
            .from(projects)
            .where(eq(projects.id, milestone.projectId));
          
          if (project?.name) {
            milestoneName = `${milestone.name} (${project.name})`;
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
      resourceType: 'milestone',
      resourceId: milestoneId,
      resourceName: milestoneName,
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
    console.error('Error logging milestone action:', error);
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
