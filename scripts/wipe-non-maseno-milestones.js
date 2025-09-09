require('dotenv').config();
const postgres = require('postgres');

(async () => {
  let cs = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskflow';
  try { const u = new URL(cs); if (u.searchParams.has('schema')) u.searchParams.delete('schema'); cs = u.toString(); } catch {}
  const sql = postgres(cs);
  try {
    console.log('Locating Maseno University ERP System project...');
    const [project] = await sql`
      SELECT id FROM projects WHERE name = 'Maseno University ERP System' LIMIT 1
    `;
    if (!project) {
      console.log('Maseno project not found; nothing to keep. Deleting all milestones...');
      const r = await sql`DELETE FROM milestones`;
      console.log(`Deleted ${r.count || r.length || 0} milestones`);
      return;
    }
    console.log(`Keeping milestones for project id: ${project.id}`);
    const res = await sql`
      DELETE FROM milestones WHERE project_id <> ${project.id}
    `;
    console.log(`Deleted ${res.count || res.length || 0} milestones (kept Maseno)`);
  } catch (e) {
    console.error('Wipe failed:', e.message || e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
})();
