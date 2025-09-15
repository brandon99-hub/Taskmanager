const { Pool } = require('pg');
require('dotenv').config();

async function updateProjectBudgets() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== UPDATING PROJECT BUDGETS ===');
    
    // First, let's see how many projects have budget 1000
    const { rows: projectsWith1000 } = await client.query(
      'SELECT id, name, budget FROM projects WHERE budget = $1',
      ['1000']
    );
    
    console.log(`Found ${projectsWith1000.length} projects with budget 1000:`);
    projectsWith1000.forEach(project => {
      console.log(`- ${project.name} (ID: ${project.id}) - Budget: ${project.budget}`);
    });

    if (projectsWith1000.length > 0) {
      // Update all projects with budget 1000 to 0
      const { rows: updatedProjects } = await client.query(
        'UPDATE projects SET budget = $1 WHERE budget = $2 RETURNING id, name, budget',
        ['0', '1000']
      );

      console.log(`\n✅ Successfully updated ${updatedProjects.length} projects:`);
      updatedProjects.forEach(project => {
        console.log(`- ${project.name} (ID: ${project.id}) - New Budget: ${project.budget}`);
      });
    } else {
      console.log('No projects found with budget 1000');
    }

    // Now let's recalculate budgets for all projects based on milestone fees
    console.log('\n=== RECALCULATING PROJECT BUDGETS FROM MILESTONE FEES ===');
    
    const { rows: allProjects } = await client.query(
      'SELECT id, name, budget FROM projects ORDER BY name'
    );

    for (const project of allProjects) {
      // Calculate total from milestone fees
      const { rows: milestoneFees } = await client.query(
        'SELECT COALESCE(SUM(fee_amount), 0) as total_fees FROM milestones WHERE project_id = $1',
        [project.id]
      );
      
      const totalFees = milestoneFees[0]?.total_fees || 0;
      
      // Update project budget with calculated total
      await client.query(
        'UPDATE projects SET budget = $1 WHERE id = $2',
        [totalFees.toString(), project.id]
      );
      
      console.log(`- ${project.name}: ${project.budget} → ${totalFees} (from ${milestoneFees[0]?.total_fees ? 'milestone fees' : 'no milestones'})`);
    }

    await client.query('COMMIT');
    console.log('\n✅ All changes committed successfully');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating project budgets:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  updateProjectBudgets();
}
