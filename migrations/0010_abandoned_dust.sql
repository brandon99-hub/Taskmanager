ALTER TABLE "marketing_projects" ALTER COLUMN "sector_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_annual_summary" ADD COLUMN "revised_target" numeric(12, 2) DEFAULT '0' NOT NULL;