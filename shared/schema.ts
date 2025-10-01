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

// Define all enums first
// Project segments for categorization
export const projectSegmentEnum = pgEnum("project_segment", [
  "academic",
  "parastals",
  "private",
]);

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

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "not_started", // Will display as "Not Started" in frontend
  "ongoing",     // Actively being worked on
  "in_progress", // Actively being worked on
  "fc_review",   // Ready for Functional Consultant review
  "qa",          // Added QA status
  "client_review", // Added client review status
  "finished",    // Completed
  "done",        // Legacy - will display as "Finished" in frontend
  "overdue",     // Task is overdue
  "delayed",     // Added delayed status
  "on_hold",     // Added on hold status
  "cancelled",   // Added cancelled status
  "todo",        // Legacy - will display as "Not Started" in frontend
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
  mustChangePassword: boolean("must_change_password").default(false),
  lastPasswordChange: timestamp("last_password_change"),
  // New admin role assignment fields
  isProjectManager: boolean("is_project_manager").default(false),
  isFinanceHead: boolean("is_finance_head").default(false),
  assignedSegment: projectSegmentEnum("assigned_segment"), // For segment leaders
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

// Admin roles assignment table for tracking special admin roles
export const adminRoles = pgTable("admin_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleType: varchar("role_type", { length: 50 }).notNull(), // 'project_manager', 'finance_head', 'segment_leader'
  segment: projectSegmentEnum("segment"), // Only for segment leaders
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").references(() => users.id).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueUserRole: index("unique_user_role").on(table.userId, table.roleType, table.segment),
}));

// New: Managers under a head admin role
export const adminRoleMembers = pgTable("admin_role_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  headRoleId: varchar("head_role_id").references(() => adminRoles.id, { onDelete: 'cascade' }).notNull(),
  managerUserId: varchar("manager_user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueHeadManager: index("unique_head_manager").on(table.headRoleId, table.managerUserId),
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
  description: text("description"), // Database has this as optional
  client: varchar("client", { length: 200 }),
  // New contact fields
  contactPerson: varchar("contact_person"),
  contactPhone: varchar("contact_phone"),
  contactEmail: varchar("contact_email"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: projectStatusEnum("status").notNull().default("planning"), // Use existing projectStatus enum
  segment: projectSegmentEnum("segment").notNull().default("private"), // Added segment field
  budget: decimal("budget", { precision: 12, scale: 2 }), // Keep as budget in DB, will display as Contract Amount in frontend
  teamId: varchar("team_id").references(() => teams.id),
  managerId: varchar("manager_id").references(() => users.id).notNull(),
  progress: integer("progress").notNull().default(0), // percentage 0-100
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Modules table (renamed from tasks, billing fields moved to milestones)
export const modules = pgTable("modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  status: text("status").notNull().default("todo"), // Use text to match existing database
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours").default(0),
  // Weight field for module calculations
  weight: integer("weight").default(2), // Calculated from priority: low=1, medium=2, high=3, critical=4
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  // Phase information since modules belong to phases
  phaseNumber: integer("phase_number"),
  phaseName: varchar("phase_name", { length: 100 }),
  phase: varchar("phase", { length: 100 }), // Added phase column for better tracking
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  assignedTeamId: varchar("assigned_team_id").references(() => teams.id), // Auto-assigned from project team
  milestoneId: varchar("milestone_id").references(() => milestones.id), // Link to milestone for Phase 3 structure
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  completedAt: timestamp("completed_at"),
  progressPercent: integer("progress_percent").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Milestones table for invoicable entities (can contain multiple modules)
export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  // Date fields
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  // Phase attribution (user-controlled)
  phaseNumber: integer("phase_number"),
  phaseName: varchar("phase_name", { length: 100 }),
  // Financials / billing fields moved here from modules
  feeAmount: decimal("fee_amount", { precision: 12, scale: 2 }),
  billingStatus: billingStatusEnum("billing_status").notNull().default("none"),
  // Invoice and collection dates
  expectedInvoiceDate: timestamp("expected_invoice_date"),
  expectedCollectionDate: timestamp("expected_collection_date"),
  // Invoice tracking fields
  invoiceSentAt: timestamp("invoice_sent_at"),
  paymentReceivedAt: timestamp("payment_received_at"),
  overdueFlag: boolean("overdue_flag").default(false),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project Phases table for managing project phases
export const projectPhases = pgTable("project_phases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  phaseNumber: integer("phase_number").notNull(),
  phaseType: varchar("phase_type", { length: 50 }).notNull(), // initiation_contracting, requirements_design, etc.
  phaseName: varchar("phase_name", { length: 100 }).notNull(),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 20 }).notNull().default("not_started"), // not_started, in_progress, completed, on_hold
  progress: integer("progress").notNull().default(0), // percentage 0-100
  deliverables: jsonb("deliverables"), // Array of deliverable items
  completionReport: text("completion_report"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueProjectPhase: index("unique_project_phase").on(table.projectId, table.phaseNumber),
}));

// Contracts table for managing project contracts
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractNumber: varchar("contract_number", { length: 50 }).notNull().unique(),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  clientName: varchar("client_name", { length: 200 }).notNull(),
  clientEmail: varchar("client_email", { length: 200 }).notNull(),
  clientPhone: varchar("client_phone", { length: 50 }),
  clientAddress: text("client_address"),
  contractType: varchar("contract_type", { length: 20 }).notNull(), // fixed_price, time_materials, milestone_based
  totalValue: decimal("total_value", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("KES"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, pending_approval, approved, active, completed, terminated
  signedDate: timestamp("signed_date"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  projectScope: text("project_scope"),
  deliverables: jsonb("deliverables"), // Array of deliverable items
  paymentTerms: text("payment_terms"),
  specialClauses: jsonb("special_clauses"), // Array of special clauses
  responsibilities: jsonb("responsibilities"), // Object with client and contractor responsibilities
  timeline: jsonb("timeline"), // Array of timeline phases
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Module-milestone relationship table (many modules can belong to one milestone)
export const moduleMilestones = pgTable("module_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => modules.id, { onDelete: 'cascade' }).notNull(),
  milestoneId: varchar("milestone_id").references(() => milestones.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Subtasks table for modules (updated to reference modules instead of milestones)
export const subtasks = pgTable("subtasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  status: text("status").notNull().default("not_started"), // Use text to match existing database
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  estimatedHours: integer("estimated_hours"),
  estimatedDays: integer("estimated_days"),
  actualHours: integer("actual_hours").default(0),
  actualDays: integer("actual_days").default(0),
  progressPercent: integer("progress_percent").notNull().default(0),
  moduleId: varchar("module_id").references(() => modules.id, { onDelete: 'cascade' }),
  milestoneId: varchar("milestone_id").references(() => milestones.id, { onDelete: 'cascade' }),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  assignedDevId: varchar("assigned_dev_id").references(() => users.id), // Developer assigned to subtask
  assignedConsultantId: varchar("assigned_consultant_id").references(() => users.id), // Functional consultant assigned to subtask
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subtask dependencies table for simple dependencies
export const subtaskDependencies = pgTable("subtask_dependencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subtaskId: varchar("subtask_id").references(() => subtasks.id, { onDelete: 'cascade' }).notNull(),
  dependsOnSubtaskId: varchar("depends_on_subtask_id").references(() => subtasks.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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

// Module dependencies
export const moduleDependencies = pgTable("module_dependencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => modules.id, { onDelete: 'cascade' }).notNull(),
  dependsOnModuleId: varchar("depends_on_module_id").references(() => modules.id, { onDelete: 'cascade' }).notNull(),
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
  assignedModules: many(modules, { relationName: "assignee" }),
  createdModules: many(modules, { relationName: "creator" }),
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
  modules: many(modules),
  attachments: many(projectAttachments),
  invoices: many(invoiceReports),
  collections: many(invoiceCollections),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  project: one(projects, {
    fields: [modules.projectId],
    references: [projects.id],
  }),
  assignedUser: one(users, {
    fields: [modules.assignedUserId],
    references: [users.id],
    relationName: "assignee",
  }),
  milestone: one(milestones, {
    fields: [modules.milestoneId],
    references: [milestones.id],
  }),
  createdBy: one(users, {
    fields: [modules.createdById],
    references: [users.id],
    relationName: "creator",
  }),
  dependencies: many(moduleDependencies, { relationName: "module" }),
  dependentModules: many(moduleDependencies, { relationName: "dependsOn" }),
  invoices: many(invoiceReports),
  collections: many(invoiceCollections),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
  createdBy: one(users, {
    fields: [milestones.createdById],
    references: [users.id],
    relationName: "creator",
  }),
  modules: many(modules),
}));

export const projectPhasesRelations = relations(projectPhases, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectPhases.projectId],
    references: [projects.id],
  }),
  modules: many(modules, { relationName: "phaseModules" }),
}));

export const moduleMilestonesRelations = relations(moduleMilestones, ({ one }) => ({
  module: one(modules, {
    fields: [moduleMilestones.moduleId],
    references: [modules.id],
  }),
  milestone: one(milestones, {
    fields: [moduleMilestones.milestoneId],
    references: [milestones.id],
  }),
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

export const moduleDependenciesRelations = relations(moduleDependencies, ({ one }) => ({
  module: one(modules, {
    fields: [moduleDependencies.moduleId],
    references: [modules.id],
    relationName: "module",
  }),
  dependsOnModule: one(modules, {
    fields: [moduleDependencies.dependsOnModuleId],
    references: [modules.id],
    relationName: "dependsOn",
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const adminRolesRelations = relations(adminRoles, ({ one }) => ({
  user: one(users, {
    fields: [adminRoles.userId],
    references: [users.id],
  }),
  assignedByUser: one(users, {
    fields: [adminRoles.assignedBy],
    references: [users.id],
  }),
}));

export const adminRoleMembersRelations = relations(adminRoleMembers, ({ one }) => ({
  headRole: one(adminRoles, {
    fields: [adminRoleMembers.headRoleId],
    references: [adminRoles.id],
  }),
  managerUser: one(users, {
    fields: [adminRoleMembers.managerUserId],
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

export const insertAdminRoleSchema = createInsertSchema(adminRoles).omit({
  id: true,
  assignedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Type definitions for admin role management
export type AdminRoleType = 'project_manager' | 'finance_head' | 'segment_leader';

export type AdminRoleAssignment = {
  id: string;
  userId: string;
  roleType: AdminRoleType;
  segment?: 'academic' | 'parastals' | 'private';
  assignedAt: Date;
  assignedBy: string;
  isActive: boolean;
  user?: User;
  assignedByUser?: User;
};

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  progress: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModuleSchema = createInsertSchema(modules).omit({
  id: true,
  actualHours: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMilestoneSchema = createInsertSchema(milestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubtaskSchema = createInsertSchema(subtasks).omit({
  id: true,
  actualHours: true,
  actualDays: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubtaskDependencySchema = createInsertSchema(subtaskDependencies).omit({
  id: true,
  createdAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertProjectAttachmentSchema = createInsertSchema(projectAttachments).omit({
  id: true,
  uploadedAt: true,
});

export const insertModuleDependencySchema = createInsertSchema(moduleDependencies).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  isRead: true,
  createdAt: true,
});

export const insertSystemConfigSchema = z.object({
  key: z.string().min(1, "Key is required").max(100, "Key must be at most 100 characters"),
  value: z.string().min(1, "Value is required"),
  description: z.string().optional(),
});

export const insertModuleMilestoneSchema = z.object({
  moduleId: z.string().uuid("Invalid module ID"),
  milestoneId: z.string().uuid("Invalid milestone ID"),
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

export type Module = typeof modules.$inferSelect;
export type InsertModule = z.infer<typeof insertModuleSchema>;

export type Milestone = typeof milestones.$inferSelect;
export type InsertMilestone = typeof milestones.$inferInsert;

export type ModuleMilestone = typeof moduleMilestones.$inferSelect;
export type InsertModuleMilestone = typeof moduleMilestones.$inferInsert;

export type Subtask = typeof subtasks.$inferSelect;
export type InsertSubtask = z.infer<typeof insertSubtaskSchema>;

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

export type ProjectAttachment = typeof projectAttachments.$inferSelect;
export type InsertProjectAttachment = z.infer<typeof insertProjectAttachmentSchema>;

export type ModuleDependency = typeof moduleDependencies.$inferSelect;
export type InsertModuleDependency = z.infer<typeof insertModuleDependencySchema>;

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

export type AdminRole = typeof adminRoles.$inferSelect;
export type InsertAdminRole = z.infer<typeof insertAdminRoleSchema>;
export type AdminRoleMember = typeof adminRoleMembers.$inferSelect;
export type InsertAdminRoleMember = typeof adminRoleMembers.$inferInsert;

// Invoice reports table for tracking sent invoices
export const invoiceReports = pgTable("invoice_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => modules.id).notNull(),
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

// Comprehensive audit logging tables
export const systemActivityLogs = pgTable("system_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  actionType: varchar("action_type", { length: 50 }).notNull(), // 'create', 'update', 'delete', 'view', 'export', 'login', 'logout', etc.
  resourceType: varchar("resource_type", { length: 50 }).notNull(), // 'project', 'module', 'user', 'team', 'milestone', 'invoice', etc.
  resourceId: varchar("resource_id"), // ID of the affected resource
  resourceName: varchar("resource_name", { length: 255 }), // Human-readable name
  oldValues: jsonb("old_values"), // Previous values for updates
  newValues: jsonb("new_values"), // New values for updates
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
  userAgent: text("user_agent"),
  sessionId: varchar("session_id", { length: 255 }),
  requestId: varchar("request_id", { length: 255 }),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  additionalContext: jsonb("additional_context"), // Additional context data
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_activity_logs_user_id").on(table.userId),
  index("idx_activity_logs_resource_type").on(table.resourceType),
  index("idx_activity_logs_action_type").on(table.actionType),
  index("idx_activity_logs_created_at").on(table.createdAt),
  index("idx_activity_logs_resource_id").on(table.resourceId),
  index("idx_activity_logs_success").on(table.success),
]);

export const apiRequestLogs = pgTable("api_request_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  method: varchar("method", { length: 10 }).notNull(), // GET, POST, PUT, DELETE
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  statusCode: integer("status_code").notNull(),
  responseTimeMs: integer("response_time_ms"),
  requestSizeBytes: integer("request_size_bytes"),
  responseSizeBytes: integer("response_size_bytes"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  queryParams: jsonb("query_params"),
  requestBodySize: integer("request_body_size"),
  sessionId: varchar("session_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_api_logs_user_id").on(table.userId),
  index("idx_api_logs_method").on(table.method),
  index("idx_api_logs_endpoint").on(table.endpoint),
  index("idx_api_logs_status_code").on(table.statusCode),
  index("idx_api_logs_created_at").on(table.createdAt),
]);

export const systemEventsLogs = pgTable("system_events_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type", { length: 100 }).notNull(), // 'automation', 'notification', 'backup', 'maintenance', etc.
  eventCategory: varchar("event_category", { length: 50 }).notNull(), // 'system', 'business', 'security', 'performance'
  description: text("description").notNull(),
  severity: varchar("severity", { length: 20 }).default("info"), // 'debug', 'info', 'warn', 'error', 'critical'
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_system_events_type").on(table.eventType),
  index("idx_system_events_category").on(table.eventCategory),
  index("idx_system_events_severity").on(table.severity),
  index("idx_system_events_created_at").on(table.createdAt),
]);

// Invoice collections table for tracking payments
export const invoiceCollections = pgTable("invoice_collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoiceReports.id).notNull(),
  moduleId: varchar("module_id").references(() => modules.id).notNull(),
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
  module: one(modules, {
    fields: [invoiceReports.moduleId],
    references: [modules.id],
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
  module: one(modules, {
    fields: [invoiceCollections.moduleId],
    references: [modules.id],
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

// Marketing Pipeline System Tables
export const marketingUserRoleEnum = pgEnum("marketing_user_role", ['admin', 'marketer', 'business_development']);
export const salesStageEnum = pgEnum("sales_stage", ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']);
export const quarterEnum = pgEnum("quarter", ['Q1', 'Q2', 'Q3', 'Q4']);
export const systemInPlaceEnum = pgEnum("system_in_place", ['navision', '365_bc', 'none', 'open_source', 'oracle', 'sap']);
export const needAvailabilityEnum = pgEnum("need_availability", ['upgrade', 'under_implementation', 'none']);
export const prospectStageEnum = pgEnum("prospect_stage", ['prospect', 'lead', 'expected_order', 'sales_won', 'lost']);

export const marketingUsers = pgTable("marketing_users", {
  id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
  email: varchar().notNull(),
  password: varchar().notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  phoneNumber: varchar("phone_number"),
  role: marketingUserRoleEnum().default('business_development').notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  target: decimal("target", { precision: 12, scale: 2 }).default('0'),
  lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry", { mode: 'string' }),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("marketing_users_email_unique").on(table.email),
]);

export const marketingSectors = pgTable("marketing_sectors", {
  id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
  name: varchar({ length: 200 }).notNull(),
  description: text(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("marketing_sectors_name_unique").on(table.name),
]);

export const marketingProjects = pgTable("marketing_projects", {
  id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
  sectorId: varchar("sector_id"),
  institution: varchar({ length: 200 }).notNull(),
  leadMarketer: varchar("lead_marketer"),
  contactPerson: varchar("contact_person", { length: 200 }),
  contactNumber: varchar("contact_number", { length: 20 }),
  systemInPlace: systemInPlaceEnum("system_in_place"),
  needAvailability: needAvailabilityEnum("need_availability"),
  currentVendor: varchar("current_vendor", { length: 200 }),
  remarks: text(),
  status: varchar({ length: 20 }).default('active').notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const marketingProspects = pgTable("marketing_prospects", {
  id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
  date: timestamp({ mode: 'string' }).notNull(),
  client: varchar({ length: 200 }).notNull(),
  contactPerson: varchar("contact_person", { length: 200 }).notNull(),
  contactNumber: varchar("contact_number", { length: 20 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }).notNull(),
  systemInPlace: systemInPlaceEnum("system_in_place").notNull(),
  needAvailability: needAvailabilityEnum("need_availability").notNull(),
  currentVendor: varchar("current_vendor", { length: 200 }),
  remarks: text(),
  revenue: decimal({ precision: 12, scale: 2 }),
  stage: prospectStageEnum().default('prospect').notNull(),
  bdId: varchar("bd_id").notNull(),
  sectorId: varchar("sector_id"),
  sharedWithBdId: varchar("shared_with_bd_id"),
  revenueSplit: decimal("revenue_split", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const marketingSalesWon = pgTable("marketing_sales_won", {
  id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
  organisationName: varchar("organisation_name", { length: 200 }).notNull(),
  sector: varchar({ length: 100 }).notNull(),
  product: varchar({ length: 200 }).notNull(),
  contractAmount: decimal("contract_amount", { precision: 12, scale: 2 }).notNull(),
  expectedQuarter: quarterEnum("expected_quarter").notNull(),
  comments: text(),
  marketerId: varchar("marketer_id").notNull(),
  contactPerson: varchar("contact_person", { length: 200 }),
  contactNumber: varchar("contact_number", { length: 20 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const marketingExpectedOrders = pgTable("marketing_expected_orders", {
  id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
  organisationName: varchar("organisation_name", { length: 200 }).notNull(),
  sector: varchar({ length: 100 }).notNull(),
  product: varchar({ length: 200 }).notNull(),
  revenue: decimal({ precision: 12, scale: 2 }).notNull(),
  expectedQuarter: quarterEnum("expected_quarter").notNull(),
  comments: text(),
  marketerId: varchar("marketer_id").notNull(),
  contactPerson: varchar("contact_person", { length: 200 }),
  contactNumber: varchar("contact_number", { length: 20 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});


export const marketingAnnualSummary = pgTable("marketing_annual_summary", {
  id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
  year: integer().notNull(),
  salesExecutive: varchar("sales_executive", { length: 200 }).notNull(),
  won: decimal({ precision: 12, scale: 2 }).default('0').notNull(),
  target: decimal({ precision: 12, scale: 2 }).notNull(),
  revisedTarget: decimal("revised_target", { precision: 12, scale: 2 }).default('0').notNull(),
  targetAchieved: decimal("target_achieved", { precision: 5, scale: 2 }).default('0').notNull(),
  expectedOrders: decimal("expected_orders", { precision: 12, scale: 2 }).default('0').notNull(),
  statusQuo: decimal("status_quo", { precision: 12, scale: 2 }).default('0').notNull(),
  deviationFromTarget: decimal("deviation_from_target", { precision: 12, scale: 2 }).default('0').notNull(),
  sumSalesExpected: decimal("sum_sales_expected", { precision: 12, scale: 2 }).default('0').notNull(),
  expectedTarget: decimal("expected_target", { precision: 12, scale: 2 }).default('0').notNull(),
  marketerId: varchar("marketer_id").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("unique_year_marketer").on(table.year, table.marketerId),
]);

export const marketingLostProjects = pgTable("marketing_lost_projects", {
  id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
  organisationName: varchar("organisation_name", { length: 255 }).notNull(),
  sector: varchar({ length: 100 }).default('Unknown').notNull(),
  product: varchar({ length: 100 }).default('Service').notNull(),
  revenue: decimal({ precision: 12, scale: 2 }),
  expectedQuarter: varchar("expected_quarter", { length: 10 }).default('Q1').notNull(),
  comments: text(),
  marketerId: varchar("marketer_id").notNull(),
  contactPerson: varchar("contact_person", { length: 200 }),
  contactNumber: varchar("contact_number", { length: 20 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  lostReason: text("lost_reason").notNull(),
  lostDate: timestamp("lost_date", { mode: 'string' }).defaultNow().notNull(),
  canRevive: boolean("can_revive").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("marketing_lost_projects_marketer_id_idx").on(table.marketerId),
  index("marketing_lost_projects_lost_date_idx").on(table.lostDate),
]);

// Marketing Relations
export const marketingSectorsRelations = relations(marketingSectors, ({ many }) => ({
  projects: many(marketingProjects),
  prospects: many(marketingProspects),
}));

export const marketingProjectsRelations = relations(marketingProjects, ({ one }) => ({
  sector: one(marketingSectors, {
    fields: [marketingProjects.sectorId],
    references: [marketingSectors.id],
  }),
  leadMarketer: one(marketingUsers, {
    fields: [marketingProjects.leadMarketer],
    references: [marketingUsers.id],
  }),
}));

export const marketingProspectsRelations = relations(marketingProspects, ({ one }) => ({
  bd: one(marketingUsers, {
    fields: [marketingProspects.bdId],
    references: [marketingUsers.id],
  }),
  sharedWithBd: one(marketingUsers, {
    fields: [marketingProspects.sharedWithBdId],
    references: [marketingUsers.id],
  }),
  sector: one(marketingSectors, {
    fields: [marketingProspects.sectorId],
    references: [marketingSectors.id],
  }),
}));

export const marketingSalesWonRelations = relations(marketingSalesWon, ({ one }) => ({
  marketer: one(marketingUsers, {
    fields: [marketingSalesWon.marketerId],
    references: [marketingUsers.id],
  }),
}));

export const marketingExpectedOrdersRelations = relations(marketingExpectedOrders, ({ one }) => ({
  marketer: one(marketingUsers, {
    fields: [marketingExpectedOrders.marketerId],
    references: [marketingUsers.id],
  }),
}));

export const marketingAnnualSummaryRelations = relations(marketingAnnualSummary, ({ one }) => ({
  marketer: one(marketingUsers, {
    fields: [marketingAnnualSummary.marketerId],
    references: [marketingUsers.id],
  }),
}));

export const marketingUsersRelations = relations(marketingUsers, ({ many }) => ({
  salesWon: many(marketingSalesWon),
  expectedOrders: many(marketingExpectedOrders),
  prospects: many(marketingProspects),
  annualSummary: many(marketingAnnualSummary),
}));

// Marketing Insert Schemas
export const insertMarketingUserSchema = createInsertSchema(marketingUsers);
export const insertMarketingSalesWonSchema = createInsertSchema(marketingSalesWon);
export const insertMarketingExpectedOrdersSchema = createInsertSchema(marketingExpectedOrders);
export const insertMarketingProspectsSchema = createInsertSchema(marketingProspects);
export const insertMarketingAnnualSummarySchema = createInsertSchema(marketingAnnualSummary);

// Audit Logging Types
export type SystemActivityLog = typeof systemActivityLogs.$inferSelect;
export type InsertSystemActivityLog = typeof systemActivityLogs.$inferInsert;

export type ApiRequestLog = typeof apiRequestLogs.$inferSelect;
export type InsertApiRequestLog = typeof apiRequestLogs.$inferInsert;

export type SystemEventLog = typeof systemEventsLogs.$inferSelect;
export type InsertSystemEventLog = typeof systemEventsLogs.$inferInsert;