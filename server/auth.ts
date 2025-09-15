import * as bcrypt from 'bcryptjs';
import * as passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import * as connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { emailService } from "./services/emailService";
import { registerUserSchema, loginUserSchema, type RegisterUser, type LoginUser } from "../shared/schema";
import { enhancedRegisterUserSchema, enhancedPasswordSchema, assessPasswordStrength } from "./middleware/validation";
import { trackFailedLogin, isAccountLocked, clearFailedAttempts } from "./middleware/audit";
import { logAuthSuccess, logAuthFailure, logAccountLockout } from "./utils/logger";
import { z } from "zod";
import * as crypto from "crypto";

export function getSession() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Idle timeout in minutes (default 30). Matches cookie maxAge and store TTL.
  const sessionTtl = parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES || "30", 10) * 60 * 1000;

  // Robust connect-pg-simple import for both ESM/CJS
  const PgSessionFactory: any = (connectPg as any).default ?? (connectPg as any);
  const PgStore = PgSessionFactory(session);
  const sessionStore = new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const isSecureCookie =
    (process.env.COOKIE_SECURE ?? (process.env.NODE_ENV === "production" ? "true" : "false")) === "true";

  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    name: "taskflow-session",
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: "lax",
      maxAge: sessionTtl,
      path: "/",
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
    // Sliding expiration: extends on every request so users stay logged in while active
    rolling: true,
    unset: "destroy",
  });
}

export async function hashPassword(password: string): Promise<string> {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setupAuth(app: Express) {
  // Respect deployment proxy configuration (0/false = direct, 1 = single proxy)
  app.set("trust proxy", process.env.TRUST_PROXY === '1' ? 1 : false);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy for email/password authentication
  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true // This allows us to access the request object
    },
    async (req: any, email, password, done) => {
      try {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        
        // Check if account is locked
        if (isAccountLocked(email) || isAccountLocked(clientIP)) {
          logAuthFailure(email, clientIP, userAgent, 'Account locked');
          return done(null, false, { message: 'Account temporarily locked due to too many failed attempts' });
        }

        const user = await storage.getUserByEmail(email);
        if (!user) {
          const lockInfo = trackFailedLogin(email);
          const ipLockInfo = trackFailedLogin(clientIP);
          
          logAuthFailure(email, clientIP, userAgent, 'User not found');
          
          if (lockInfo.shouldLock || ipLockInfo.shouldLock) {
            logAccountLockout('', email, clientIP);
          }
          
          return done(null, false, { 
            message: 'Invalid email or password'
          });
        }

        if (!user.isActive) {
          logAuthFailure(email, clientIP, userAgent, 'Account deactivated');
          return done(null, false, { message: 'Account is deactivated' });
        }

        const isValidPassword = await verifyPassword(password, user.password);
        
        // Also check temporary password if it exists and user must change password
        const isValidTempPassword = user.temporaryPassword && user.mustChangePassword && 
          password === user.temporaryPassword;
        
        if (!isValidPassword && !isValidTempPassword) {
          const lockInfo = trackFailedLogin(email);
          const ipLockInfo = trackFailedLogin(clientIP);
          
          logAuthFailure(email, clientIP, userAgent, 'Invalid password');
          
          if (lockInfo.shouldLock || ipLockInfo.shouldLock) {
            logAccountLockout(user.id, email, clientIP);
          }
          
          return done(null, false, { 
            message: 'Invalid email or password'
          });
        }

        // Clear failed attempts on successful login
        clearFailedAttempts(email);
        clearFailedAttempts(clientIP);

        // Update last login
        await storage.updateUserLastLogin(user.id);
        
        // Log successful authentication
        logAuthSuccess(user.id, email, clientIP, userAgent);

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Register endpoint with enhanced validation
  app.post('/api/auth/register', async (req, res) => {
    try {
      // Use enhanced validation schema
      const userData = enhancedRegisterUserSchema.parse(req.body);
      
      // Additional password strength check
      const passwordStrength = assessPasswordStrength(userData.password);
      if (!passwordStrength.isValid) {
        return res.status(400).json({ 
          message: "Password does not meet security requirements",
          feedback: passwordStrength.feedback,
          score: passwordStrength.score
        });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      // Hash password with enhanced security
      const hashedPassword = await hashPassword(userData.password);

      // Create user with enhanced security settings
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Log registration event
      const clientIP = req.ip || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      logAuthSuccess(user.id, userData.email, clientIP, userAgent);

      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  // Login endpoint
  app.post('/api/auth/login', (req, res, next) => {
    try {
      loginUserSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
    }

    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || 'Authentication failed' });

      // Regenerate session to prevent fixation, then log in and force a save so Set-Cookie is sent
      (req as any).session.regenerate((regenErr: any) => {
        if (regenErr) return next(regenErr);

        req.logIn(user, (loginErr) => {
          if (loginErr) return next(loginErr);

          (req as any).session.save((saveErr: any) => {
            if (saveErr) return next(saveErr);

            if (process.env.DEBUG_AUTH === "true") {
              console.warn("auth-cookie-debug", {
                secureReq: req.secure,
                xfp: req.get("x-forwarded-proto"),
                sessionId: (req as any).sessionID,
              });
            }

            const { password, ...userWithoutPassword } = user;
            return res.json(userWithoutPassword);
          });
        });
      });
    })(req, res, next);
  });
  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user endpoint
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Forgot password endpoint
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({ message: "If an account with that email exists, we've sent a reset link" });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token in user record
      await storage.updateUserResetToken(user.id, resetToken, resetTokenExpiry);

      // Send email with reset link (no localhost fallback)
      const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
      const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
      await emailService.sendPasswordResetEmail({
        to: user.email,
        userName: user.firstName || user.email,
        resetLink: resetLink,
        unsubscribeUrl: `${baseUrl}/home`,
        preferencesUrl: `${baseUrl}/home`
      });

      res.json({ message: "If an account with that email exists, we've sent a reset link" });
    } catch (error) {
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Reset password endpoint
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      // Verify token and update password
      const user = await storage.getUserByResetToken(token);
      if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user password and clear reset token
      await storage.updateUserPassword(user.id, hashedPassword);
      await storage.updateUserResetToken(user.id, null, null);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
