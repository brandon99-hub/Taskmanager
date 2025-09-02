-- Script to remove duplicate project phases
-- This will keep the oldest phase for each (projectId, phaseNumber) combination

-- First, let's see what duplicates we have
SELECT 
    project_id, 
    phase_number, 
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as phase_ids
FROM project_phases 
GROUP BY project_id, phase_number 
HAVING COUNT(*) > 1
ORDER BY project_id, phase_number;

-- Remove duplicates, keeping only the oldest one (first created)
-- This uses a window function to identify duplicates and deletes all but the first one
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY project_id, phase_number 
            ORDER BY created_at ASC
        ) as rn
    FROM project_phases
)
DELETE FROM project_phases 
WHERE id IN (
    SELECT id 
    FROM duplicates 
    WHERE rn > 1
);

-- Verify the cleanup worked
SELECT 
    project_id, 
    phase_number, 
    COUNT(*) as remaining_count
FROM project_phases 
GROUP BY project_id, phase_number 
HAVING COUNT(*) > 1
ORDER BY project_id, phase_number;

-- Show final phase count per project
SELECT 
    project_id,
    COUNT(*) as total_phases,
    STRING_AGG(phase_number::text, ', ' ORDER BY phase_number) as phase_numbers
FROM project_phases 
GROUP BY project_id
ORDER BY project_id;
