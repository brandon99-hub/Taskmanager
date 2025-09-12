-- Migration: Make projects.start_date and projects.end_date nullable
-- This drops NOT NULL constraints to allow optional project timelines

ALTER TABLE projects ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE projects ALTER COLUMN end_date DROP NOT NULL;
