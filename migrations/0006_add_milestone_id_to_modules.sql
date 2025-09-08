ALTER TABLE "modules" ADD COLUMN "milestone_id" varchar;
--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE no action ON UPDATE no action;
