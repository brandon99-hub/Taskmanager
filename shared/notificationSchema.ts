import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  boolean,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";

// User Notification Preferences Table
export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull().unique(),
    
    // Email Notification Preferences
    emailTaskAssigned: boolean("email_task_assigned").notNull().default(true),
    emailTaskDueSoon: boolean("email_task_due_soon").notNull().default(true),
    emailTaskOverdue: boolean("email_task_overdue").notNull().default(true),
    emailProjectDeadline: boolean("email_project_deadline").notNull().default(true),
    emailTeamUpdates: boolean("email_team_updates").notNull().default(false),
    
    // In-App Notification Preferences
    inAppTaskAssigned: boolean("in_app_task_assigned").notNull().default(true),
    inAppTaskDueSoon: boolean("in_app_task_due_soon").notNull().default(true),
    inAppTaskOverdue: boolean("in_app_task_overdue").notNull().default(true),
    inAppProjectDeadline: boolean("in_app_project_deadline").notNull().default(true),
    inAppTeamUpdates: boolean("in_app_team_updates").notNull().default(true),
    
    // Timing Preferences
    dueSoonDays: integer("due_soon_days").notNull().default(2), // Days before due date to send reminder
    reminderTime: varchar("reminder_time", { length: 5 }).notNull().default("09:00"), // Time of day for reminders (HH:MM)
    
    // Google Calendar Integration
    googleCalendarEnabled: boolean("google_calendar_enabled").notNull().default(false),
    googleCalendarAccessToken: text("google_calendar_access_token"), // Encrypted token
    googleCalendarRefreshToken: text("google_calendar_refresh_token"), // Encrypted token
    googleCalendarSyncDeadlines: boolean("google_calendar_sync_deadlines").notNull().default(true),
    googleCalendarReminderMinutes: integer("google_calendar_reminder_minutes").notNull().default(60),
    googleCalendarId: varchar("google_calendar_id"), // Primary calendar ID
    googleCalendarLastSync: timestamp("google_calendar_last_sync"),
    
    // Unsubscribe Token for Email Links
    unsubscribeToken: varchar("unsubscribe_token").unique(),
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_user_notification_prefs_user_id").on(table.userId),
    index("idx_user_notification_prefs_unsubscribe").on(table.unsubscribeToken),
    index("idx_user_notification_prefs_google_sync").on(table.googleCalendarLastSync),
  ]
);

// Email Queue Table for Reliable Email Delivery
export const emailQueue = pgTable(
  "email_queue",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    toEmail: varchar("to_email").notNull(),
    fromEmail: varchar("from_email").notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body"),
    templateName: varchar("template_name", { length: 100 }),
    templateData: text("template_data"), // JSON string of template variables
    
    // Queue Management
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, sent, failed, retry
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastAttemptAt: timestamp("last_attempt_at"),
    nextRetryAt: timestamp("next_retry_at"),
    sentAt: timestamp("sent_at"),
    
    // Error Handling
    errorMessage: text("error_message"),
    
    // Metadata
    userId: varchar("user_id").references(() => users.id),
    relatedTaskId: varchar("related_task_id"),
    relatedProjectId: varchar("related_project_id"),
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_email_queue_status").on(table.status),
    index("idx_email_queue_next_retry").on(table.nextRetryAt),
    index("idx_email_queue_user_id").on(table.userId),
    index("idx_email_queue_created_at").on(table.createdAt),
  ]
);

// Google Calendar Events Table (for sync tracking)
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    taskId: varchar("task_id").notNull(), // References tasks.id
    googleEventId: varchar("google_event_id").notNull().unique(),
    googleCalendarId: varchar("google_calendar_id").notNull(),
    
    // Event Details
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    startDateTime: timestamp("start_date_time").notNull(),
    endDateTime: timestamp("end_date_time").notNull(),
    
    // Sync Status
    syncStatus: varchar("sync_status", { length: 20 }).notNull().default("synced"), // synced, pending, failed
    lastSyncAt: timestamp("last_sync_at").defaultNow(),
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_calendar_events_user_id").on(table.userId),
    index("idx_calendar_events_task_id").on(table.taskId),
    index("idx_calendar_events_google_id").on(table.googleEventId),
    index("idx_calendar_events_sync_status").on(table.syncStatus),
  ]
);

// Insert schemas for validation
export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailQueueSchema = createInsertSchema(emailQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Validation schemas for API endpoints
export const updateNotificationPreferencesSchema = z.object({
  // Email preferences
  emailTaskAssigned: z.boolean().optional(),
  emailTaskDueSoon: z.boolean().optional(),
  emailTaskOverdue: z.boolean().optional(),
  emailProjectDeadline: z.boolean().optional(),
  emailTeamUpdates: z.boolean().optional(),
  
  // In-app preferences
  inAppTaskAssigned: z.boolean().optional(),
  inAppTaskDueSoon: z.boolean().optional(),
  inAppTaskOverdue: z.boolean().optional(),
  inAppProjectDeadline: z.boolean().optional(),
  inAppTeamUpdates: z.boolean().optional(),
  
  // Timing preferences
  dueSoonDays: z.number().min(1).max(7).optional(),
  reminderTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:MM format
});

export const googleCalendarSettingsSchema = z.object({
  googleCalendarEnabled: z.boolean(),
  googleCalendarSyncDeadlines: z.boolean().optional(),
  googleCalendarReminderMinutes: z.number().min(0).max(1440).optional(), // 0-24 hours in minutes
});

// Types
export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreferences = z.infer<typeof insertUserNotificationPreferencesSchema>;
export type UpdateNotificationPreferences = z.infer<typeof updateNotificationPreferencesSchema>;

export type EmailQueue = typeof emailQueue.$inferSelect;
export type InsertEmailQueue = z.infer<typeof insertEmailQueueSchema>;

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

export type GoogleCalendarSettings = z.infer<typeof googleCalendarSettingsSchema>;
