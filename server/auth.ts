import bcrypt from 'bcryptjs';
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { registerUserSchema, loginUserSchema, type RegisterUser, type LoginUser } from "@shared/schema";
import { enhancedRegisterUserSchema, enhancedPasswordSchema, assessPasswordStrength } from "./middleware/validation";
import { trackFailedLogin, isAccountLocked, clearFailedAttempts } from "./middleware/audit";
import { logAuthSuccess, logAuthFailure, logAccountLockout } from "./utils/logger";
import { z } from "zod";

export function getSession() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    name: 'taskflow-session',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? 'strict' : 'lax',
      maxAge: sessionTtl,
    },
    rolling: true, // Extend session on activity
    unset: 'destroy', // Destroy session when unset
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
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy for email/password authentication
  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        const clientIP = ''; // Will be set by middleware
        const userAgent = ''; // Will be set by middleware
        
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
            message: 'Invalid email or password',
            attemptsRemaining: Math.min(lockInfo.attemptsRemaining, ipLockInfo.attemptsRemaining)
          });
        }

        if (!user.isActive) {
          logAuthFailure(email, clientIP, userAgent, 'Account deactivated');
          return done(null, false, { message: 'Account is deactivated' });
        }

        const isValidPassword = await verifyPassword(password, user.password);
        if (!isValidPassword) {
          const lockInfo = trackFailedLogin(email);
          const ipLockInfo = trackFailedLogin(clientIP);
          
          logAuthFailure(email, clientIP, userAgent, 'Invalid password');
          
          if (lockInfo.shouldLock || ipLockInfo.shouldLock) {
            logAccountLockout(user.id, email, clientIP);
          }
          
          return done(null, false, { 
            message: 'Invalid email or password',
            attemptsRemaining: Math.min(lockInfo.attemptsRemaining, ipLockInfo.attemptsRemaining)
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
      console.error("Registration error:", error);
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
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info.message || 'Authentication failed' });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
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
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
