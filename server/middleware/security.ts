import helmet from 'helmet';
import type { Express, Request, Response, NextFunction } from 'express';

export function setupSecurityHeaders(app: Express) {
  // Enhanced Helmet configuration with stricter security
  app.use(helmet({
    // Content Security Policy - Enhanced with nonce support
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", // Required for Tailwind CSS
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net" // For any CDN resources
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdn.jsdelivr.net"
        ],
        scriptSrc: [
          "'self'",
          process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : "'none'",
          "'strict-dynamic'", // Allow dynamic script loading with nonce
          "https://cdn.jsdelivr.net"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "blob:",
          "https://cdn.jsdelivr.net"
        ],
        connectSrc: [
          "'self'",
          ...(process.env.NODE_ENV === 'development' ? ["ws://localhost:*"] : []),
          // Explicitly allow your deployed origin (redundant with 'self' when same-origin, but harmless)
          "https://project.appkings.co.ke"
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        // Enhanced CSP with additional protections
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        prefetchSrc: ["'self'"],
        navigateTo: ["'self'"],
        requireTrustedTypesFor: ["'script'"],
      },
      reportOnly: process.env.NODE_ENV === 'development',
    },
    
    // Cross-Origin Embedder Policy - Enhanced
    crossOriginEmbedderPolicy: {
      policy: "require-corp"
    },
    
    // DNS Prefetch Control - Enhanced
    dnsPrefetchControl: {
      allow: false
    },
    
    // Frame Options - Enhanced
    frameguard: {
      action: 'deny'
    },
    
    // Hide Powered-By header
    hidePoweredBy: true,
    
    // HSTS (HTTP Strict Transport Security) - Enhanced
    hsts: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true
    },
    
    // IE No Open
    ieNoOpen: true,
    
    // No Sniff
    noSniff: true,
    
    // Origin Agent Cluster - Enhanced
    originAgentCluster: true,
    
    // Permitted Cross-Domain Policies - Enhanced
    permittedCrossDomainPolicies: {
      permittedPolicies: "none"
    },
    
    // Referrer Policy - Enhanced
    referrerPolicy: {
      policy: ['strict-origin-when-cross-origin', 'strict-origin']
    },
    
    // X-XSS-Protection - Enhanced
    xssFilter: true,
    
    // Additional security headers
    crossOriginResourcePolicy: {
      policy: "same-site"
    },
    
    crossOriginOpenerPolicy: {
      policy: "same-origin-allow-popups"
    },
  }));

  // Additional custom security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // X-Frame-Options (redundant with frameguard but extra protection)
    res.setHeader('X-Frame-Options', 'DENY');
    
    // X-Permitted-Cross-Domain-Policies
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    // X-Download-Options (IE specific)
    res.setHeader('X-Download-Options', 'noopen');
    
    // X-DNS-Prefetch-Control
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    
    // Permissions Policy (formerly Feature Policy)
    res.setHeader('Permissions-Policy', 
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    );
    
    // Clear-Site-Data (for logout scenarios)
    if (req.path === '/api/auth/logout') {
      res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
    }
    
    // Security headers for sensitive endpoints
    if (req.path.includes('/api/auth/') || req.path.includes('/api/admin/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    next();
  });
}
