import zxcvbn from 'zxcvbn';
import { z } from 'zod';

// Enhanced password validation schema
export const enhancedPasswordSchema = z.string()
  .min(12, 'Password must be at least 12 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .refine((password) => {
    // Check for at least one lowercase letter
    return /[a-z]/.test(password);
  }, 'Password must contain at least one lowercase letter')
  .refine((password) => {
    // Check for at least one uppercase letter
    return /[A-Z]/.test(password);
  }, 'Password must contain at least one uppercase letter')
  .refine((password) => {
    // Check for at least one number
    return /\d/.test(password);
  }, 'Password must contain at least one number')
  .refine((password) => {
    // Check for at least one special character
    return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  }, 'Password must contain at least one special character')
  .refine((password) => {
    // Check for no common patterns
    return !hasCommonPatterns(password);
  }, 'Password contains common patterns that are not secure')
  .refine((password) => {
    // Check password strength using zxcvbn
    const result = zxcvbn(password);
    return result.score >= 3; // Require score of 3 or higher (0-4 scale)
  }, 'Password is too weak. Please choose a stronger password');

// Enhanced user registration schema
export const enhancedRegisterUserSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(254, 'Email address too long')
    .refine((email) => {
      // Check for valid email format and common domains
      const validDomains = process.env.ALLOWED_EMAIL_DOMAINS?.split(',') || [];
      if (validDomains.length === 0) return true; // No domain restrictions
      
      const domain = email.split('@')[1]?.toLowerCase();
      return validDomains.includes(domain);
    }, 'Email domain not allowed'),
  password: enhancedPasswordSchema,
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name too long')
    .refine((name) => /^[a-zA-Z\s\-']+$/.test(name), 'First name contains invalid characters'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name too long')
    .refine((name) => /^[a-zA-Z\s\-']+$/.test(name), 'Last name contains invalid characters'),
  role: z.enum(['admin', 'manager', 'employee']).default('employee'),
});

// Password change schema (requires current password)
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: enhancedPasswordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: "New password must be different from current password",
  path: ["newPassword"],
});

// Account lockout tracking schema
export const securityEventSchema = z.object({
  userId: z.string().uuid().optional(),
  eventType: z.enum([
    'login_success',
    'login_failure',
    'password_change',
    'account_locked',
    'account_unlocked',
    'permission_denied',
    'suspicious_activity',
    'session_expired',
    'csrf_violation',
    'rate_limit_exceeded'
  ]),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  details: z.record(z.any()).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

// Utility functions for password validation
function hasCommonPatterns(password: string): boolean {
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /admin/i,
    /letmein/i,
    /welcome/i,
    /monkey/i,
    /dragon/i,
    /(.)\1{3,}/, // Four or more repeated characters
    /012345/,
    /abcdef/i,
  ];
  
  return commonPatterns.some(pattern => pattern.test(password));
}

// Check if password is in common password lists (simplified check)
export function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    'dragon', 'pass', '1234', '12345', 'password1',
    'qwerty123', 'welcome123', 'admin123', 'root', 'toor'
  ];
  
  return commonPasswords.includes(password.toLowerCase());
}

// Password strength assessment
export function assessPasswordStrength(password: string): {
  score: number;
  feedback: string[];
  isValid: boolean;
} {
  const result = zxcvbn(password);
  
  const feedback = [
    ...result.feedback.suggestions,
    ...(result.feedback.warning ? [result.feedback.warning] : [])
  ];
  
  // Additional custom feedback
  if (password.length < 12) {
    feedback.push('Use at least 12 characters for better security');
  }
  
  if (!/[A-Z]/.test(password)) {
    feedback.push('Add uppercase letters');
  }
  
  if (!/[a-z]/.test(password)) {
    feedback.push('Add lowercase letters');
  }
  
  if (!/\d/.test(password)) {
    feedback.push('Add numbers');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('Add special characters');
  }
  
  if (isCommonPassword(password)) {
    feedback.push('Avoid common passwords');
  }
  
  return {
    score: result.score,
    feedback: Array.from(new Set(feedback)), // Remove duplicates
    isValid: result.score >= 3 && password.length >= 12
  };
}

// Input sanitization helpers
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit length
}

export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  
  return email
    .trim()
    .toLowerCase()
    .slice(0, 254); // Maximum email length per RFC
}
