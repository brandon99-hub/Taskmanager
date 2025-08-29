-- Fix database schema issues by dropping and recreating problematic tables
-- This will allow us to start fresh with the correct structure

-- Drop tables that have schema conflicts (in dependency order)
DROP TABLE IF EXISTS subtask_dependencies CASCADE;
DROP TABLE IF EXISTS subtasks CASCADE;
DROP TABLE IF EXISTS module_dependencies CASCADE;
DROP TABLE IF EXISTS module_milestones CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS project_phases CASCADE;
DROP TABLE IF EXISTS milestones CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Drop the problematic enum types
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;

-- Now the database should be clean and ready for our schema
