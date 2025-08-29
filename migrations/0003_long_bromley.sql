ALTER TABLE "modules" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "subtasks" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "description" text;