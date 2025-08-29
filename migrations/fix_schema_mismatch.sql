-- Migration to fix schema mismatch
-- This script converts the old schema to the new schema structure

-- Step 1: Create new tables with correct structure
CREATE TABLE IF NOT EXISTS "modules_new" (
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

-- Step 2: Create new milestones table
CREATE TABLE IF NOT EXISTS "milestones_new" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar(200) NOT NULL,
    "description" text,
    "fee_amount" numeric(12,2),
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

-- Step 3: Migrate data from tasks to modules_new
INSERT INTO "modules_new" (
    "id", "name", "description", "priority", "status", "start_date", "due_date",
    "estimated_hours", "actual_hours", "weight", "project_id", "phase_number",
    "phase_name", "assigned_user_id", "assigned_team_id", "created_by_id",
    "completed_at", "progress_percent", "created_at", "updated_at"
)
SELECT 
    t.id,
    t.name,
    t.description,
    t.priority,
    t.status,
    t.start_date,
    t.due_date,
    t.estimated_hours,
    t.actual_hours,
    t.weight,
    t.milestone_id, -- This will be updated to project_id later
    t.phase_number,
    t.phase_name,
    t.assigned_user_id,
    t.assigned_team_id,
    t.created_by_id,
    t.completed_at,
    t.progress_percent,
    t.created_at,
    t.updated_at
FROM "tasks" t;

-- Step 4: Migrate data from project_milestones to milestones_new
INSERT INTO "milestones_new" (
    "id", "name", "description", "fee_amount", "billing_status",
    "expected_invoice_date", "expected_collection_date", "invoice_sent_at",
    "payment_received_at", "overdue_flag", "project_id", "created_by_id",
    "created_at", "updated_at"
)
SELECT 
    pm.id,
    pm.name,
    pm.description,
    pm.fee_amount,
    pm.billing_status,
    pm.expected_invoice_date,
    pm.expected_collection_date,
    pm.invoice_sent_at,
    pm.payment_received_at,
    pm.overdue_flag,
    pm.project_id,
    pm.created_by_id,
    pm.created_at,
    pm.updated_at
FROM "project_milestones" pm;

-- Step 5: Update modules_new.project_id to point to the correct project
-- We need to get the project_id from the milestone relationship
UPDATE "modules_new" m
SET "project_id" = (
    SELECT pm.project_id 
    FROM "project_milestones" pm 
    WHERE pm.id = m.project_id
)
WHERE EXISTS (
    SELECT 1 FROM "project_milestones" pm WHERE pm.id = m.project_id
);

-- Step 6: Drop old tables
DROP TABLE IF EXISTS "tasks" CASCADE;
DROP TABLE IF EXISTS "project_milestones" CASCADE;

-- Step 7: Rename new tables to final names
ALTER TABLE "modules_new" RENAME TO "modules";
ALTER TABLE "milestones_new" RENAME TO "milestones";

-- Step 8: Add foreign key constraints
ALTER TABLE "modules" 
ADD CONSTRAINT "modules_project_id_fkey" 
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;

ALTER TABLE "modules" 
ADD CONSTRAINT "modules_assigned_user_id_fkey" 
FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id");

ALTER TABLE "modules" 
ADD CONSTRAINT "modules_assigned_team_id_fkey" 
FOREIGN KEY ("assigned_team_id") REFERENCES "teams"("id");

ALTER TABLE "modules" 
ADD CONSTRAINT "modules_created_by_id_fkey" 
FOREIGN KEY ("created_by_id") REFERENCES "users"("id");

ALTER TABLE "milestones" 
ADD CONSTRAINT "milestones_project_id_fkey" 
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;

ALTER TABLE "milestones" 
ADD CONSTRAINT "milestones_created_by_id_fkey" 
FOREIGN KEY ("created_by_id") REFERENCES "users"("id");

-- Step 9: Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_modules_project_id" ON "modules"("project_id");
CREATE INDEX IF NOT EXISTS "idx_modules_assigned_user_id" ON "modules"("assigned_user_id");
CREATE INDEX IF NOT EXISTS "idx_modules_status" ON "modules"("status");
CREATE INDEX IF NOT EXISTS "idx_modules_due_date" ON "modules"("due_date");

CREATE INDEX IF NOT EXISTS "idx_milestones_project_id" ON "milestones"("project_id");
CREATE INDEX IF NOT EXISTS "idx_milestones_billing_status" ON "milestones"("billing_status");

-- Step 10: Update any remaining references
-- This will be handled by the application code updates
