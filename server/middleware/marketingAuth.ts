import { Request, Response, NextFunction } from "express";
import * as bcrypt from "bcryptjs";
import { db } from "../db";
import { marketingUsers } from "../../shared/schema";
import { eq } from "drizzle-orm";
import * as jwt from "jsonwebtoken";

// Extend Request interface to include marketing user
declare global {
  namespace Express {
    interface Request {
      marketingUser?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: 'admin' | 'marketer';
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "marketing-pipeline-secret-key";

export interface MarketingJWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'marketer';
}

// Marketing Authentication Middleware
export const marketingAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as MarketingJWTPayload;
    
    // Get user from database
    const user = await db
      .select()
      .from(marketingUsers)
      .where(eq(marketingUsers.id, decoded.userId))
      .limit(1);

    if (user.length === 0 || !user[0].isActive) {
      return res.status(401).json({ error: 'Invalid token or user not found.' });
    }

    req.marketingUser = {
      id: user[0].id,
      email: user[0].email,
      firstName: user[0].firstName,
      lastName: user[0].lastName,
      role: user[0].role,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// Marketing Admin Authorization Middleware
export const marketingAdminAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.marketingUser || req.marketingUser.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

// Marketing User Authorization Middleware (Admin or own data)
export const marketingUserAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.marketingUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // Admin can access all data
  if (req.marketingUser.role === 'admin') {
    return next();
  }

  // Marketer can only access their own data
  const requestedMarketerId = req.params.marketerId || req.body.marketerId || req.query.marketerId;
  if (requestedMarketerId && requestedMarketerId !== req.marketingUser.id) {
    return res.status(403).json({ error: 'Access denied. You can only access your own data.' });
  }

  next();
};

// Generate JWT Token
export const generateMarketingToken = (user: {
  id: string;
  email: string;
  role: 'admin' | 'marketer';
}): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Hash Password
export const hashMarketingPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Verify Password
export const verifyMarketingPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};
