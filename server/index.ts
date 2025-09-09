import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurityHeaders } from "./middleware/security";
import { setupCORS } from "./middleware/cors";
import { setupCSRFProtection } from "./middleware/csrf";
import { setupRateLimiting } from "./middleware/rateLimit";
import { auditMiddleware, requestTimingMiddleware } from "./middleware/audit";
import logger from "./utils/logger";
import path from "path";

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const app = express();

// Security middleware (order is important)
setupSecurityHeaders(app);
setupCORS(app);
setupRateLimiting(app);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CSRF protection (before routes)
setupCSRFProtection(app);

// Audit and timing middleware
app.use(requestTimingMiddleware());
app.use(auditMiddleware());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

  // Enhanced error handler with security logging
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log security-relevant errors
    if (status === 403 || status === 401 || status >= 500) {
      logger.error(`Error ${status}: ${message}`, {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id,
        stack: err.stack,
      });
    }

    // Don't expose stack traces in production
    const responseMessage = process.env.NODE_ENV === 'production' 
      ? (status >= 500 ? 'Internal Server Error' : message)
      : message;

    res.status(status).json({ 
      error: responseMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "development") {
  await setupVite(app, server);
} else {
  // Serve the built React frontend
  const publicPath = path.resolve(__dirname, "../dist/public");
  app.use(express.static(publicPath));

  // Fallback: let React handle routing
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
}

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = process.env.NODE_ENV === 'development' ? 'localhost' : '0.0.0.0';
  
    server.listen(port, host, () => {
      log(`serving on http://${host}:${port}`);
    });
  } catch (error) {
    process.exit(1);
  }
})();
