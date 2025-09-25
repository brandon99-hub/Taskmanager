CREATE TABLE "admin_role_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"head_role_id" varchar NOT NULL,
	"manager_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"role_type" varchar(50) NOT NULL,
	"segment" "project_segment",
	"assigned_at" timestamp DEFAULT now(),
	"assigned_by" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_number" varchar(50) NOT NULL,
	"project_id" varchar NOT NULL,
	"client_name" varchar(200) NOT NULL,
	"client_email" varchar(200) NOT NULL,
	"client_phone" varchar(50),
	"client_address" text,
	"contract_type" varchar(20) NOT NULL,
	"total_value" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'KES' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"signed_date" timestamp,
	"created_by" varchar NOT NULL,
	"project_scope" text,
	"deliverables" jsonb,
	"payment_terms" text,
	"special_clauses" jsonb,
	"responsibilities" jsonb,
	"timeline" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "end_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subtasks" ALTER COLUMN "module_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "priority" "task_priority" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "end_date" timestamp;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "phase_number" integer;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "phase_name" varchar(100);--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "phase" varchar(100);--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "milestone_id" varchar;--> statement-breakpoint
ALTER TABLE "subtasks" ADD COLUMN "milestone_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_password_change" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_project_manager" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_finance_head" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "assigned_segment" "project_segment";--> statement-breakpoint
ALTER TABLE "admin_role_members" ADD CONSTRAINT "admin_role_members_head_role_id_admin_roles_id_fk" FOREIGN KEY ("head_role_id") REFERENCES "public"."admin_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_members" ADD CONSTRAINT "admin_role_members_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unique_head_manager" ON "admin_role_members" USING btree ("head_role_id","manager_user_id");--> statement-breakpoint
CREATE INDEX "unique_user_role" ON "admin_roles" USING btree ("user_id","role_type","segment");--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."task_status";--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('not_started', 'ongoing', 'in_progress', 'fc_review', 'qa', 'client_review', 'finished', 'done', 'overdue', 'delayed', 'on_hold', 'cancelled', 'todo');