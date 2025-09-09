-- Add phaseNumber and phaseName to milestones
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "phase_number" integer;
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "phase_name" varchar(100);

-- Backfill: try to infer from existing modules if present (optional, safe no-op if none)
UPDATE "milestones" m
SET phase_number = COALESCE(
  (
    SELECT DISTINCT ON (mm.milestone_id) md.phase_number
    FROM module_milestones mm
    JOIN modules md ON md.id = mm.module_id
    WHERE mm.milestone_id = m.id AND md.phase_number IS NOT NULL
  ),
  phase_number
),
phase_name = COALESCE(
  (
    SELECT DISTINCT ON (mm.milestone_id) md.phase_name
    FROM module_milestones mm
    JOIN modules md ON md.id = mm.module_id
    WHERE mm.milestone_id = m.id AND md.phase_name IS NOT NULL
  ),
  phase_name
);

