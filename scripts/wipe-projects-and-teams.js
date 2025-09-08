require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  // Tables to clear in safe order (children first)
  const statements = [
    // Invoice/reporting attachments and collections
    `DELETE FROM invoice_collections`,
    `DELETE FROM invoice_reports`,
    `DELETE FROM project_attachments`,

    // Subtasks and dependencies
    `DELETE FROM subtask_dependencies`,
    `DELETE FROM subtasks`,

    // Modules and their relations
    `DELETE FROM module_milestones`,
    `DELETE FROM module_dependencies`,
    `DELETE FROM modules`,

    // Milestones and phases
    `DELETE FROM milestones`,
    `DELETE FROM project_phases`,

    // Team membership
    `DELETE FROM team_members`,

    // Projects and teams
    `DELETE FROM projects`,
    `DELETE FROM teams`
  ];

  try {
    console.log('Starting wipe of projects/teams and related data...');
    let total = 0;
    for (const sql of statements) {
      const res = await pool.query(sql);
      total += res.rowCount || 0;
      console.log(`${sql.split(' ')[1]} -> ${res.rowCount || 0} rows`);
    }
    console.log(`Done. Rows affected: ${total}`);
  } catch (err) {
    console.error('Wipe failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
