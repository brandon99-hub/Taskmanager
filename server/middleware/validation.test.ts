import { enhancedPasswordSchema, enhancedRegisterUserSchema } from './validation';
import { z } from 'zod';

describe('Password Validation Schema', () => {
  test('should accept valid password', () => {
    const validPassword = 'SecurePass123!';
    const result = enhancedPasswordSchema.safeParse(validPassword);
    expect(result.success).toBe(true);
  });

  test('should reject password shorter than 12 characters', () => {
    const shortPassword = 'Short1!';
    const result = enhancedPasswordSchema.safeParse(shortPassword);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Password must be at least 12 characters long');
    }
  });

  test('should reject password without uppercase letter', () => {
    const noUppercasePassword = 'lowercase123!';
    const result = enhancedPasswordSchema.safeParse(noUppercasePassword);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some(err => err.message.includes('uppercase'))).toBe(true);
    }
  });

  test('should reject password without lowercase letter', () => {
    const noLowercasePassword = 'UPPERCASE123!';
    const result = enhancedPasswordSchema.safeParse(noLowercasePassword);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some(err => err.message.includes('lowercase'))).toBe(true);
    }
  });

  test('should reject password without number', () => {
    const noNumberPassword = 'NoNumbers!';
    const result = enhancedPasswordSchema.safeParse(noNumberPassword);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some(err => err.message.includes('number'))).toBe(true);
    }
  });

  test('should reject password without special character', () => {
    const noSpecialPassword = 'NoSpecial123';
    const result = enhancedPasswordSchema.safeParse(noSpecialPassword);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some(err => err.message.includes('special character'))).toBe(true);
    }
  });
});

describe('Registration Schema', () => {
  test('should accept valid registration data', () => {
    const validData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'employee' as const
    };
    const result = enhancedRegisterUserSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'employee' as const
    };
    const result = enhancedRegisterUserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some(err => err.message.includes('email'))).toBe(true);
    }
  });

  test('should reject weak password', () => {
    const weakPasswordData = {
      email: 'test@example.com',
      password: 'weak',
      firstName: 'John',
      lastName: 'Doe',
      role: 'employee' as const
    };
    const result = enhancedRegisterUserSchema.safeParse(weakPasswordData);
    expect(result.success).toBe(false);
  });
});
