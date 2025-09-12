require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const namesArg = process.argv[2];
  if (!namesArg) {
    console.error('Usage: node scripts/delete-projects-by-name.js "AU3,AU2,AU"');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const names = namesArg.split(',').map(s => s.trim()).filter(Boolean);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find project IDs by name
    const { rows: projRows } = await client.query(
      'SELECT id FROM projects WHERE name = ANY($1::text[])',
      [names]
    );
    const projectIds = projRows.map(r => r.id);
    if (projectIds.length === 0) {
      console.log('No matching projects found for names:', names.join(', '));
      await client.query('ROLLBACK');
      return;
    }
    console.log('Deleting projects with IDs:', projectIds);

    // Helper list placeholders
    const idArrayParam = '{' + projectIds.join(',') + '}';

    // Delete subtask dependencies referencing subtasks under these projects (via modules or milestones)
    await client.query(
      `DELETE FROM subtask_dependencies WHERE subtask_id IN (
         SELECT id FROM subtasks WHERE module_id IN (SELECT id FROM modules WHERE project_id = ANY($1::text[]))
           OR milestone_id IN (SELECT id FROM milestones WHERE project_id = ANY($1::text[]))
       ) OR depends_on_subtask_id IN (
         SELECT id FROM subtasks WHERE module_id IN (SELECT id FROM modules WHERE project_id = ANY($1::text[]))
           OR milestone_id IN (SELECT id FROM milestones WHERE project_id = ANY($1::text[]))
       )`,
      [projectIds]
    );

    // Delete subtasks
    await client.query(
      `DELETE FROM subtasks WHERE module_id IN (SELECT id FROM modules WHERE project_id = ANY($1::text[]))
         OR milestone_id IN (SELECT id FROM milestones WHERE project_id = ANY($1::text[]))`,
      [projectIds]
    );

    // Delete module_milestones relations
    await client.query(
      `DELETE FROM module_milestones WHERE module_id IN (SELECT id FROM modules WHERE project_id = ANY($1::text[]))
         OR milestone_id IN (SELECT id FROM milestones WHERE project_id = ANY($1::text[]))`,
      [projectIds]
    );

    // Delete module dependencies for modules under these projects (best-effort on both columns)
    try {
      await client.query(
        `DELETE FROM module_dependencies WHERE module_id IN (SELECT id FROM modules WHERE project_id = ANY($1::text[]))
           OR depends_on_module_id IN (SELECT id FROM modules WHERE project_id = ANY($1::text[]))`,
        [projectIds]
      );
    } catch (_e) {
      // If depends_on_module_id doesn't exist, delete only by module_id
      await client.query(
        `DELETE FROM module_dependencies WHERE module_id IN (SELECT id FROM modules WHERE project_id = ANY($1::text[]))`,
        [projectIds]
      );
    }

    // Delete modules
    await client.query(
      `DELETE FROM modules WHERE project_id = ANY($1::text[])`,
      [projectIds]
    );

    // Delete milestones and phases
    await client.query(
      `DELETE FROM milestones WHERE project_id = ANY($1::text[])`,
      [projectIds]
    );
    await client.query(
      `DELETE FROM project_phases WHERE project_id = ANY($1::text[])`,
      [projectIds]
    );

    // Delete attachments and invoice data scoped by project
    try { await client.query(`DELETE FROM project_attachments WHERE project_id = ANY($1::text[])`, [projectIds]); } catch (_) {}
    try { await client.query(`DELETE FROM invoice_collections WHERE project_id = ANY($1::text[])`, [projectIds]); } catch (_) {}
    try { await client.query(`DELETE FROM invoice_reports WHERE project_id = ANY($1::text[])`, [projectIds]); } catch (_) {}

    // Finally delete projects
    const delRes = await client.query(
      `DELETE FROM projects WHERE id = ANY($1::text[])`,
      [projectIds]
    );
    console.log('Projects deleted:', delRes.rowCount);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Deletion failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main();
}


