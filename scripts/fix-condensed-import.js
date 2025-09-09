const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
require('dotenv').config();

function stripSchema(url) { return url?.replace(/\?schema=.*/, ''); }
function parseYearArg() {
  const yearFlag = process.argv.find(a => a.startsWith('--year='));
  const parsed = yearFlag ? parseInt(yearFlag.split('=')[1], 10) : undefined;
  return (parsed && parsed > 2000 && parsed < 2100) ? parsed : new Date().getFullYear();
}
function parseDryRun() { return process.argv.includes('--dry-run'); }
function normalizeKey(s) { return (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, ''); }
function deriveKeysFromTeamName(name) {
  const keys = new Set();
  if (!name) return Array.from(keys);
  const raw = String(name).trim();
  const tokens = raw.split(/[^A-Za-z0-9]+/).filter(Boolean);
  for (const tok of tokens) keys.add(normalizeKey(tok));
  if (tokens.length >= 2 && /^team$/i.test(tokens[0])) keys.add(normalizeKey(tokens.slice(1).join('')));
  return Array.from(keys);
}
function inferPhaseFromText(text) {
  const t = (text || '').toLowerCase();
  if (/(kick\s*-?off|setup|initiate|project setup|planning)/i.test(t)) return { number: 1, name: 'Initiation & Setup', phase: 'initiation_contracting' };
  if (/(requirement|design|spec|roadmap|plan\b)/i.test(t)) return { number: 2, name: 'Requirements & Design', phase: 'requirements_design' };
  if (/(module|develop|config|build|implementation)/i.test(t)) return { number: 3, name: 'Implementation', phase: 'implementation' };
  if (/(test|uat|validation|qa)/i.test(t)) return { number: 4, name: 'Testing & UAT', phase: 'testing_uat' };
  if (/(go[- ]?live|deploy|rollout)/i.test(t)) return { number: 5, name: 'Go Live', phase: 'go_live' };
  if (/(sign ?off|closure|handover|finalize|close)/i.test(t)) return { number: 6, name: 'Closure & Signoff', phase: 'closure' };
  return null; // unknown
}
function extractModuleNamesFromTarget(target) {
  if (!target) return [];
  const listMatch = target.match(/([A-Za-z0-9\s,&]+)\s+modules?/i);
  if (listMatch) {
    const before = listMatch[1];
    return before.split(/,|&|and/).map(s => s.trim()).filter(Boolean).map(s => s.replace(/\bmodules?\b/i, '').trim()).filter(Boolean);
  }
  return [];
}

async function main() {
  const dryRun = parseDryRun();
  const defaultYear = parseYearArg();
  const connectionString = stripSchema(process.env.DATABASE_URL) || 'postgresql://postgres:password@localhost:5432/taskflow';
  const pool = new Pool({ connectionString });

  const excelPathArg = process.argv.find(a => a.endsWith('.xlsx'));
  const excelPath = excelPathArg || path.resolve(process.cwd(), 'Condensed_Project_Subtasks(1).xlsx');
  if (!fs.existsSync(excelPath)) { console.error(`Excel file not found: ${excelPath}`); process.exit(1); }

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const header = rows[0] || [];
  const col = (name) => header.findIndex(h => String(h || '').toLowerCase().includes(name));
  const idxProject = col('project');
  const idxTarget = col('target');

  if ([idxProject, idxTarget].some(i => i < 0)) { console.error('Missing required columns in sheet'); process.exit(1); }

  const client = await pool.connect();
  try {
    const q = await client.query(`SELECT p.id, p.name, p.segment, t.name AS team_name FROM projects p LEFT JOIN teams t ON p.team_id = t.id`);
    const keyToProject = new Map();
    for (const r of q.rows) {
      if (!r.team_name) continue;
      for (const k of deriveKeysFromTeamName(r.team_name)) if (!keyToProject.has(k)) keyToProject.set(k, r);
    }

    const report = { milestonesChecked: 0, placeholdersReattached: 0, modulesPhaseUpdated: 0 };

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const projKey = normalizeKey((r[idxProject] || '').toString().trim());
      const target = (r[idxTarget] || '').toString().trim();
      if (!projKey || !target) continue;

      let project = keyToProject.get(projKey);
      if (!project) {
        for (const [k, val] of keyToProject.entries()) { if (k.includes(projKey) || projKey.includes(k)) { project = val; break; } }
      }
      if (!project) continue;

      // Find the milestone
      const { rows: ms } = await client.query(`SELECT id, name FROM milestones WHERE project_id = $1 AND name = $2 LIMIT 1`, [project.id, target]);
      if (ms.length === 0) continue;
      const milestone = ms[0];
      report.milestonesChecked++;

      const phase = inferPhaseFromText(target);
      const phaseUpdates = phase ? [phase.number, phase.name, phase.phase] : [null, null, null];

      // Reattach placeholder module if detached, and update phase
      const placeholderName = `${target} - General`;
      const { rows: phMods } = await client.query(
        `SELECT id, name, milestone_id, phase_number FROM modules WHERE project_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
        [project.id, placeholderName]
      );
      if (phMods.length > 0) {
        const ph = phMods[0];
        if (dryRun) {
          if (ph.milestone_id !== milestone.id) report.placeholdersReattached++;
          report.modulesPhaseUpdated++;
        } else {
          await client.query(
            `UPDATE modules SET milestone_id = $2, phase_number = COALESCE($3, phase_number), phase_name = COALESCE($4, phase_name), phase = COALESCE($5, phase), updated_at = NOW() WHERE id = $1`,
            [ph.id, milestone.id, ...phaseUpdates]
          );
          if (ph.milestone_id !== milestone.id) report.placeholdersReattached++;
          report.modulesPhaseUpdated++;
        }
      }

      // Update phase for all modules under this milestone (real modules too)
      if (phase) {
        if (dryRun) {
          report.modulesPhaseUpdated++;
        } else {
          await client.query(
            `UPDATE modules SET phase_number = $3, phase_name = $4, phase = $5, updated_at = NOW() WHERE project_id = $1 AND milestone_id = $2`,
            [project.id, milestone.id, ...phaseUpdates]
          );
          report.modulesPhaseUpdated++;
        }
      }
    }

    console.log(report);
  } catch (e) {
    console.error('Fix script failed:', e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) { main(); }
