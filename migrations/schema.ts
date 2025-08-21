import { pgTable, varchar, text, timestamp, index, foreignKey, numeric, integer, jsonb, boolean, unique, check, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const billingStatus = pgEnum("billing_status", ['none', 'to_send', 'sent', 'paid', 'overdue', 'processing'])
export const projectSegment = pgEnum("project_segment", ['academic', 'parastals', 'private'])
export const projectStatus = pgEnum("project_status", ['planning', 'active', 'on_hold', 'completed', 'cancelled', 'terminated', 'on_support'])
export const taskPriority = pgEnum("task_priority", ['low', 'medium', 'high', 'critical'])
export const taskStatus = pgEnum("task_status", ['todo', 'in_progress', 'review', 'done', 'qa', 'client_review', 'delayed', 'on_hold', 'cancelled'])


export const teams = pgTable("teams", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	segment: projectSegment().default('private').notNull(),
});

export const projects = pgTable("projects", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	description: text().notNull(),
	client: varchar({ length: 200 }),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }).notNull(),
	status: projectStatus().default('planning').notNull(),
	budget: numeric({ precision: 12, scale:  2 }),
	teamId: varchar("team_id"),
	managerId: varchar("manager_id").notNull(),
	progress: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	segment: varchar({ length: 20 }).default('private').notNull(),
	contactPerson: varchar("contact_person", { length: 255 }),
	contactPhone: varchar("contact_phone", { length: 50 }),
	contactEmail: varchar("contact_email", { length: 255 }),
}, (table) => [
	index("idx_projects_contact_email").using("btree", table.contactEmail.asc().nullsLast().op("text_ops")),
	index("idx_projects_segment").using("btree", table.segment.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "projects_team_id_teams_id_fk"
		}),
	foreignKey({
			columns: [table.managerId],
			foreignColumns: [users.id],
			name: "projects_manager_id_users_id_fk"
		}),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const teamMembers = pgTable("team_members", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	teamId: varchar("team_id").notNull(),
	userId: varchar("user_id").notNull(),
	role: varchar({ length: 50 }).default('member'),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_members_team_id_teams_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "team_members_user_id_users_id_fk"
		}),
]);

export const tasks = pgTable("tasks", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	priority: taskPriority().default('medium').notNull(),
	status: taskStatus().default('todo').notNull(),
	startDate: timestamp("start_date", { mode: 'string' }),
	dueDate: timestamp("due_date", { mode: 'string' }),
	estimatedHours: integer("estimated_hours"),
	actualHours: integer("actual_hours").default(0),
	projectId: varchar("project_id").notNull(),
	assignedUserId: varchar("assigned_user_id"),
	createdById: varchar("created_by_id").notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	feeAmount: numeric("fee_amount", { precision: 12, scale:  2 }),
	billingStatus: billingStatus("billing_status").default('none').notNull(),
	assignedTeamId: varchar("assigned_team_id"),
	progressPercent: integer("progress_percent").default(0).notNull(),
	expectedInvoiceDate: timestamp("expected_invoice_date", { mode: 'string' }),
	expectedCollectionDate: timestamp("expected_collection_date", { mode: 'string' }),
	invoicesentat: timestamp({ mode: 'string' }),
	paymentreceivedat: timestamp({ mode: 'string' }),
	overdueflag: boolean().default(false),
	invoiceSentAt: timestamp("invoice_sent_at", { mode: 'string' }),
	paymentReceivedAt: timestamp("payment_received_at", { mode: 'string' }),
	overdueFlag: boolean("overdue_flag").default(false),
	weight: integer().default(2),
}, (table) => [
	index("idx_tasks_invoice_dates").using("btree", table.expectedInvoiceDate.asc().nullsLast().op("timestamp_ops"), table.expectedCollectionDate.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "tasks_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.assignedUserId],
			foreignColumns: [users.id],
			name: "tasks_assigned_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "tasks_created_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedTeamId],
			foreignColumns: [teams.id],
			name: "tasks_assigned_team_id_teams_id_fk"
		}),
]);

export const taskDependencies = pgTable("task_dependencies", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	taskId: varchar("task_id").notNull(),
	dependsOnTaskId: varchar("depends_on_task_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [tasks.id],
			name: "task_dependencies_task_id_tasks_id_fk"
		}),
	foreignKey({
			columns: [table.dependsOnTaskId],
			foreignColumns: [tasks.id],
			name: "task_dependencies_depends_on_task_id_tasks_id_fk"
		}),
]);

export const projectAttachments = pgTable("project_attachments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectId: varchar("project_id").notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	filePath: varchar("file_path", { length: 500 }).notNull(),
	fileSize: integer("file_size"),
	mimeType: varchar("mime_type", { length: 100 }),
	uploadedById: varchar("uploaded_by_id").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_attachments_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.uploadedById],
			foreignColumns: [users.id],
			name: "project_attachments_uploaded_by_id_users_id_fk"
		}),
]);

export const notifications = pgTable("notifications", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	title: varchar({ length: 200 }).notNull(),
	message: text().notNull(),
	type: varchar({ length: 50 }).notNull(),
	relatedId: varchar("related_id"),
	isRead: boolean("is_read").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_users_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	email: varchar().notNull(),
	password: varchar().notNull(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	role: varchar({ length: 20 }).default('employee').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	resetToken: text("reset_token"),
	resetTokenExpiry: timestamp("reset_token_expiry", { mode: 'string' }),
	temporaryPassword: varchar("temporary_password", { length: 255 }),
	passwordGeneratedAt: timestamp("password_generated_at", { mode: 'string' }),
	middleName: varchar("middle_name"),
	phoneNumber: varchar("phone_number"),
	idNumber: varchar("id_number"),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const userNotificationPreferences = pgTable("user_notification_preferences", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
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
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_notification_preferences_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const userCalendarSettings = pgTable("user_calendar_settings", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	isConnected: boolean("is_connected").default(false),
	syncEnabled: boolean("sync_enabled").default(false),
	reminderTime: varchar("reminder_time", { length: 5 }).default('09:00'),
	syncFrequency: varchar("sync_frequency", { length: 20 }).default('daily'),
	googleAccessToken: text("google_access_token"),
	googleRefreshToken: text("google_refresh_token"),
	googleTokenExpiry: timestamp("google_token_expiry", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	calendarName: varchar("calendar_name", { length: 255 }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_calendar_settings_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const invoiceReports = pgTable("invoice_reports", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	taskId: varchar("task_id").notNull(),
	projectId: varchar("project_id").notNull(),
	invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
	invoiceDate: timestamp("invoice_date", { mode: 'string' }).notNull(),
	expectedCollectionDate: timestamp("expected_collection_date", { mode: 'string' }).notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	status: varchar({ length: 50 }).default('sent').notNull(),
	sentBy: varchar("sent_by").notNull(),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow(),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_invoice_reports_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [tasks.id],
			name: "invoice_reports_task_id_fkey"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "invoice_reports_project_id_fkey"
		}),
	foreignKey({
			columns: [table.sentBy],
			foreignColumns: [users.id],
			name: "invoice_reports_sent_by_fkey"
		}),
	unique("invoice_reports_invoice_number_key").on(table.invoiceNumber),
]);

export const monthlyTargets = pgTable("monthly_targets", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	month: integer().notNull(),
	segment: varchar({ length: 20 }).notNull(),
	targetAmount: numeric("target_amount", { precision: 12, scale:  2 }).notNull(),
	actualAmount: numeric("actual_amount", { precision: 12, scale:  2 }).default('0'),
	calculatedAt: timestamp("calculated_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_monthly_targets_year_month").using("btree", table.year.asc().nullsLast().op("int4_ops"), table.month.asc().nullsLast().op("int4_ops")),
	unique("monthly_targets_year_month_segment_key").on(table.year, table.month, table.segment),
	check("monthly_targets_month_check", sql`(month >= 1) AND (month <= 12)`),
]);

export const invoiceCollections = pgTable("invoice_collections", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	invoiceId: varchar("invoice_id").notNull(),
	taskId: varchar("task_id").notNull(),
	projectId: varchar("project_id").notNull(),
	collectionDate: timestamp("collection_date", { mode: 'string' }).notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	paymentMethod: varchar("payment_method", { length: 100 }),
	reference: varchar({ length: 200 }),
	notes: text(),
	collectedBy: varchar("collected_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_invoice_collections_date").using("btree", table.collectionDate.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoiceReports.id],
			name: "invoice_collections_invoice_id_fkey"
		}),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [tasks.id],
			name: "invoice_collections_task_id_fkey"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "invoice_collections_project_id_fkey"
		}),
	foreignKey({
			columns: [table.collectedBy],
			foreignColumns: [users.id],
			name: "invoice_collections_collected_by_fkey"
		}),
]);

export const segmentLeaders = pgTable("segment_leaders", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	segment: varchar({ length: 20 }).notNull(),
	leaderEmail: varchar("leader_email", { length: 255 }).notNull(),
	leaderName: varchar("leader_name", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_segment_leaders_segment").using("btree", table.segment.asc().nullsLast().op("text_ops")),
	unique("segment_leaders_segment_key").on(table.segment),
	check("segment_leaders_segment_check", sql`(segment)::text = ANY ((ARRAY['academic'::character varying, 'parastals'::character varying, 'private'::character varying])::text[])`),
]);

export const teamMemberRoles = pgTable("team_member_roles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	teamMemberId: varchar("team_member_id").notNull(),
	roleId: varchar("role_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_team_member_roles_role").using("btree", table.roleId.asc().nullsLast().op("text_ops")),
	index("idx_team_member_roles_team_member").using("btree", table.teamMemberId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.teamMemberId],
			foreignColumns: [teamMembers.id],
			name: "team_member_roles_team_member_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [employeeRoles.id],
			name: "team_member_roles_role_id_fkey"
		}).onDelete("cascade"),
	unique("team_member_roles_team_member_id_role_id_key").on(table.teamMemberId, table.roleId),
]);

export const employeeRoles = pgTable("employee_roles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	roleName: varchar("role_name", { length: 100 }).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("employee_roles_role_name_key").on(table.roleName),
]);

export const externalNotificationRecipients = pgTable("external_notification_recipients", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	type: varchar({ length: 50 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_external_notification_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_external_notification_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	unique("external_notification_recipients_type_email_key").on(table.type, table.email),
	check("external_notification_recipients_type_check", sql`(type)::text = ANY ((ARRAY['finance'::character varying, 'account_manager'::character varying])::text[])`),
]);
