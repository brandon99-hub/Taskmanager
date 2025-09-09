import cors from 'cors';
import type { Express, Request, Response, NextFunction } from 'express';

export function setupCORS(app: Express) {
  const corsOptions = {
    // Allow credentials (cookies, authorization headers)
    credentials: true,
    
    // Configure allowed origins based on environment
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = getAllowedOrigins();
      
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (typeof allowedOrigin === 'string') {
          return allowedOrigin === origin;
        } else {
          return allowedOrigin.test(origin);
        }
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS: Blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    
    // Allowed HTTP methods - Enhanced
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    
    // Allowed headers - Enhanced
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token',
      'X-Request-ID',
      'X-Client-Version',
      'X-API-Key',
      'X-Forwarded-For',
      'X-Real-IP'
    ],
    
    // Expose headers to client - Enhanced
    exposedHeaders: [
      'X-CSRF-Token',
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    
    // How long to cache preflight requests (24 hours)
    maxAge: 86400,
    
    // Handle preflight requests
    preflightContinue: false,
    optionsSuccessStatus: 204,
    
    // Enhanced security options
  };
  
  app.use(cors(corsOptions));
  
  // Enhanced CORS error handling and logging
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.message === 'Not allowed by CORS') {
      // Log blocked CORS requests for security monitoring
      console.warn(`CORS Blocked: ${req.method} ${req.path} from ${req.ip} - Origin: ${req.get('Origin')}`);
      
      // Return a more secure error response
      return res.status(403).json({
        error: 'CORS Error',
        message: 'Cross-origin request not allowed',
        code: 'CORS_VIOLATION'
      });
    }
    next(err);
  });
}

function getAllowedOrigins(): (string | RegExp)[] {
  const nodeEnv = process.env.NODE_ENV;
  
  if (nodeEnv === 'production') {
    // Production: Only allow specific domains
    return [
      process.env.FRONTEND_URL || 'https://taskflow.example.com',
      'https://project.appkings.co.ke',
      'https://appkings.co.ke',
      // Add your production domain(s) here
    ].filter(Boolean);
  } else if (nodeEnv === 'development') {
    // Development: Allow local development origins
    return [
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5000',
      // Allow Vite dev server on any port
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
    ];
  } else {
    // Test environment: Allow test origins
    return [
      'http://localhost:3000',
      'http://localhost:5000',
    ];
  }
}
