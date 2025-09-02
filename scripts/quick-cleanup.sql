-- Quick one-liner to remove duplicate phases (keeping oldest)
-- Run this directly in your database console

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
