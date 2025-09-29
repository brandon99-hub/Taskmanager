-- Marketing System Restructure Migration
-- This migration restructures the marketing system to use sectors, projects, and unified prospects

-- Add new enums
CREATE TYPE "public"."system_in_place" AS ENUM('navision', '365_bc', 'none', 'open_source', 'oracle', 'sap');
CREATE TYPE "public"."need_availability" AS ENUM('upgrade', 'under_implementation', 'none');
CREATE TYPE "public"."prospect_stage" AS ENUM('prospect', 'lead', 'expected_order', 'sales_won');

-- Update marketing_user_role enum
ALTER TYPE "public"."marketing_user_role" ADD VALUE 'business_development';

-- Create marketing_sectors table
CREATE TABLE "marketing_sectors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create unique index for sector names
CREATE UNIQUE INDEX "marketing_sectors_name_unique" ON "marketing_sectors" ("name");

-- Create marketing_projects table
CREATE TABLE "marketing_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"assigned_bd_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create marketing_prospects table (replaces marketing_leads)
CREATE TABLE "marketing_prospects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp NOT NULL,
	"client" varchar(200) NOT NULL,
	"contact_person" varchar(200) NOT NULL,
	"contact_number" varchar(20) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"system_in_place" "system_in_place" NOT NULL,
	"need_availability" "need_availability" NOT NULL,
	"current_vendor" varchar(200),
	"remarks" text,
	"revenue" numeric(12, 2),
	"stage" "prospect_stage" DEFAULT 'prospect' NOT NULL,
	"bd_id" varchar NOT NULL,
	"sector_id" varchar NOT NULL,
	"shared_with_bd_id" varchar,
	"revenue_split" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE "marketing_projects" ADD CONSTRAINT "marketing_projects_sector_id_marketing_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "marketing_sectors"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "marketing_projects" ADD CONSTRAINT "marketing_projects_assigned_bd_id_marketing_users_id_fk" FOREIGN KEY ("assigned_bd_id") REFERENCES "marketing_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "marketing_prospects" ADD CONSTRAINT "marketing_prospects_bd_id_marketing_users_id_fk" FOREIGN KEY ("bd_id") REFERENCES "marketing_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "marketing_prospects" ADD CONSTRAINT "marketing_prospects_shared_with_bd_id_marketing_users_id_fk" FOREIGN KEY ("shared_with_bd_id") REFERENCES "marketing_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "marketing_prospects" ADD CONSTRAINT "marketing_prospects_sector_id_marketing_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "marketing_sectors"("id") ON DELETE no action ON UPDATE no action;

-- Insert default sectors
INSERT INTO "marketing_sectors" ("name", "description") VALUES
('Private Colleges', 'Private educational institutions offering college-level programs'),
('Public Universities', 'Government-funded universities and higher education institutions'),
('Private Universities', 'Privately owned universities and higher education institutions'),
('Nursing Schools', 'Educational institutions specializing in nursing and healthcare education'),
('Ministries & State Depts', 'Government ministries and state departments'),
('Healthcare', 'Hospitals, clinics, and healthcare facilities'),
('Finance', 'Banks, insurance companies, and financial institutions'),
('Manufacturing', 'Industrial and manufacturing companies'),
('Retail', 'Retail businesses and commercial establishments'),
('Technology', 'IT companies and technology firms');

-- Migrate existing data from marketing_leads to marketing_prospects
-- Note: This is a basic migration - you may need to adjust based on your existing data
INSERT INTO "marketing_prospects" (
  "id", "date", "client", "contact_person", "contact_number", "contact_email",
  "system_in_place", "need_availability", "current_vendor", "remarks", "revenue",
  "stage", "bd_id", "sector_id", "created_at", "updated_at"
)
SELECT 
  "id",
  "date",
  "client",
  COALESCE(SPLIT_PART("contact_details", ' - ', 1), "client") as "contact_person",
  COALESCE(SPLIT_PART("contact_details", ' - ', 2), '') as "contact_number",
  COALESCE(SPLIT_PART("contact_details", ' - ', 3), '') as "contact_email",
  'none'::system_in_place as "system_in_place",
  'none'::need_availability as "need_availability",
  '' as "current_vendor",
  "remarks",
  COALESCE("budget", 0) as "revenue",
  CASE 
    WHEN "sales_stage" = 'closed_won' THEN 'sales_won'::prospect_stage
    WHEN "sales_stage" = 'lead' THEN 'prospect'::prospect_stage
    ELSE 'prospect'::prospect_stage
  END as "stage",
  "marketer_id" as "bd_id",
  (SELECT "id" FROM "marketing_sectors" WHERE "name" = 'Private Colleges' LIMIT 1) as "sector_id",
  "created_at",
  "updated_at"
FROM "marketing_leads";

-- Update existing users to business_development role
UPDATE "marketing_users" 
SET "role" = 'business_development' 
WHERE "role" = 'marketer';

-- Drop the old marketing_leads table
DROP TABLE "marketing_leads";
