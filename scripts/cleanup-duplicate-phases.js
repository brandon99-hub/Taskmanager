const { Pool } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function cleanupDuplicatePhases() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔍 Checking for duplicate phases...');
    
    // First, let's see what duplicates we have
    const duplicatesQuery = `
      SELECT 
          project_id, 
          phase_number, 
          COUNT(*) as duplicate_count,
          STRING_AGG(id::text, ', ') as phase_ids
      FROM project_phases 
      GROUP BY project_id, phase_number 
      HAVING COUNT(*) > 1
      ORDER BY project_id, phase_number;
    `;
    
    const duplicates = await pool.query(duplicatesQuery);
    
    if (duplicates.rows.length === 0) {
      console.log('✅ No duplicate phases found!');
      return;
    }
    
    console.log(`❌ Found ${duplicates.rows.length} duplicate phase groups:`);
    duplicates.rows.forEach(row => {
      console.log(`   Project ${row.project_id}, Phase ${row.phase_number}: ${row.duplicate_count} duplicates (IDs: ${row.phase_ids})`);
    });
    
    console.log('\n🧹 Removing duplicates (keeping oldest phase for each group)...');
    
    // Remove duplicates, keeping only the oldest one (first created)
    const deleteQuery = `
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
    `;
    
    const deleteResult = await pool.query(deleteQuery);
    console.log(`🗑️  Deleted ${deleteResult.rowCount} duplicate phases`);
    
    // Verify the cleanup worked
    console.log('\n✅ Verifying cleanup...');
    const verifyQuery = `
      SELECT 
          project_id, 
          phase_number, 
          COUNT(*) as remaining_count
      FROM project_phases 
      GROUP BY project_id, phase_number 
      HAVING COUNT(*) > 1
      ORDER BY project_id, phase_number;
    `;
    
    const remainingDuplicates = await pool.query(verifyQuery);
    
    if (remainingDuplicates.rows.length === 0) {
      console.log('✅ All duplicates successfully removed!');
    } else {
      console.log('❌ Some duplicates still remain:');
      remainingDuplicates.rows.forEach(row => {
        console.log(`   Project ${row.project_id}, Phase ${row.phase_number}: ${row.remaining_count} duplicates`);
      });
    }
    
    // Show final phase count per project
    console.log('\n📊 Final phase count per project:');
    const finalCountQuery = `
      SELECT 
          project_id,
          COUNT(*) as total_phases,
          STRING_AGG(phase_number::text, ', ' ORDER BY phase_number) as phase_numbers
      FROM project_phases 
      GROUP BY project_id
      ORDER BY project_id;
    `;
    
    const finalCount = await pool.query(finalCountQuery);
    finalCount.rows.forEach(row => {
      console.log(`   Project ${row.project_id}: ${row.total_phases} phases (${row.phase_numbers})`);
    });
    
  } catch (error) {
    console.error('❌ Error cleaning up duplicate phases:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanupDuplicatePhases();
