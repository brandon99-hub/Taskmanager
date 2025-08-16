import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  pgEnum,
  inet,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Security event types enum
export const securityEventTypeEnum = pgEnum("security_event_type", [
  "auth_success",
  "auth_failure", 
  "auth_logout",
  "user_registration",
  "registration_failure",
  "password_change",
  "password_reset_request",
  "password_reset_success",
  "account_lockout",
  "account_unlock",
  "permission_denied",
  "unauthorized_access",
  "resource_modification",
  "resource_deletion",
  "modification_failure",
  "deletion_failure",
  "suspicious_activity",
  "session_expired",
  "csrf_violation",
  "rate_limit_exceeded",
  "server_error",
  "security_scan_detected",
  "brute_force_detected",
  "unknown"
]);

// Security event severity enum
export const securityEventSeverityEnum = pgEnum("security_event_severity", [
  "low",
  "medium", 
  "high",
  "critical"
]);

// Security events table
export const securityEvents = pgTable(
  "security_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id"), // References users.id but nullable for anonymous events
    eventType: securityEventTypeEnum("event_type").notNull(),
    eventDetails: jsonb("event_details"), // Additional context data
    ipAddress: inet("ip_address"), // Store IP address as inet type
    userAgent: text("user_agent"), // Browser/client information
    success: boolean("success").notNull().default(false),
    severity: securityEventSeverityEnum("severity").notNull().default("medium"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Additional fields for investigation
    sessionId: varchar("session_id"), // Associated session if available
    requestId: varchar("request_id"), // For tracing requests
    source: varchar("source").default("taskflow"), // Source system
  },
  (table) => [
    // Indexes for efficient querying
    index("idx_security_events_user_id").on(table.userId),
    index("idx_security_events_event_type").on(table.eventType),
    index("idx_security_events_severity").on(table.severity),
    index("idx_security_events_created_at").on(table.createdAt),
    index("idx_security_events_ip_address").on(table.ipAddress),
    index("idx_security_events_success").on(table.success),
    // Composite indexes for common queries
    index("idx_security_events_user_type").on(table.userId, table.eventType),
    index("idx_security_events_ip_type").on(table.ipAddress, table.eventType),
    index("idx_security_events_date_severity").on(table.createdAt, table.severity),
  ]
);

// Failed login attempts tracking table
export const failedLoginAttempts = pgTable(
  "failed_login_attempts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    identifier: varchar("identifier").notNull(), // IP address or email
    identifierType: varchar("identifier_type").notNull(), // 'ip' or 'email'
    attemptCount: varchar("attempt_count").notNull().default("0"),
    lastAttemptAt: timestamp("last_attempt_at").defaultNow().notNull(),
    lockoutUntil: timestamp("lockout_until"), // When lockout expires
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_failed_attempts_identifier").on(table.identifier),
    index("idx_failed_attempts_lockout").on(table.lockoutUntil),
    index("idx_failed_attempts_last_attempt").on(table.lastAttemptAt),
  ]
);

// User session tracking table
export const userSessions = pgTable(
  "user_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(), // References users.id
    sessionId: varchar("session_id").notNull().unique(),
    deviceFingerprint: varchar("device_fingerprint"), // Browser fingerprint
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    location: varchar("location"), // Approximate location from IP
    isActive: boolean("is_active").notNull().default(true),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"), // Session expiration
  },
  (table) => [
    index("idx_user_sessions_user_id").on(table.userId),
    index("idx_user_sessions_session_id").on(table.sessionId),
    index("idx_user_sessions_ip_address").on(table.ipAddress),
    index("idx_user_sessions_active").on(table.isActive),
    index("idx_user_sessions_last_activity").on(table.lastActivityAt),
    index("idx_user_sessions_expires").on(table.expiresAt),
  ]
);

// Security settings table (for user-specific security configurations)
export const userSecuritySettings = pgTable(
  "user_security_settings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().unique(), // References users.id
    failedLoginAttempts: varchar("failed_login_attempts").notNull().default("0"),
    accountLockedUntil: timestamp("account_locked_until"),
    lastPasswordChange: timestamp("last_password_change"),
    passwordHistory: jsonb("password_history"), // Store hashes of previous passwords
    securityQuestions: jsonb("security_questions"), // Security questions/answers
    loginNotifications: boolean("login_notifications").notNull().default(true),
    suspiciousActivityAlerts: boolean("suspicious_activity_alerts").notNull().default(true),
    sessionTimeout: varchar("session_timeout").default("3600"), // Custom session timeout in seconds
    allowedIpRanges: jsonb("allowed_ip_ranges"), // IP whitelist if configured
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_user_security_user_id").on(table.userId),
    index("idx_user_security_locked_until").on(table.accountLockedUntil),
    index("idx_user_security_password_change").on(table.lastPasswordChange),
  ]
);

// Insert schemas for validation
export const insertSecurityEventSchema = createInsertSchema(securityEvents).omit({
  id: true,
  createdAt: true,
});

export const insertFailedLoginAttemptSchema = createInsertSchema(failedLoginAttempts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

export const insertUserSecuritySettingsSchema = createInsertSchema(userSecuritySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;

export type FailedLoginAttempt = typeof failedLoginAttempts.$inferSelect;
export type InsertFailedLoginAttempt = z.infer<typeof insertFailedLoginAttemptSchema>;

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

export type UserSecuritySettings = typeof userSecuritySettings.$inferSelect;
export type InsertUserSecuritySettings = z.infer<typeof insertUserSecuritySettingsSchema>;
