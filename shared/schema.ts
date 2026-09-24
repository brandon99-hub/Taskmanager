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
  "support_closed", // Support period deliberately closed out (distinct from the date just lapsing)
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

// Support ticket lifecycle for projects that have entered their SLA/support period
export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

// Top-level classification for every support contact. Complaint/Enquiry go through the
// full ticket workflow (category, assignment, status lifecycle); Compliment/Suggestion
// are logged in the same table but skip those workflow fields.
export const ticketTypeEnum = pgEnum("ticket_type", [
  "complaint",
  "enquiry",
  "compliment",
  "suggestion",
]);

// Service categories only make sense as a breakdown of Complaint or Enquiry tickets.
export const serviceCategoryTypeEnum = pgEnum("service_category_type", [
  "complaint",
  "enquiry",
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
  roleId: varchar("role_id").references(() => roles.id), // Dynamic, admin-managed role (replaces the hardcoded `role` string over time)
  isActive: boolean("is_active").notNull().default(true), // Added for account management
  lastLoginAt: timestamp("last_login_at"),
  resetToken: text("reset_token"), // Added for password reset
  resetTokenExpiry: timestamp("reset_token_expiry"), // Added for password reset
  // New credential fields
  temporaryPassword: varchar("temporary_password"),
  passwordGeneratedAt: timestamp("password_generated_at"),
  mustChangePassword: boolean("must_change_password").default(false),
  lastPasswordChange: timestamp("last_password_change"),
  assignedSegment: projectSegmentEnum("assigned_segment"), // For segment leaders
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Segment leaders table
export const segmentLeaders = pgTable("segment_leaders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  segmentId: varchar("segment_id").references(() => segments.id).notNull(),
  leaderId: varchar("leader_id").references(() => users.id),
  leaderEmail: varchar("leader_email").notNull(),
  leaderName: varchar("leader_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueSegment: index("unique_segment").on(table.segmentId),
}));

// Admin roles assignment table for tracking special admin roles
export const adminRoles = pgTable("admin_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleType: varchar("role_type", { length: 50 }).notNull(), // 'segment_leader'
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

// Dynamic RBAC: roles and permissions are admin-managed data instead of hardcoded strings
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  isSystem: boolean("is_system").default(false), // protects seeded roles (e.g. Administrator) from deletion
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(), // e.g. "projects.create", "tickets.view_all"
  label: varchar("label", { length: 200 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(), // e.g. "Projects", "Tickets", "Users", "Admin"
  createdAt: timestamp("created_at").defaultNow(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: varchar("permission_id").references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueRolePermission: index("unique_role_permission").on(table.roleId, table.permissionId),
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
  segment: projectSegmentEnum("segment").notNull().default("private"), // Legacy enum, superseded by sectorId below - kept for backfill/rollback only
  sectorId: varchar("sector_id").references(() => segments.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Companies table: normalizes the client/company a project and its tickets belong to
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  primaryContactName: varchar("primary_contact_name", { length: 200 }),
  primaryContactEmail: varchar("primary_contact_email", { length: 255 }),
  primaryContactPhone: varchar("primary_contact_phone", { length: 50 }),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIdx: index("idx_companies_name").on(table.name),
}));

// Segments table: admin-managed replacement for the hardcoded academic/parastals/private
// project_segment enum. `projects.segmentId` and `segmentLeaders.segmentId` reference this
// table. The old projectSegmentEnum is kept (unused by these two tables going forward) since
// several other tables (teams, monthlyTargets, adminRoles, users.assignedSegment) still use it
// and converting those is out of scope for this pass.
export const segments = pgTable("segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIdx: index("idx_segments_name").on(table.name),
}));

// Projects table (keeping existing structure, adding new contact fields)
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(), // Keep existing name field
  description: text("description"), // Database has this as optional
  client: varchar("client", { length: 200 }), // Legacy free-text client name; superseded by companyId
  companyId: varchar("company_id").references(() => companies.id),
  // New contact fields
  contactPerson: varchar("contact_person"),
  contactPhone: varchar("contact_phone"),
  contactEmail: varchar("contact_email"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: projectStatusEnum("status").notNull().default("planning"), // Use existing projectStatus enum
  segmentId: varchar("segment_id").references(() => segments.id), // Admin-managed segment (replaces the old segment enum)
  budget: decimal("budget", { precision: 12, scale: 2 }), // Keep as budget in DB, will display as Contract Amount in frontend
  teamId: varchar("team_id").references(() => teams.id),
  managerId: varchar("manager_id").references(() => users.id).notNull(),
  progress: integer("progress").notNull().default(0), // percentage 0-100
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Billing items: flat, per-project invoicing line items. Replaces the old
// phase -> milestone -> module -> subtask delivery hierarchy, which has been
// removed entirely (see [[project-taskflow-rbac-tickets-rebuild]] memory) -
// this table exists solely to keep invoicing/billing (feeAmount, billingStatus,
// invoice/collection dates, invoiceReports/invoiceCollections) working.
export const billingItems = pgTable("billing_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  feeAmount: decimal("fee_amount", { precision: 12, scale: 2 }),
  billingStatus: billingStatusEnum("billing_status").notNull().default("none"),
  expectedInvoiceDate: timestamp("expected_invoice_date"),
  expectedCollectionDate: timestamp("expected_collection_date"),
  invoiceSentAt: timestamp("invoice_sent_at"),
  paymentReceivedAt: timestamp("payment_received_at"),
  overdueFlag: boolean("overdue_flag").default(false),
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

// Service categories for classifying support tickets (Enquiry, Suggestion, Complaint, Compliment, ...)
export const serviceCategories = pgTable("service_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 20 }),
  type: serviceCategoryTypeEnum("type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Support tickets raised for a project once it has entered its SLA/support period
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: varchar("ticket_number", { length: 50 }).notNull().unique(),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  type: ticketTypeEnum("type").notNull(),
  // Required for complaint/enquiry tickets, null for compliment/suggestion (validated at the route layer).
  categoryId: varchar("category_id").references(() => serviceCategories.id),
  subject: varchar("subject", { length: 200 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").notNull().default("open"),
  priority: ticketPriorityEnum("priority").notNull().default("medium"),
  contactName: varchar("contact_name", { length: 200 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  createdByUserId: varchar("created_by_user_id").references(() => users.id).notNull(),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  assignedTeamId: varchar("assigned_team_id").references(() => teams.id),
  escalatedFromUserId: varchar("escalated_from_user_id").references(() => users.id),
  escalationReason: text("escalation_reason"),
  escalatedAt: timestamp("escalated_at"),
  rootCause: text("root_cause"),
  resolutionNotes: text("resolution_notes"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  projectIdx: index("idx_tickets_project_id").on(table.projectId),
  companyIdx: index("idx_tickets_company_id").on(table.companyId),
  assignedToIdx: index("idx_tickets_assigned_to").on(table.assignedToUserId),
  createdByIdx: index("idx_tickets_created_by").on(table.createdByUserId),
  statusIdx: index("idx_tickets_status").on(table.status),
}));

// Comment / audit thread on a ticket (status changes, assignment notes, internal comments)
export const ticketComments = pgTable("ticket_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  ticketIdx: index("idx_ticket_comments_ticket_id").on(table.ticketId),
}));

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
export const usersRelations = relations(users, ({ one, many }) => ({
  managedProjects: many(projects, { relationName: "manager" }),
  teamMemberships: many(teamMembers),
  notifications: many(notifications),
  uploadedAttachments: many(projectAttachments),
  sentInvoices: many(invoiceReports, { relationName: "sentBy" }),
  collectedInvoices: many(invoiceCollections, { relationName: "collectedBy" }),
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  createdTickets: many(tickets, { relationName: "ticketCreator" }),
  assignedTickets: many(tickets, { relationName: "ticketAssignee" }),
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
  company: one(companies, {
    fields: [projects.companyId],
    references: [companies.id],
  }),
  segment: one(segments, {
    fields: [projects.segmentId],
    references: [segments.id],
  }),
  billingItems: many(billingItems),
  attachments: many(projectAttachments),
  invoices: many(invoiceReports),
  collections: many(invoiceCollections),
  tickets: many(tickets),
}));

export const billingItemsRelations = relations(billingItems, ({ one, many }) => ({
  project: one(projects, {
    fields: [billingItems.projectId],
    references: [projects.id],
  }),
  createdBy: one(users, {
    fields: [billingItems.createdById],
    references: [users.id],
  }),
  invoices: many(invoiceReports),
  collections: many(invoiceCollections),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  projects: many(projects),
  tickets: many(tickets),
}));

export const segmentsRelations = relations(segments, ({ many }) => ({
  projects: many(projects),
  segmentLeaders: many(segmentLeaders),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  project: one(projects, {
    fields: [tickets.projectId],
    references: [projects.id],
  }),
  company: one(companies, {
    fields: [tickets.companyId],
    references: [companies.id],
  }),
  category: one(serviceCategories, {
    fields: [tickets.categoryId],
    references: [serviceCategories.id],
  }),
  createdBy: one(users, {
    fields: [tickets.createdByUserId],
    references: [users.id],
    relationName: "ticketCreator",
  }),
  assignedTo: one(users, {
    fields: [tickets.assignedToUserId],
    references: [users.id],
    relationName: "ticketAssignee",
  }),
  assignedTeam: one(teams, {
    fields: [tickets.assignedTeamId],
    references: [teams.id],
  }),
  comments: many(ticketComments),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketComments.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketComments.userId],
    references: [users.id],
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

export const segmentLeadersRelations = relations(segmentLeaders, ({ one }) => ({
  segment: one(segments, {
    fields: [segmentLeaders.segmentId],
    references: [segments.id],
  }),
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
export type AdminRoleType = 'segment_leader';

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

export const insertBillingItemSchema = createInsertSchema(billingItems).omit({
  id: true,
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

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSegmentSchema = createInsertSchema(segments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export const insertServiceCategorySchema = createInsertSchema(serviceCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  ticketNumber: true,
  status: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTicketCommentSchema = createInsertSchema(ticketComments).omit({
  id: true,
  createdAt: true,
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

export type BillingItem = typeof billingItems.$inferSelect;
export type InsertBillingItem = z.infer<typeof insertBillingItemSchema>;

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

export type ProjectAttachment = typeof projectAttachments.$inferSelect;
export type InsertProjectAttachment = z.infer<typeof insertProjectAttachmentSchema>;

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

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type Segment = typeof segments.$inferSelect;
export type InsertSegment = z.infer<typeof insertSegmentSchema>;

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type InsertServiceCategory = z.infer<typeof insertServiceCategorySchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type TicketComment = typeof ticketComments.$inferSelect;
export type InsertTicketComment = z.infer<typeof insertTicketCommentSchema>;

// Invoice reports table for tracking sent invoices
export const invoiceReports = pgTable("invoice_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billingItemId: varchar("billing_item_id").references(() => billingItems.id).notNull(),
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
  billingItemId: varchar("billing_item_id").references(() => billingItems.id).notNull(),
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
  billingItem: one(billingItems, {
    fields: [invoiceReports.billingItemId],
    references: [billingItems.id],
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

// Note: monthlyTargets.segment stays on the legacy projectSegmentEnum (unconverted in this
// pass), so it can no longer form a relation against projects (whose segment is now the
// dynamic segmentId FK) - this relation was unused anyway, so it's dropped rather than
// reworked into a non-FK-based join.

export const invoiceCollectionsRelations = relations(invoiceCollections, ({ one }) => ({
  invoice: one(invoiceReports, {
    fields: [invoiceCollections.invoiceId],
    references: [invoiceReports.id],
  }),
  billingItem: one(billingItems, {
    fields: [invoiceCollections.billingItemId],
    references: [billingItems.id],
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