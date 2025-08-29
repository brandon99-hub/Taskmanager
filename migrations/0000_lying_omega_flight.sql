-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."billing_status" AS ENUM('none', 'to_send', 'sent', 'paid', 'overdue', 'processing');--> statement-breakpoint
CREATE TYPE "public"."phaseStatusEnum" AS ENUM('not_started', 'in_progress', 'completed', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."phaseTypeEnum" AS ENUM('initiation_contracting', 'requirements_design', 'development', 'testing_validation', 'deployment_golive', 'transition_closure');--> statement-breakpoint
CREATE TYPE "public"."phase_status" AS ENUM('not_started', 'in_progress', 'completed', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."phase_type" AS ENUM('initiation_contracting', 'requirements_design', 'development', 'testing_validation', 'deployment_golive', 'transition_closure');--> statement-breakpoint
CREATE TYPE "public"."project_segment" AS ENUM('academic', 'parastals', 'private');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled', 'terminated', 'on_support');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'fc_review', 'review', 'done', 'qa', 'client_review', 'delayed', 'on_hold', 'cancelled', 'not_started', 'started', 'ongoing', 'finished');--> statement-breakpoint
CREATE TABLE "teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"segment" "project_segment" DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"client" varchar(200),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"budget" numeric(12, 2),
	"team_id" varchar,
	"manager_id" varchar NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"segment" varchar(20) DEFAULT 'private' NOT NULL,
	"contact_person" varchar(255),
	"contact_phone" varchar(50),
	"contact_email" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar(50) DEFAULT 'member',
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"uploaded_by_id" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"related_id" varchar,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar(20) DEFAULT 'employee' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"reset_token" text,
	"reset_token_expiry" timestamp,
	"temporary_password" varchar(255),
	"password_generated_at" timestamp,
	"middle_name" varchar,
	"phone_number" varchar,
	"id_number" varchar,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email_task_assigned" boolean DEFAULT true,
	"email_task_due_soon" boolean DEFAULT true,
	"email_task_overdue" boolean DEFAULT true,
	"email_project_deadline" boolean DEFAULT true,
	"email_team_updates" boolean DEFAULT false,
	"in_app_task_assigned" boolean DEFAULT true,
	"in_app_task_due_soon" boolean DEFAULT true,
	"in_app_task_overdue" boolean DEFAULT true,
	"in_app_project_deadline" boolean DEFAULT true,
	"in_app_team_updates" boolean DEFAULT true,
	"due_soon_days" integer DEFAULT 2,
	"reminder_time" varchar(5) DEFAULT '09:00',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_calendar_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"is_connected" boolean DEFAULT false,
	"sync_enabled" boolean DEFAULT false,
	"reminder_time" varchar(5) DEFAULT '09:00',
	"sync_frequency" varchar(20) DEFAULT 'daily',
	"google_access_token" text,
	"google_refresh_token" text,
	"google_token_expiry" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"calendar_name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "invoice_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"invoice_number" varchar(100) NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"expected_collection_date" timestamp NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'sent' NOT NULL,
	"sent_by" varchar NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"paid_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoice_reports_invoice_number_key" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "monthly_targets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"segment" varchar(20) NOT NULL,
	"target_amount" numeric(12, 2) NOT NULL,
	"actual_amount" numeric(12, 2) DEFAULT '0',
	"calculated_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "monthly_targets_year_month_segment_key" UNIQUE("year","month","segment"),
	CONSTRAINT "monthly_targets_month_check" CHECK ((month >= 1) AND (month <= 12))
);
--> statement-breakpoint
CREATE TABLE "invoice_collections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"task_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"collection_date" timestamp NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" varchar(100),
	"reference" varchar(200),
	"notes" text,
	"collected_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_phases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"phase_number" integer NOT NULL,
	"phase_type" "phase_type" NOT NULL,
	"phase_name" varchar NOT NULL,
	"description" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"status" "phase_status" DEFAULT 'not_started' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"deliverables" jsonb,
	"completion_report" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase_deliverables" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"type" varchar NOT NULL,
	"file_path" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" varchar NOT NULL,
	"report_type" varchar NOT NULL,
	"content" jsonb,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_charters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"project_objectives" text,
	"success_criteria" text,
	"risk_assessment" text,
	"stakeholder_list" text,
	"business_case" text,
	"scope_statement" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_charters_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "segment_leaders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment" varchar(20) NOT NULL,
	"leader_email" varchar(255) NOT NULL,
	"leader_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "segment_leaders_segment_key" UNIQUE("segment"),
	CONSTRAINT "segment_leaders_segment_check" CHECK ((segment)::text = ANY ((ARRAY['academic'::character varying, 'parastals'::character varying, 'private'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "team_member_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_member_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "team_member_roles_team_member_id_role_id_key" UNIQUE("team_member_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "employee_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "employee_roles_role_name_key" UNIQUE("role_name")
);
--> statement-breakpoint
CREATE TABLE "external_notification_recipients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "external_notification_recipients_type_email_key" UNIQUE("type","email"),
	CONSTRAINT "external_notification_recipients_type_check" CHECK ((type)::text = ANY ((ARRAY['finance'::character varying, 'account_manager'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_config_key_key" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "subtask_dependencies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subtask_id" varchar NOT NULL,
	"depends_on_subtask_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "check_no_self_dependency" CHECK ((subtask_id)::text <> (depends_on_subtask_id)::text)
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'not_started' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"start_date" timestamp,
	"due_date" timestamp,
	"estimated_hours" integer,
	"estimated_days" integer,
	"actual_hours" integer DEFAULT 0,
	"actual_days" integer DEFAULT 0,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"assigned_user_id" varchar,
	"created_by_id" varchar NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"assigned_dev_id" varchar,
	"assigned_consultant_id" varchar,
	"milestone_id" varchar
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'not_started' NOT NULL,
	"start_date" timestamp,
	"due_date" timestamp,
	"estimated_hours" integer,
	"actual_hours" integer DEFAULT 0,
	"weight" integer DEFAULT 2,
	"assigned_user_id" varchar,
	"assigned_team_id" varchar,
	"milestone_id" varchar NOT NULL,
	"phase_number" integer,
	"phase_name" varchar,
	"created_by_id" varchar NOT NULL,
	"completed_at" timestamp,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"fee_amount" numeric(12, 2),
	"billing_status" "billing_status" DEFAULT 'none' NOT NULL,
	"expected_invoice_date" timestamp,
	"expected_collection_date" timestamp,
	"invoice_sent_at" timestamp,
	"payment_received_at" timestamp,
	"overdue_flag" boolean DEFAULT false,
	"project_id" varchar NOT NULL,
	"phase_number" integer,
	"phase_name" varchar,
	"completion_criteria" text,
	"modules_required" integer DEFAULT 1,
	"completed_modules" integer DEFAULT 0,
	"status" "task_status" DEFAULT 'not_started' NOT NULL,
	"created_by_id" varchar NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"user_id" varchar,
	"details" jsonb,
	"severity" varchar DEFAULT 'medium',
	"source" varchar DEFAULT 'taskflow-security',
	"success" boolean DEFAULT false,
	"timestamp" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_attachments" ADD CONSTRAINT "project_attachments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_attachments" ADD CONSTRAINT "project_attachments_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_calendar_settings" ADD CONSTRAINT "user_calendar_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reports" ADD CONSTRAINT "invoice_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reports" ADD CONSTRAINT "invoice_reports_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_collections" ADD CONSTRAINT "invoice_collections_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_collections" ADD CONSTRAINT "invoice_collections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_collections" ADD CONSTRAINT "invoice_collections_collected_by_fkey" FOREIGN KEY ("collected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_deliverables" ADD CONSTRAINT "phase_deliverables_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_reports" ADD CONSTRAINT "phase_reports_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_reports" ADD CONSTRAINT "phase_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_charters" ADD CONSTRAINT "project_charters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_roles" ADD CONSTRAINT "team_member_roles_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_roles" ADD CONSTRAINT "team_member_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."employee_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtask_dependencies" ADD CONSTRAINT "subtask_dependencies_subtask_id_fkey" FOREIGN KEY ("subtask_id") REFERENCES "public"."subtasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtask_dependencies" ADD CONSTRAINT "subtask_dependencies_depends_on_subtask_id_fkey" FOREIGN KEY ("depends_on_subtask_id") REFERENCES "public"."subtasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_assigned_dev_id_fkey" FOREIGN KEY ("assigned_dev_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_assigned_consultant_id_fkey" FOREIGN KEY ("assigned_consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "modules_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "modules_assigned_team_id_fkey" FOREIGN KEY ("assigned_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "modules_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."project_milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "modules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "milestones_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_projects_contact_email" ON "projects" USING btree ("contact_email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_projects_segment" ON "projects" USING btree ("segment" text_ops);--> statement-breakpoint
CREATE INDEX "idx_invoice_reports_status" ON "invoice_reports" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_monthly_targets_year_month" ON "monthly_targets" USING btree ("year" int4_ops,"month" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_invoice_collections_date" ON "invoice_collections" USING btree ("collection_date" timestamp_ops);--> statement-breakpoint
CREATE INDEX "project_phases_project_id_idx" ON "project_phases" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX "project_phases_status_idx" ON "project_phases" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_project_phase" ON "project_phases" USING btree ("project_id" text_ops,"phase_number" int4_ops);--> statement-breakpoint
CREATE INDEX "phase_deliverables_phase_id_idx" ON "phase_deliverables" USING btree ("phase_id" text_ops);--> statement-breakpoint
CREATE INDEX "phase_reports_phase_id_idx" ON "phase_reports" USING btree ("phase_id" text_ops);--> statement-breakpoint
CREATE INDEX "project_charters_project_id_idx" ON "project_charters" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_segment_leaders_segment" ON "segment_leaders" USING btree ("segment" text_ops);--> statement-breakpoint
CREATE INDEX "idx_team_member_roles_role" ON "team_member_roles" USING btree ("role_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_team_member_roles_team_member" ON "team_member_roles" USING btree ("team_member_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_external_notification_active" ON "external_notification_recipients" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_external_notification_type" ON "external_notification_recipients" USING btree ("type" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_key" ON "system_config" USING btree ("key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subtask_dependencies_depends_on" ON "subtask_dependencies" USING btree ("depends_on_subtask_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subtask_dependencies_subtask_id" ON "subtask_dependencies" USING btree ("subtask_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subtasks_assigned_consultant_id" ON "subtasks" USING btree ("assigned_consultant_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subtasks_assigned_dev_id" ON "subtasks" USING btree ("assigned_dev_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subtasks_assigned_user_id" ON "subtasks" USING btree ("assigned_user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subtasks_status" ON "subtasks" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_session_expire" ON "sessions" USING btree ("expire" timestamp_ops);
*/