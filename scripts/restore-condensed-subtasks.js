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
function parseEndDate(str, fallbackYear) {
  if (!str) return null;
  const clean = String(str).trim();
  const dayMatch = clean.match(/^(\d{1,2})\w*/i);
  const monthMatch = clean.match(/(january|february|march|april|may|june|july|august|september|october|november|december)/i);
  if (dayMatch && monthMatch) {
    const day = parseInt(dayMatch[1], 10);
    const monthName = monthMatch[1].toLowerCase();
    const monthIdx = [
      'january','february','march','april','may','june','july','august','september','october','november','december'
    ].indexOf(monthName);
    if (monthIdx >= 0) return new Date(fallbackYear, monthIdx, day);
  }
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
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
function splitSubtasksCell(cell) {
  if (!cell) return [];
  const text = String(cell).replace(/\r/g, '\n');
  const parts = text.split(/\n|\r/).map(s => s.trim()).filter(Boolean);
  const items = [];
  for (const p of parts) {
    const m = p.match(/^\d+\.\s*(.*)$/);
    items.push((m ? m[1] : p).trim());
  }
  return items.filter(Boolean);
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
  const idxEndDate = col('end');
  const idxSubtasks = col('subtask');

  if ([idxProject, idxTarget, idxEndDate, idxSubtasks].some(i => i < 0)) { console.error('Missing required columns in sheet'); process.exit(1); }

  const client = await pool.connect();
  try {
    const q = await client.query(`SELECT p.id, p.name, p.segment, t.name AS team_name FROM projects p LEFT JOIN teams t ON p.team_id = t.id`);
    const keyToProject = new Map();
    for (const r of q.rows) {
      if (!r.team_name) continue;
      for (const k of deriveKeysFromTeamName(r.team_name)) if (!keyToProject.has(k)) keyToProject.set(k, r);
    }

    // Resolve creator
    const admin = await client.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    const createdById = admin.rows[0]?.id || (await client.query(`SELECT id FROM users LIMIT 1`)).rows[0]?.id;
    if (!createdById) throw new Error('No user found to set as createdById');

    const report = { milestonesMatched: 0, modulesEnsured: 0, subtasksRestored: 0 };

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const projKey = normalizeKey((r[idxProject] || '').toString().trim());
      const target = (r[idxTarget] || '').toString().trim();
      const endDateStr = r[idxEndDate];
      const subtasksCell = r[idxSubtasks];
      if (!projKey || !target) continue;

      let project = keyToProject.get(projKey);
      if (!project) {
        for (const [k, val] of keyToProject.entries()) { if (k.includes(projKey) || projKey.includes(k)) { project = val; break; } }
      }
      if (!project) continue;

      const { rows: ms } = await client.query(`SELECT id, name, end_date FROM milestones WHERE project_id = $1 AND name = $2 LIMIT 1`, [project.id, target]);
      if (ms.length === 0) continue;
      const milestone = ms[0];
      report.milestonesMatched++;

      const dueDate = parseEndDate(endDateStr, defaultYear) || milestone.end_date || null;
      const moduleNames = extractModuleNamesFromTarget(target);

      const ensureModule = async (moduleName) => {
        if (dryRun) { report.modulesEnsured++; return { id: `dry-${moduleName}` }; }
        const { rows: mm } = await client.query(`SELECT id FROM modules WHERE project_id = $1 AND milestone_id = $2 AND name = $3 LIMIT 1`, [project.id, milestone.id, moduleName]);
        if (mm.length > 0) return { id: mm[0].id };
        const { rows: ins } = await client.query(`INSERT INTO modules (name, project_id, milestone_id, created_by_id) VALUES ($1, $2, $3, $4) RETURNING id`, [moduleName, project.id, milestone.id, createdById]);
        report.modulesEnsured++;
        return { id: ins[0].id };
      };

      const restoreSubtasksToModule = async (moduleId, subtasksList) => {
        for (const s of subtasksList) {
          if (!s) continue;
          if (dryRun) { report.subtasksRestored++; continue; }
          const { rows: ex } = await client.query(`SELECT id FROM subtasks WHERE module_id = $1 AND name = $2 LIMIT 1`, [moduleId, s]);
          if (ex.length > 0) continue;
          await client.query(`INSERT INTO subtasks (name, module_id, created_by_id, due_date, status) VALUES ($1, $2, $3, $4, 'not_started')`, [s, moduleId, createdById, dueDate]);
          report.subtasksRestored++;
        }
      };

      const subtasksList = splitSubtasksCell(subtasksCell);
      if (moduleNames.length > 0) {
        // Attach the same subtasks to each declared module name
        for (const mn of moduleNames) {
          const mod = await ensureModule(mn);
          await restoreSubtasksToModule(mod.id, subtasksList);
        }
      } else {
        const mod = await ensureModule(`${target} - General`);
        await restoreSubtasksToModule(mod.id, subtasksList);
      }
    }

    console.log(report);
  } catch (e) {
    console.error('Restore failed:', e);
    process.exitCode = 1;
  } finally {
    await client.release();
    await pool.end();
  }
}

if (require.main === module) { main(); }
