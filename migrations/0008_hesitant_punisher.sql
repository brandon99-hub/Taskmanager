ALTER TABLE "marketing_projects" ADD COLUMN "institution" varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_projects" ADD COLUMN "lead_marketer" varchar;--> statement-breakpoint
ALTER TABLE "marketing_projects" ADD COLUMN "contact_person" varchar(200);--> statement-breakpoint
ALTER TABLE "marketing_projects" ADD COLUMN "contact_number" varchar(20);--> statement-breakpoint
ALTER TABLE "marketing_projects" ADD COLUMN "system_in_place" "system_in_place";--> statement-breakpoint
ALTER TABLE "marketing_projects" ADD COLUMN "need_availability" "need_availability";--> statement-breakpoint
ALTER TABLE "marketing_projects" ADD COLUMN "current_vendor" varchar(200);--> statement-breakpoint
ALTER TABLE "marketing_projects" ADD COLUMN "remarks" text;--> statement-breakpoint
ALTER TABLE "marketing_projects" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "marketing_projects" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "marketing_projects" DROP COLUMN "assigned_bd_id";