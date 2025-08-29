import { pgTable, foreignKey, varchar, text, timestamp, integer, index, boolean, numeric, unique, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const billingStatus = pgEnum("billing_status", ['none', 'to_send', 'sent', 'paid', 'overdue', 'processing'])
export const projectSegment = pgEnum("project_segment", ['academic', 'parastals', 'private'])
export const projectStatus = pgEnum("project_status", ['planning', 'active', 'on_hold', 'completed', 'cancelled', 'terminated', 'on_support'])
export const taskPriority = pgEnum("task_priority", ['low', 'medium', 'high', 'critical'])
export const taskStatus = pgEnum("task_status", ['not_started', 'started', 'ongoing', 'in_progress', 'fc_review', 'qa', 'client_review', 'finished', 'done', 'overdue', 'delayed', 'on_hold', 'cancelled', 'todo'])


export const modules = pgTable("modules", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	priority: taskPriority().default('medium').notNull(),
	status: text().default('todo').notNull(),
	startDate: timestamp("start_date", { mode: 'string' }),
	dueDate: timestamp("due_date", { mode: 'string' }),
	estimatedHours: integer("estimated_hours"),
	actualHours: integer("actual_hours").default(0),
	weight: integer().default(2),
	projectId: varchar("project_id").notNull(),
	phaseNumber: integer("phase_number"),
	phaseName: varchar("phase_name", { length: 100 }),
	phase: varchar("phase", { length: 100 }), // Added phase column for better tracking
	assignedUserId: varchar("assigned_user_id"),
	assignedTeamId: varchar("assigned_team_id"), // Auto-assigned from project team
	createdById: varchar("created_by_id").notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	progressPercent: integer("progress_percent").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "modules_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.assignedUserId],
			foreignColumns: [users.id],
			name: "modules_assigned_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedTeamId],
			foreignColumns: [teams.id],
			name: "modules_assigned_team_id_teams_id_fk"
		}),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "modules_created_by_id_users_id_fk"
		}),
]);

export const externalNotificationRecipients = pgTable("external_notification_recipients", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	type: varchar({ length: 50 }).notNull(),
	email: varchar().notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("unique_type_email").using("btree", table.type.asc().nullsLast().op("text_ops"), table.email.asc().nullsLast().op("text_ops")),
]);

export const milestones = pgTable("milestones", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	feeAmount: numeric("fee_amount", { precision: 12, scale:  2 }),
	billingStatus: billingStatus("billing_status").default('none').notNull(),
	expectedInvoiceDate: timestamp("expected_invoice_date", { mode: 'string' }),
	expectedCollectionDate: timestamp("expected_collection_date", { mode: 'string' }),
	invoiceSentAt: timestamp("invoice_sent_at", { mode: 'string' }),
	paymentReceivedAt: timestamp("payment_received_at", { mode: 'string' }),
	overdueFlag: boolean("overdue_flag").default(false),
	projectId: varchar("project_id").notNull(),
	createdById: varchar("created_by_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "milestones_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "milestones_created_by_id_users_id_fk"
		}),
]);

export const moduleDependencies = pgTable("module_dependencies", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	moduleId: varchar("module_id").notNull(),
	dependsOnModuleId: varchar("depends_on_module_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [modules.id],
			name: "module_dependencies_module_id_modules_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.dependsOnModuleId],
			foreignColumns: [modules.id],
			name: "module_dependencies_depends_on_module_id_modules_id_fk"
		}).onDelete("cascade"),
]);

export const moduleMilestones = pgTable("module_milestones", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	moduleId: varchar("module_id").notNull(),
	milestoneId: varchar("milestone_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [modules.id],
			name: "module_milestones_module_id_modules_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.milestoneId],
			foreignColumns: [milestones.id],
			name: "module_milestones_milestone_id_milestones_id_fk"
		}).onDelete("cascade"),
]);

export const notifications = pgTable("notifications", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
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

export const employeeRoles = pgTable("employee_roles", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	roleName: varchar("role_name").notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("employee_roles_role_name_unique").on(table.roleName),
]);

export const monthlyTargets = pgTable("monthly_targets", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	year: integer().notNull(),
	month: integer().notNull(),
	segment: projectSegment().notNull(),
	targetAmount: numeric("target_amount", { precision: 12, scale:  2 }).notNull(),
	actualAmount: numeric("actual_amount", { precision: 12, scale:  2 }).default('0'),
	calculatedAt: timestamp("calculated_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("unique_year_month_segment").using("btree", table.year.asc().nullsLast().op("int4_ops"), table.month.asc().nullsLast().op("int4_ops"), table.segment.asc().nullsLast().op("int4_ops")),
]);

export const invoiceReports = pgTable("invoice_reports", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	moduleId: varchar("module_id").notNull(),
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
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [modules.id],
			name: "invoice_reports_module_id_modules_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "invoice_reports_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.sentBy],
			foreignColumns: [users.id],
			name: "invoice_reports_sent_by_users_id_fk"
		}),
	unique("invoice_reports_invoice_number_unique").on(table.invoiceNumber),
]);

export const projectPhases = pgTable("project_phases", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	projectId: varchar("project_id").notNull(),
	phaseNumber: integer("phase_number").notNull(),
	phaseType: varchar("phase_type", { length: 50 }).notNull(),
	phaseName: varchar("phase_name", { length: 100 }).notNull(),
	description: text(),
	startDate: timestamp("start_date", { mode: 'string' }),
	endDate: timestamp("end_date", { mode: 'string' }),
	status: varchar({ length: 20 }).default('not_started').notNull(),
	progress: integer().default(0).notNull(),
	deliverables: jsonb(),
	completionReport: text("completion_report"),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("unique_project_phase").using("btree", table.projectId.asc().nullsLast().op("int4_ops"), table.phaseNumber.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_phases_project_id_projects_id_fk"
		}).onDelete("cascade"),
]);

export const projectAttachments = pgTable("project_attachments", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
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

export const segmentLeaders = pgTable("segment_leaders", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	segment: projectSegment().notNull(),
	leaderEmail: varchar("leader_email").notNull(),
	leaderName: varchar("leader_name").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("unique_segment").using("btree", table.segment.asc().nullsLast().op("enum_ops")),
]);

export const projects = pgTable("projects", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	client: varchar({ length: 200 }),
	contactPerson: varchar("contact_person"),
	contactPhone: varchar("contact_phone"),
	contactEmail: varchar("contact_email"),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }).notNull(),
	status: projectStatus().default('planning').notNull(),
	segment: projectSegment().default('private').notNull(),
	budget: numeric({ precision: 12, scale:  2 }),
	teamId: varchar("team_id"),
	managerId: varchar("manager_id").notNull(),
	progress: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
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
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
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

export const teamMemberRoles = pgTable("team_member_roles", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	teamMemberId: varchar("team_member_id").notNull(),
	roleId: varchar("role_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("unique_team_member_role").using("btree", table.teamMemberId.asc().nullsLast().op("text_ops"), table.roleId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.teamMemberId],
			foreignColumns: [teamMembers.id],
			name: "team_member_roles_team_member_id_team_members_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [employeeRoles.id],
			name: "team_member_roles_role_id_employee_roles_id_fk"
		}).onDelete("cascade"),
]);

export const systemConfig = pgTable("system_config", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	key: varchar({ length: 100 }).notNull(),
	value: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("unique_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
	unique("system_config_key_unique").on(table.key),
]);

export const userCalendarSettings = pgTable("user_calendar_settings", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	isConnected: boolean("is_connected").default(false),
	syncEnabled: boolean("sync_enabled").default(false),
	calendarName: varchar("calendar_name", { length: 255 }),
	reminderTime: varchar("reminder_time", { length: 5 }).default('09:00'),
	syncFrequency: varchar("sync_frequency", { length: 20 }).default('daily'),
	googleAccessToken: text("google_access_token"),
	googleRefreshToken: text("google_refresh_token"),
	googleTokenExpiry: timestamp("google_token_expiry", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_calendar_settings_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const userNotificationPreferences = pgTable("user_notification_preferences", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
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

export const subtasks = pgTable("subtasks", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	status: text().default('not_started').notNull(),
	priority: taskPriority().default('medium').notNull(),
	startDate: timestamp("start_date", { mode: 'string' }),
	dueDate: timestamp("due_date", { mode: 'string' }),
	estimatedHours: integer("estimated_hours"),
	estimatedDays: integer("estimated_days"),
	actualHours: integer("actual_hours").default(0),
	actualDays: integer("actual_days").default(0),
	progressPercent: integer("progress_percent").default(0).notNull(),
	moduleId: varchar("module_id").notNull(),
	assignedUserId: varchar("assigned_user_id"),
	assignedDevId: varchar("assigned_dev_id"),
	assignedConsultantId: varchar("assigned_consultant_id"),
	createdById: varchar("created_by_id").notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [modules.id],
			name: "subtasks_module_id_modules_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.assignedUserId],
			foreignColumns: [users.id],
			name: "subtasks_assigned_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedDevId],
			foreignColumns: [users.id],
			name: "subtasks_assigned_dev_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedConsultantId],
			foreignColumns: [users.id],
			name: "subtasks_assigned_consultant_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "subtasks_created_by_id_users_id_fk"
		}),
]);

export const teams = pgTable("teams", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	segment: projectSegment().default('private').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const invoiceCollections = pgTable("invoice_collections", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	invoiceId: varchar("invoice_id").notNull(),
	moduleId: varchar("module_id").notNull(),
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
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoiceReports.id],
			name: "invoice_collections_invoice_id_invoice_reports_id_fk"
		}),
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [modules.id],
			name: "invoice_collections_module_id_modules_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "invoice_collections_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.collectedBy],
			foreignColumns: [users.id],
			name: "invoice_collections_collected_by_users_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	email: varchar().notNull(),
	password: varchar().notNull(),
	firstName: varchar("first_name"),
	middleName: varchar("middle_name"),
	lastName: varchar("last_name"),
	phoneNumber: varchar("phone_number"),
	idNumber: varchar("id_number"),
	profileImageUrl: varchar("profile_image_url"),
	role: varchar({ length: 20 }).default('employee').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
	resetToken: text("reset_token"),
	resetTokenExpiry: timestamp("reset_token_expiry", { mode: 'string' }),
	temporaryPassword: varchar("temporary_password"),
	passwordGeneratedAt: timestamp("password_generated_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const subtaskDependencies = pgTable("subtask_dependencies", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	subtaskId: varchar("subtask_id").notNull(),
	dependsOnSubtaskId: varchar("depends_on_subtask_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.subtaskId],
			foreignColumns: [subtasks.id],
			name: "subtask_dependencies_subtask_id_subtasks_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.dependsOnSubtaskId],
			foreignColumns: [subtasks.id],
			name: "subtask_dependencies_depends_on_subtask_id_subtasks_id_fk"
		}).onDelete("cascade"),
]);
