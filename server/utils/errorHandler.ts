import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Centralized error handler wrapper for async routes
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Centralized API response helpers
export const apiResponse = {
  success: (res: Response, data?: any, message?: string, statusCode: number = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  },

  error: (res: Response, message: string, statusCode: number = 500, errors?: any) => {
    return res.status(statusCode).json({
      success: false,
      message,
      errors
    });
  },

  validationError: (res: Response, error: z.ZodError) => {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }
};

// Permission checking middleware
export const requireRole = (roles: string[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role)) {
      return apiResponse.error(res, 'Insufficient permissions', 403);
    }
    next();
  };
};

// Common error handler for consistent API responses
export const handleApiError = (error: any, operation: string, res: Response) => {
  console.error(`Error in ${operation}:`, error);
  
  if (error instanceof z.ZodError) {
    return apiResponse.validationError(res, error);
  }
  
  if (error instanceof AppError) {
    return apiResponse.error(res, error.message, error.statusCode);
  }
  
  // Generic error
  return apiResponse.error(res, `Failed to ${operation}`, 500);
};
