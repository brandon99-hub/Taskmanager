import cors from 'cors';
import type { Express } from 'express';

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
    
    // Allowed HTTP methods
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    
    // Allowed headers
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token'
    ],
    
    // Expose headers to client
    exposedHeaders: ['X-CSRF-Token'],
    
    // How long to cache preflight requests (24 hours)
    maxAge: 86400,
    
    // Handle preflight requests
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
  
  app.use(cors(corsOptions));
}

function getAllowedOrigins(): (string | RegExp)[] {
  const nodeEnv = process.env.NODE_ENV;
  
  if (nodeEnv === 'production') {
    // Production: Only allow specific domains
    return [
      process.env.FRONTEND_URL || 'https://taskflow.example.com',
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
