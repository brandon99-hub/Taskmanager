CREATE TYPE "public"."need_availability" AS ENUM('upgrade', 'under_implementation', 'none');--> statement-breakpoint
CREATE TYPE "public"."prospect_stage" AS ENUM('prospect', 'lead', 'expected_order', 'sales_won');--> statement-breakpoint
CREATE TYPE "public"."system_in_place" AS ENUM('navision', '365_bc', 'none', 'open_source', 'oracle', 'sap');--> statement-breakpoint
ALTER TYPE "public"."marketing_user_role" ADD VALUE 'business_development';--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "marketing_sectors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "marketing_leads" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "marketing_leads" CASCADE;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ALTER COLUMN "revenue" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_users" ALTER COLUMN "role" SET DEFAULT 'business_development';--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "date" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "client" varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "contact_person" varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "contact_number" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "contact_email" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "system_in_place" "system_in_place" NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "need_availability" "need_availability" NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "current_vendor" varchar(200);--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "remarks" text;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "stage" "prospect_stage" DEFAULT 'prospect' NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "bd_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "sector_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "shared_with_bd_id" varchar;--> statement-breakpoint
ALTER TABLE "marketing_prospects" ADD COLUMN "revenue_split" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "marketing_users" ADD COLUMN "target" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
CREATE INDEX "marketing_sectors_name_unique" ON "marketing_sectors" USING btree ("name");--> statement-breakpoint
ALTER TABLE "marketing_prospects" DROP COLUMN "organisation_name";--> statement-breakpoint
ALTER TABLE "marketing_prospects" DROP COLUMN "sector";--> statement-breakpoint
ALTER TABLE "marketing_prospects" DROP COLUMN "product";--> statement-breakpoint
ALTER TABLE "marketing_prospects" DROP COLUMN "expected_quarter";--> statement-breakpoint
ALTER TABLE "marketing_prospects" DROP COLUMN "comments";--> statement-breakpoint
ALTER TABLE "marketing_prospects" DROP COLUMN "marketer_id";