-- Add start_date and end_date columns to milestones table
ALTER TABLE "milestones" ADD COLUMN "start_date" timestamp;
ALTER TABLE "milestones" ADD COLUMN "end_date" timestamp;
