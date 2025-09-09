const { Pool } = require('pg');
require('dotenv').config();

function stripSchema(url) {
  return url?.replace(/\?schema=.*/, '');
}

function inferPhaseFromText(text) {
  const t = (text || '').toLowerCase();
  if (/(sign\s*-?offs?|sign ?off|closure|to close|close the process|handover|schedule .*sign-?off|separate module sign-?offs?)/i.test(t)) {
    return { number: 6, name: 'Support & Closure' };
  }
  if (/(go[- ]?live|deploy|roll\s*out|rollout|production .*deploy)/i.test(t)) {
    return { number: 5, name: 'Deployment & Go-Live' };
  }
  if (/(test|uat|validation|qa)/i.test(t)) {
    return { number: 4, name: 'Testing & QA' };
  }
  if (/(module|develop|config|build|implementation|mrp)/i.test(t)) {
    return { number: 3, name: 'Development' };
  }
  if (/(requirement|design|spec|tor|roadmap|\bplan\b)/i.test(t)) {
    return { number: 2, name: 'Planning & Design' };
  }
  if (/(kick\s*-?off|setup|initiate|jumpstart|project setup|planning)/i.test(t)) {
    return { number: 1, name: 'Initiation & Contracting' };
  }
  return null;
}

async function normalize() {
  const connectionString = stripSchema(process.env.DATABASE_URL) || 'postgresql://postgres:password@localhost:5432/taskflow';
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  const report = { milestonesScanned: 0, modulesRenamed: 0, modulesRephased: 0, milestoneLinksFixed: 0 };
  const perProject = new Map();
  try {
    // fetch milestones and their project for logging
    const { rows: milestones } = await client.query(
      `SELECT m.id, m.name, m.project_id, p.name AS project_name
       FROM milestones m
       JOIN projects p ON p.id = m.project_id
       ORDER BY p.name, m.created_at`
    );

    for (const m of milestones) {
      report.milestonesScanned++;
      // ensure per-project bucket
      if (!perProject.has(m.project_id)) {
        perProject.set(m.project_id, {
          projectName: m.project_name,
          milestonesScanned: 0,
          modulesRenamed: 0,
          modulesRephased: 0,
          milestoneLinksFixed: 0,
        });
      }

      const proj = perProject.get(m.project_id);
      proj.milestonesScanned++;

      const phase = inferPhaseFromText(m.name);
      if (!phase) continue; // skip if unknown

      // rename '<name> - General' -> '<name>' (avoid concatenation on params for clear typing)
      const placeholder = `${m.name} - General`;
      const { rowCount: rn } = await client.query(
        `UPDATE modules SET name = $3, updated_at = NOW()
         WHERE project_id = $1 AND milestone_id = $2 AND LOWER(name) = LOWER($4)`,
        [m.project_id, m.id, m.name, placeholder]
      );
      report.modulesRenamed += rn;
      proj.modulesRenamed += rn;

      // ensure modules under this milestone (including ones without milestone_id but matching name) are linked
      const { rowCount: lk1 } = await client.query(
        `UPDATE modules SET milestone_id = $3, updated_at = NOW()
         WHERE project_id = $1 AND (milestone_id IS NULL) AND LOWER(name) = LOWER($2)`,
        [m.project_id, m.name, m.id]
      );
      report.milestoneLinksFixed += lk1;
      proj.milestoneLinksFixed += lk1;

      // rephase modules under this milestone if phase != 3
      const { rowCount: rp } = await client.query(
        `UPDATE modules SET phase_number = $3, phase_name = $4, updated_at = NOW()
         WHERE project_id = $1 AND milestone_id = $2 AND COALESCE(phase_number, 0) <> $3`,
        [m.project_id, m.id, phase.number, phase.name]
      );
      report.modulesRephased += rp;
      proj.modulesRephased += rp;
    }

    console.log('\n=== Normalize summary (all projects) ===');
    console.log(report);
    console.log('\n=== Per project summary ===');
    for (const [, stats] of perProject) {
      console.log(`• ${stats.projectName}: milestones=${stats.milestonesScanned}, renamed=${stats.modulesRenamed}, linked=${stats.milestoneLinksFixed}, rephased=${stats.modulesRephased}`);
    }
  } catch (e) {
    console.error('Normalize failed:', e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  normalize();
}

module.exports = { normalize };


