import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define different transports based on environment
const transports: winston.transport[] = [];

// Console transport for development
if (process.env.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple()
      ),
    })
  );
}

// File transports for all environments
const logDir = process.env.LOG_DIR || './logs';

// General application logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d', // Keep logs for 14 days
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  })
);

// Error logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d', // Keep error logs for 30 days
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  })
);

// Security events logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'security-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '50m',
    maxFiles: '90d', // Keep security logs for 90 days
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  })
);

// Exception logs (uncaught exceptions)
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'exceptions-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '50m',
    maxFiles: '90d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  })
);

// Rejection logs (unhandled promise rejections)
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'rejections-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '50m',
    maxFiles: '90d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  levels,
  transports,
  // Enhanced error handling
  exitOnError: false,
  // Handle uncaught exceptions and unhandled rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '50m',
      maxFiles: '90d',
    }),
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '50m',
      maxFiles: '90d',
    }),
  ],
});

// Security logger for security-specific events
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '50m',
      maxFiles: '90d',
    }),
  ],
});

// Export loggers and helper functions

// Enhanced error logging with security context
export function logSecurityError(error: any, context: any = {}) {
  logger.error('Security Error', {
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
    },
    context: {
      ...context,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      hostname: require('os').hostname(),
      processId: process.pid,
    }
  });
}

// Enhanced access logging
export function logAccess(req: any, res: any, responseTime: number) {
  const accessData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    responseTime,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
    userRole: req.user?.role || 'anonymous',
    referer: req.get('Referer'),
  };

  // Log to access log file
  const accessLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new DailyRotateFile({
        filename: path.join(logDir, 'access-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
      })
    ]
  });

  accessLogger.info('Access Log', accessData);
}

export default logger;
export { securityLogger };

// Security event logging helper
export interface SecurityEvent {
  eventType: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp?: Date;
}

export function logSecurityEvent(event: SecurityEvent) {
  const logEntry = {
    ...event,
    timestamp: event.timestamp || new Date(),
    source: 'taskflow-security',
  };
  
  securityLogger.info('Security Event', logEntry);
  
  // Also log to main logger if it's a high severity event
  if (event.severity === 'high' || event.severity === 'critical') {
    logger.warn(`Security Event: ${event.eventType}`, logEntry);
  }
}

// Authentication event helpers
export function logAuthSuccess(userId: string, email: string, ipAddress: string, userAgent: string) {
  logSecurityEvent({
    eventType: 'auth_success',
    userId,
    userEmail: email,
    ipAddress,
    userAgent,
    success: true,
    severity: 'low',
  });
}

export function logAuthFailure(email: string, ipAddress: string, userAgent: string, reason: string) {
  logSecurityEvent({
    eventType: 'auth_failure',
    userEmail: email,
    ipAddress,
    userAgent,
    success: false,
    details: { reason },
    severity: 'medium',
  });
}

export function logAccountLockout(userId: string, email: string, ipAddress: string) {
  logSecurityEvent({
    eventType: 'account_lockout',
    userId,
    userEmail: email,
    ipAddress,
    success: false,
    severity: 'high',
  });
}

export function logPermissionDenied(userId: string, email: string, resource: string, action: string, ipAddress: string) {
  logSecurityEvent({
    eventType: 'permission_denied',
    userId,
    userEmail: email,
    ipAddress,
    success: false,
    details: { resource, action },
    severity: 'medium',
  });
}

export function logSuspiciousActivity(details: Record<string, any>, ipAddress: string, severity: 'medium' | 'high' | 'critical' = 'high') {
  logSecurityEvent({
    eventType: 'suspicious_activity',
    ipAddress,
    success: false,
    details,
    severity,
  });
}

// Request logging middleware
export function createRequestLogger() {
  return winston.format.printf((info) => {
    return `${info.timestamp} [${info.level}]: ${info.message}`;
  });
}
