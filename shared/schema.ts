import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  pgEnum,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table (updated for local auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(), // Added for local auth
  firstName: varchar("first_name"),
  middleName: varchar("middle_name"), // Added for personnel import
  lastName: varchar("last_name"),
  phoneNumber: varchar("phone_number"), // Added for personnel import
  idNumber: varchar("id_number"), // Added for personnel import
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).notNull().default("employee"),
  isActive: boolean("is_active").notNull().default(true), // Added for account management
  lastLoginAt: timestamp("last_login_at"),
  resetToken: text("reset_token"), // Added for password reset
  resetTokenExpiry: timestamp("reset_token_expiry"), // Added for password reset
  // New credential fields
  temporaryPassword: varchar("temporary_password"),
  passwordGeneratedAt: timestamp("password_generated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project priorities and statuses
export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
  "terminated", // Added terminated status
  "on_support", // Added on_support status
]);

// Project segments for categorization
export const projectSegmentEnum = pgEnum("project_segment", [
  "academic",
  "parastals",
  "private",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo", // Will display as "Not Started" in frontend
  "in_progress",
  "qa", // Added QA status
  "client_review", // Added client review status
  "done", // Will display as "Completed" in frontend
  "delayed", // Added delayed status
  "on_hold", // Added on hold status
  "cancelled", // Added cancelled status
]);

// Billing lifecycle for milestones (keeping as billingStatus in DB, will display as Invoice Status in frontend)
export const billingStatusEnum = pgEnum("billing_status", [
  "none",       // Will display as "Not Sent" in frontend
  "to_send",    // milestone completed, invoice should be sent
  "sent",       // invoice sent
  "paid",       // payment received
  "overdue",    // 30 days passed since invoice sent
  "processing", // payment being processed
]);

// Segment leaders table
export const segmentLeaders = pgTable("segment_leaders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  segment: projectSegmentEnum("segment").notNull(),
  leaderEmail: varchar("leader_email").notNull(),
  leaderName: varchar("leader_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueSegment: index("unique_segment").on(table.segment),
}));

// Employee roles table
export const employeeRoles = pgTable("employee_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleName: varchar("role_name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Team member roles table
export const teamMemberRoles = pgTable("team_member_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").references(() => teamMembers.id, { onDelete: 'cascade' }).notNull(),
  roleId: varchar("role_id").references(() => employeeRoles.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueTeamMemberRole: index("unique_team_member_role").on(table.teamMemberId, table.roleId),
}));

// External notification recipients table
export const externalNotificationRecipients = pgTable("external_notification_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 50 }).notNull(), // 'finance' or 'account_manager'
  email: varchar("email").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTypeEmail: index("unique_type_email").on(table.type, table.email),
}));

// System configuration table for storing global settings
export const systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueKey: index("unique_key").on(table.key),
}));

// Teams table
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  segment: projectSegmentEnum("segment").notNull().default("private"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Projects table (keeping existing structure, adding new contact fields)
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(), // Keep existing name field
  description: text("description").notNull(), // Keep existing description field
  client: varchar("client", { length: 200 }),
  // New contact fields
  contactPerson: varchar("contact_person"),
  contactPhone: varchar("contact_phone"),
  contactEmail: varchar("contact_email"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: projectStatusEnum("status").notNull().default("planning"),
  segment: projectSegmentEnum("segment").notNull().default("private"), // Added segment field
  budget: decimal("budget", { precision: 12, scale: 2 }), // Keep as budget in DB, will display as Contract Amount in frontend
  teamId: varchar("team_id").references(() => teams.id),
  managerId: varchar("manager_id").references(() => users.id).notNull(),
  progress: integer("progress").notNull().default(0), // percentage 0-100
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tasks table (keeping existing structure, adding weight field)
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  status: taskStatusEnum("status").notNull().default("todo"),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours").default(0),
  // Financials / assignment additions for milestones
  feeAmount: decimal("fee_amount", { precision: 12, scale: 2 }),
  billingStatus: billingStatusEnum("billing_status").notNull().default("none"),
  // New weight field for milestone calculations
  weight: integer("weight").default(2), // Calculated from priority: low=1, medium=2, high=3, critical=4
  // Invoice and collection dates
  expectedInvoiceDate: timestamp("expected_invoice_date"), // Added expected invoice date
  expectedCollectionDate: timestamp("expected_collection_date"), // Added expected collection date
  // Invoice tracking fields
  invoiceSentAt: timestamp("invoice_sent_at"), // When invoice was actually sent
  paymentReceivedAt: timestamp("payment_received_at"), // When payment was received
  overdueFlag: boolean("overdue_flag").default(false), // Flag for overdue milestones
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  assignedTeamId: varchar("assigned_team_id").references(() => teams.id),
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  completedAt: timestamp("completed_at"),
  progressPercent: integer("progress_percent").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team memberships
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").references(() => teams.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role", { length: 50 }).default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Project attachments
export const projectAttachments = pgTable("project_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  uploadedById: varchar("uploaded_by_id").references(() => users.id).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Task dependencies
export const taskDependencies = pgTable("task_dependencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  dependsOnTaskId: varchar("depends_on_task_id").references(() => tasks.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // task_assigned, task_overdue, project_deadline, etc.
  relatedId: varchar("related_id"), // task_id or project_id
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// User notification preferences table
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  emailTaskAssigned: boolean("email_task_assigned").default(true),
  emailTaskDueSoon: boolean("email_task_due_soon").default(true),
  emailTaskOverdue: boolean("email_task_overdue").default(true),
  emailProjectDeadline: boolean("email_project_deadline").default(true),
  emailTeamUpdates: boolean("email_team_updates").default(false),
  inAppTaskAssigned: boolean("in_app_task_assigned").default(true),
  inAppTaskDueSoon: boolean("in_app_task_due_soon").default(true),
  inAppTaskOverdue: boolean("in_app_task_overdue").default(true),
  inAppProjectDeadline: boolean("in_app_project_deadline").default(true),
  inAppTeamUpdates: boolean("in_app_team_updates").default(true),
  dueSoonDays: integer("due_soon_days").default(2),
  reminderTime: varchar("reminder_time", { length: 5 }).default('09:00'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Google Calendar settings table
export const userCalendarSettings = pgTable("user_calendar_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  isConnected: boolean("is_connected").default(false),
  syncEnabled: boolean("sync_enabled").default(false),
  calendarName: varchar("calendar_name", { length: 255 }),
  reminderTime: varchar("reminder_time", { length: 5 }).default('09:00'),
  syncFrequency: varchar("sync_frequency", { length: 20 }).default('daily'),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiry: timestamp("google_token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  managedProjects: many(projects, { relationName: "manager" }),
  assignedTasks: many(tasks, { relationName: "assignee" }),
  createdTasks: many(tasks, { relationName: "creator" }),
  teamMemberships: many(teamMembers),
  notifications: many(notifications),
  uploadedAttachments: many(projectAttachments),
  sentInvoices: many(invoiceReports, { relationName: "sentBy" }),
  collectedInvoices: many(invoiceCollections, { relationName: "collectedBy" }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  projects: many(projects),
  members: many(teamMembers),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  manager: one(users, {
    fields: [projects.managerId],
    references: [users.id],
    relationName: "manager",
  }),
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
  tasks: many(tasks),
  attachments: many(projectAttachments),
  invoices: many(invoiceReports),
  collections: many(invoiceCollections),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  assignedUser: one(users, {
    fields: [tasks.assignedUserId],
    references: [users.id],
    relationName: "assignee",
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: "creator",
  }),
  dependencies: many(taskDependencies, { relationName: "task" }),
  dependentTasks: many(taskDependencies, { relationName: "dependsOn" }),
  invoices: many(invoiceReports),
  collections: many(invoiceCollections),
}));

export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  roles: many(teamMemberRoles),
}));

export const teamMemberRolesRelations = relations(teamMemberRoles, ({ one }) => ({
  teamMember: one(teamMembers, {
    fields: [teamMemberRoles.teamMemberId],
    references: [teamMembers.id],
  }),
  role: one(employeeRoles, {
    fields: [teamMemberRoles.roleId],
    references: [employeeRoles.id],
  }),
}));

export const employeeRolesRelations = relations(employeeRoles, ({ many }) => ({
  teamMemberRoles: many(teamMemberRoles),
}));

export const segmentLeadersRelations = relations(segmentLeaders, ({ many }) => ({
  projects: many(projects, { relationName: "segmentLeader" }),
}));

export const externalNotificationRecipientsRelations = relations(externalNotificationRecipients, ({ one }) => ({
  // No direct relations needed for now
}));

export const systemConfigRelations = relations(systemConfig, ({ one }) => ({
  // No direct relations needed for now
}));

export const projectAttachmentsRelations = relations(projectAttachments, ({ one }) => ({
  project: one(projects, {
    fields: [projectAttachments.projectId],
    references: [projects.id],
  }),
  uploadedBy: one(users, {
    fields: [projectAttachments.uploadedById],
    references: [users.id],
  }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
    relationName: "task",
  }),
  dependsOnTask: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId],
    references: [tasks.id],
    relationName: "dependsOn",
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
});

// Schema for registration (includes password)
export const registerUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "manager", "employee"]).default("employee"),
});

// Schema for login
export const loginUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  progress: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  actualHours: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertProjectAttachmentSchema = createInsertSchema(projectAttachments).omit({
  id: true,
  uploadedAt: true,
});

export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  isRead: true,
  createdAt: true,
});

export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type UpdateTeam = Partial<InsertTeam>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

export type ProjectAttachment = typeof projectAttachments.$inferSelect;
export type InsertProjectAttachment = z.infer<typeof insertProjectAttachmentSchema>;

export type TaskDependency = typeof taskDependencies.$inferSelect;
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreferences = typeof userNotificationPreferences.$inferInsert;

export type UserCalendarSettings = typeof userCalendarSettings.$inferSelect;
export type InsertUserCalendarSettings = typeof userCalendarSettings.$inferInsert;

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;

export type InvoiceReport = typeof invoiceReports.$inferSelect;
export type InsertInvoiceReport = typeof invoiceReports.$inferInsert;

export type MonthlyTarget = typeof monthlyTargets.$inferSelect;
export type InsertMonthlyTarget = typeof monthlyTargets.$inferInsert;

export type InvoiceCollection = typeof invoiceCollections.$inferSelect;
export type InsertInvoiceCollection = typeof invoiceCollections.$inferInsert;

export type RegisterUser = z.infer<typeof registerUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;

// New types for new tables
export type SegmentLeader = typeof segmentLeaders.$inferSelect;
export type InsertSegmentLeader = typeof segmentLeaders.$inferInsert;

export type EmployeeRole = typeof employeeRoles.$inferSelect;
export type InsertEmployeeRole = typeof employeeRoles.$inferInsert;

export type TeamMemberRole = typeof teamMemberRoles.$inferSelect;
export type InsertTeamMemberRole = typeof teamMemberRoles.$inferInsert;

export type ExternalNotificationRecipient = typeof externalNotificationRecipients.$inferSelect;
export type InsertExternalNotificationRecipient = typeof externalNotificationRecipients.$inferInsert;

// Invoice reports table for tracking sent invoices
export const invoiceReports = pgTable("invoice_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).unique().notNull(),
  invoiceDate: timestamp("invoice_date").notNull(),
  expectedCollectionDate: timestamp("expected_collection_date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("sent"), // sent, paid, overdue
  sentBy: varchar("sent_by").references(() => users.id).notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Monthly targets table (auto-calculated from milestones)
export const monthlyTargets = pgTable("monthly_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  segment: projectSegmentEnum("segment").notNull(),
  targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
  actualAmount: decimal("actual_amount", { precision: 12, scale: 2 }).default("0"),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueConstraint: index("unique_year_month_segment").on(table.year, table.month, table.segment),
}));

// Invoice collections table for tracking payments
export const invoiceCollections = pgTable("invoice_collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoiceReports.id).notNull(),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  collectionDate: timestamp("collection_date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 100 }),
  reference: varchar("reference", { length: 200 }),
  notes: text("notes"),
  collectedBy: varchar("collected_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invoiceReportsRelations = relations(invoiceReports, ({ one, many }) => ({
  task: one(tasks, {
    fields: [invoiceReports.taskId],
    references: [tasks.id],
  }),
  project: one(projects, {
    fields: [invoiceReports.projectId],
    references: [projects.id],
  }),
  sentBy: one(users, {
    fields: [invoiceReports.sentBy],
    references: [users.id],
    relationName: "sentBy",
  }),
  collections: many(invoiceCollections),
}));

export const monthlyTargetsRelations = relations(monthlyTargets, ({ one }) => ({
  segment: one(projects, {
    fields: [monthlyTargets.segment],
    references: [projects.segment],
  }),
}));

export const invoiceCollectionsRelations = relations(invoiceCollections, ({ one }) => ({
  invoice: one(invoiceReports, {
    fields: [invoiceCollections.invoiceId],
    references: [invoiceReports.id],
  }),
  task: one(tasks, {
    fields: [invoiceCollections.taskId],
    references: [tasks.id],
  }),
  project: one(projects, {
    fields: [invoiceCollections.projectId],
    references: [projects.id],
  }),
  collectedBy: one(users, {
    fields: [invoiceCollections.collectedBy],
    references: [users.id],
    relationName: "collectedBy",
  }),
}));
