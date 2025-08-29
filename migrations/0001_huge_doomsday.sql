CREATE TABLE "milestones" (
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
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "module_dependencies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" varchar NOT NULL,
	"depends_on_module_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "module_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" varchar NOT NULL,
	"milestone_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"start_date" timestamp,
	"due_date" timestamp,
	"estimated_hours" integer,
	"actual_hours" integer DEFAULT 0,
	"weight" integer DEFAULT 2,
	"project_id" varchar NOT NULL,
	"phase_number" integer,
	"phase_name" varchar(100),
	"assigned_user_id" varchar,
	"assigned_team_id" varchar,
	"created_by_id" varchar NOT NULL,
	"completed_at" timestamp,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "phase_deliverables" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "phase_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_charters" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_milestones" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "security_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "phase_deliverables" CASCADE;--> statement-breakpoint
DROP TABLE "phase_reports" CASCADE;--> statement-breakpoint
DROP TABLE "project_charters" CASCADE;--> statement-breakpoint
DROP TABLE "tasks" CASCADE;--> statement-breakpoint
DROP TABLE "project_milestones" CASCADE;--> statement-breakpoint
DROP TABLE "security_events" CASCADE;--> statement-breakpoint
ALTER TABLE "invoice_reports" DROP CONSTRAINT "invoice_reports_invoice_number_key";--> statement-breakpoint
ALTER TABLE "monthly_targets" DROP CONSTRAINT "monthly_targets_year_month_segment_key";--> statement-breakpoint
ALTER TABLE "segment_leaders" DROP CONSTRAINT "segment_leaders_segment_key";--> statement-breakpoint
ALTER TABLE "team_member_roles" DROP CONSTRAINT "team_member_roles_team_member_id_role_id_key";--> statement-breakpoint
ALTER TABLE "employee_roles" DROP CONSTRAINT "employee_roles_role_name_key";--> statement-breakpoint
ALTER TABLE "external_notification_recipients" DROP CONSTRAINT "external_notification_recipients_type_email_key";--> statement-breakpoint
ALTER TABLE "system_config" DROP CONSTRAINT "system_config_key_key";--> statement-breakpoint
ALTER TABLE "monthly_targets" DROP CONSTRAINT "monthly_targets_month_check";--> statement-breakpoint
ALTER TABLE "segment_leaders" DROP CONSTRAINT "segment_leaders_segment_check";--> statement-breakpoint
ALTER TABLE "external_notification_recipients" DROP CONSTRAINT "external_notification_recipients_type_check";--> statement-breakpoint
ALTER TABLE "subtask_dependencies" DROP CONSTRAINT "check_no_self_dependency";--> statement-breakpoint
ALTER TABLE "invoice_reports" DROP CONSTRAINT "invoice_reports_project_id_fkey";
--> statement-breakpoint
ALTER TABLE "invoice_reports" DROP CONSTRAINT "invoice_reports_sent_by_fkey";
--> statement-breakpoint
ALTER TABLE "invoice_collections" DROP CONSTRAINT "invoice_collections_invoice_id_fkey";
--> statement-breakpoint
ALTER TABLE "invoice_collections" DROP CONSTRAINT "invoice_collections_project_id_fkey";
--> statement-breakpoint
ALTER TABLE "invoice_collections" DROP CONSTRAINT "invoice_collections_collected_by_fkey";
--> statement-breakpoint
ALTER TABLE "project_phases" DROP CONSTRAINT "project_phases_project_id_fkey";
--> statement-breakpoint
ALTER TABLE "team_member_roles" DROP CONSTRAINT "team_member_roles_team_member_id_fkey";
--> statement-breakpoint
ALTER TABLE "team_member_roles" DROP CONSTRAINT "team_member_roles_role_id_fkey";
--> statement-breakpoint
ALTER TABLE "subtask_dependencies" DROP CONSTRAINT "subtask_dependencies_subtask_id_fkey";
--> statement-breakpoint
ALTER TABLE "subtask_dependencies" DROP CONSTRAINT "subtask_dependencies_depends_on_subtask_id_fkey";
--> statement-breakpoint
ALTER TABLE "subtasks" DROP CONSTRAINT "subtasks_assigned_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "subtasks" DROP CONSTRAINT "subtasks_created_by_id_fkey";
--> statement-breakpoint
ALTER TABLE "subtasks" DROP CONSTRAINT "subtasks_assigned_dev_id_fkey";
--> statement-breakpoint
ALTER TABLE "subtasks" DROP CONSTRAINT "subtasks_assigned_consultant_id_fkey";
--> statement-breakpoint
ALTER TABLE "subtasks" DROP CONSTRAINT "subtasks_milestone_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_projects_contact_email";--> statement-breakpoint
DROP INDEX "idx_projects_segment";--> statement-breakpoint
DROP INDEX "idx_invoice_reports_status";--> statement-breakpoint
DROP INDEX "idx_monthly_targets_year_month";--> statement-breakpoint
DROP INDEX "idx_invoice_collections_date";--> statement-breakpoint
DROP INDEX "project_phases_project_id_idx";--> statement-breakpoint
DROP INDEX "project_phases_status_idx";--> statement-breakpoint
DROP INDEX "idx_segment_leaders_segment";--> statement-breakpoint
DROP INDEX "idx_team_member_roles_role";--> statement-breakpoint
DROP INDEX "idx_team_member_roles_team_member";--> statement-breakpoint
DROP INDEX "idx_external_notification_active";--> statement-breakpoint
DROP INDEX "idx_external_notification_type";--> statement-breakpoint
DROP INDEX "idx_subtask_dependencies_depends_on";--> statement-breakpoint
DROP INDEX "idx_subtask_dependencies_subtask_id";--> statement-breakpoint
DROP INDEX "idx_subtasks_assigned_consultant_id";--> statement-breakpoint
DROP INDEX "idx_subtasks_assigned_dev_id";--> statement-breakpoint
DROP INDEX "idx_subtasks_assigned_user_id";--> statement-breakpoint
DROP INDEX "idx_subtasks_status";--> statement-breakpoint
DROP INDEX "idx_session_expire";--> statement-breakpoint
DROP INDEX "unique_project_phase";--> statement-breakpoint
DROP INDEX "unique_key";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "segment" SET DATA TYPE project_segment;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "contact_person" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "contact_phone" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "contact_email" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "temporary_password" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "monthly_targets" ALTER COLUMN "segment" SET DATA TYPE project_segment;--> statement-breakpoint
ALTER TABLE "project_phases" ALTER COLUMN "phase_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "project_phases" ALTER COLUMN "phase_name" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "project_phases" ALTER COLUMN "status" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "project_phases" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_phases" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "segment_leaders" ALTER COLUMN "segment" SET DATA TYPE project_segment;--> statement-breakpoint
ALTER TABLE "segment_leaders" ALTER COLUMN "leader_email" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "segment_leaders" ALTER COLUMN "leader_name" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "employee_roles" ALTER COLUMN "role_name" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "external_notification_recipients" ALTER COLUMN "email" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "invoice_reports" ADD COLUMN "module_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_collections" ADD COLUMN "module_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "subtasks" ADD COLUMN "module_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_dependencies" ADD CONSTRAINT "module_dependencies_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_dependencies" ADD CONSTRAINT "module_dependencies_depends_on_module_id_modules_id_fk" FOREIGN KEY ("depends_on_module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_milestones" ADD CONSTRAINT "module_milestones_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_milestones" ADD CONSTRAINT "module_milestones_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_assigned_team_id_teams_id_fk" FOREIGN KEY ("assigned_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reports" ADD CONSTRAINT "invoice_reports_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reports" ADD CONSTRAINT "invoice_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reports" ADD CONSTRAINT "invoice_reports_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_collections" ADD CONSTRAINT "invoice_collections_invoice_id_invoice_reports_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_collections" ADD CONSTRAINT "invoice_collections_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_collections" ADD CONSTRAINT "invoice_collections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_collections" ADD CONSTRAINT "invoice_collections_collected_by_users_id_fk" FOREIGN KEY ("collected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_roles" ADD CONSTRAINT "team_member_roles_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_roles" ADD CONSTRAINT "team_member_roles_role_id_employee_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."employee_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtask_dependencies" ADD CONSTRAINT "subtask_dependencies_subtask_id_subtasks_id_fk" FOREIGN KEY ("subtask_id") REFERENCES "public"."subtasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtask_dependencies" ADD CONSTRAINT "subtask_dependencies_depends_on_subtask_id_subtasks_id_fk" FOREIGN KEY ("depends_on_subtask_id") REFERENCES "public"."subtasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_assigned_dev_id_users_id_fk" FOREIGN KEY ("assigned_dev_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_assigned_consultant_id_users_id_fk" FOREIGN KEY ("assigned_consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unique_year_month_segment" ON "monthly_targets" USING btree ("year","month","segment");--> statement-breakpoint
CREATE INDEX "unique_segment" ON "segment_leaders" USING btree ("segment");--> statement-breakpoint
CREATE INDEX "unique_team_member_role" ON "team_member_roles" USING btree ("team_member_id","role_id");--> statement-breakpoint
CREATE INDEX "unique_type_email" ON "external_notification_recipients" USING btree ("type","email");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "unique_project_phase" ON "project_phases" USING btree ("project_id","phase_number");--> statement-breakpoint
CREATE INDEX "unique_key" ON "system_config" USING btree ("key");--> statement-breakpoint
ALTER TABLE "invoice_reports" DROP COLUMN "task_id";--> statement-breakpoint
ALTER TABLE "invoice_collections" DROP COLUMN "task_id";--> statement-breakpoint
ALTER TABLE "subtasks" DROP COLUMN "milestone_id";--> statement-breakpoint
ALTER TABLE "invoice_reports" ADD CONSTRAINT "invoice_reports_invoice_number_unique" UNIQUE("invoice_number");--> statement-breakpoint
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_role_name_unique" UNIQUE("role_name");--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_key_unique" UNIQUE("key");--> statement-breakpoint
ALTER TABLE "public"."modules" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."subtasks" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."task_status";--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('not_started', 'started', 'ongoing', 'finished', 'overdue', 'todo', 'in_progress', 'qa', 'client_review', 'done', 'delayed', 'on_hold', 'cancelled');--> statement-breakpoint
ALTER TABLE "public"."modules" ALTER COLUMN "status" SET DATA TYPE "public"."task_status" USING "status"::"public"."task_status";--> statement-breakpoint
ALTER TABLE "public"."subtasks" ALTER COLUMN "status" SET DATA TYPE "public"."task_status" USING "status"::"public"."task_status";--> statement-breakpoint
DROP TYPE "public"."phaseStatusEnum";--> statement-breakpoint
DROP TYPE "public"."phaseTypeEnum";--> statement-breakpoint
DROP TYPE "public"."phase_status";--> statement-breakpoint
DROP TYPE "public"."phase_type";