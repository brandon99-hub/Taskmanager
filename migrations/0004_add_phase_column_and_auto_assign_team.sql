-- Migration to add phase column and update team assignment
-- Add phase column to modules table for better phase tracking
ALTER TABLE modules ADD COLUMN IF NOT EXISTS phase VARCHAR(100);

-- Update the phase column based on existing phase_number and phase_name
UPDATE modules 
SET phase = CASE 
  WHEN phase_number = 1 THEN 'initiation_contracting'
  WHEN phase_number = 2 THEN 'requirements_design'  
  WHEN phase_number = 3 THEN 'development'
  WHEN phase_number = 4 THEN 'testing_validation'
  WHEN phase_number = 5 THEN 'deployment_golive'
  WHEN phase_number = 6 THEN 'transition_closure'
  ELSE 'initiation_contracting'
END
WHERE phase IS NULL;

-- Update assigned_team_id to match the project's team_id for all modules that don't have a team assigned
UPDATE modules 
SET assigned_team_id = (
  SELECT team_id 
  FROM projects 
  WHERE projects.id = modules.project_id
)
WHERE assigned_team_id IS NULL 
  AND EXISTS (
    SELECT 1 
    FROM projects 
    WHERE projects.id = modules.project_id 
      AND projects.team_id IS NOT NULL
  );

-- Create index on phase column for better query performance
CREATE INDEX IF NOT EXISTS idx_modules_phase ON modules(phase);

-- Create index on project_id and phase combination for efficient phase-based queries
CREATE INDEX IF NOT EXISTS idx_modules_project_phase ON modules(project_id, phase);