import helmet from 'helmet';
import type { Express } from 'express';

export function setupSecurityHeaders(app: Express) {
  // Configure Helmet for comprehensive security headers
  app.use(helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", // Required for Tailwind CSS
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com"
        ],
        scriptSrc: [
          "'self'",
          process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : "'none'"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "blob:"
        ],
        connectSrc: [
          "'self'",
          process.env.NODE_ENV === 'development' ? "ws://localhost:*" : "'none'"
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
      reportOnly: process.env.NODE_ENV === 'development',
    },
    
    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Disable for compatibility
    
    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false
    },
    
    // Frame Options
    frameguard: {
      action: 'deny'
    },
    
    // Hide Powered-By header
    hidePoweredBy: true,
    
    // HSTS (HTTP Strict Transport Security)
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    
    // IE No Open
    ieNoOpen: true,
    
    // No Sniff
    noSniff: true,
    
    // Origin Agent Cluster
    originAgentCluster: true,
    
    // Permitted Cross-Domain Policies
    permittedCrossDomainPolicies: false,
    
    // Referrer Policy
    referrerPolicy: {
      policy: ['strict-origin-when-cross-origin']
    },
    
    // X-XSS-Protection
    xssFilter: true,
  }));
}
