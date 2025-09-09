const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
require('dotenv').config();

function parseYearArg() {
  const yearFlag = process.argv.find(a => a.startsWith('--year='));
  const parsed = yearFlag ? parseInt(yearFlag.split('=')[1], 10) : undefined;
  if (parsed && parsed > 2000 && parsed < 2100) return parsed;
  return new Date().getFullYear();
}

function parseDryRun() {
  return process.argv.includes('--dry-run');
}

function stripSchema(url) {
  return url?.replace(/\?schema=.*/, '');
}

function normalizeKey(s) {
  return (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function deriveKeysFromTeamName(name) {
  const keys = new Set();
  if (!name) return Array.from(keys);
  const raw = String(name).trim();
  const norm = normalizeKey(raw);
  if (norm) keys.add(norm);

  // Tokenize
  const tokens = raw.split(/[^A-Za-z0-9]+/).filter(Boolean);
  for (const tok of tokens) keys.add(normalizeKey(tok)); // each token (e.g., 'abony')

  // If starts with 'Team', drop it and add remainder variants
  if (tokens.length >= 2 && /^team$/i.test(tokens[0])) {
    const remainderTokens = tokens.slice(1);
    keys.add(normalizeKey(remainderTokens.join(''))); // e.g., 'abony'
    keys.add(normalizeKey(remainderTokens[remainderTokens.length - 1])); // last token strong signal
    if (remainderTokens.length >= 2) keys.add(normalizeKey(remainderTokens[0] + remainderTokens[1]));
    const initials = remainderTokens.map(t => t[0]).join('');
    if (initials.length >= 2) keys.add(normalizeKey(initials));
  } else if (tokens.length) {
    // Without 'Team' prefix, add combined and initials too
    keys.add(normalizeKey(tokens.join('')));
    if (tokens.length >= 2) keys.add(normalizeKey(tokens[0] + tokens[1]));
    const initials = tokens.map(t => t[0]).join('');
    if (initials.length >= 2) keys.add(normalizeKey(initials));
  }

  // Uppercase acronym present
  const uppers = raw.replace(/[^A-Z]/g, '');
  if (uppers.length >= 2) keys.add(normalizeKey(uppers));
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
    if (monthIdx >= 0) {
      return new Date(fallbackYear, monthIdx, day);
    }
  }
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
}

function inferPhaseFromText(text) {
  const t = (text || '').toLowerCase();
  // Phase 6 first: signoffs/closure dominate even if 'module' appears
  if (/(sign\s*-?offs?|sign ?off|closure|to close|close the process|handover|schedule .*sign-?off|separate module sign-?offs?)/i.test(t)) {
    return { number: 6, name: 'Closure & Signoff', phase: 'closure' };
  }
  if (/(go[- ]?live|deploy|roll\s*out|rollout|production .*deploy)/i.test(t)) {
    return { number: 5, name: 'Go Live', phase: 'go_live' };
  }
  if (/(test|uat|validation|qa)/i.test(t)) {
    return { number: 4, name: 'Testing & UAT', phase: 'testing_uat' };
  }
  if (/(module|develop|config|build|implementation|mrp)/i.test(t)) {
    return { number: 3, name: 'Implementation', phase: 'implementation' };
  }
  if (/(requirement|design|spec|tor|roadmap|\bplan\b)/i.test(t)) {
    return { number: 2, name: 'Requirements & Design', phase: 'requirements_design' };
  }
  if (/(kick\s*-?off|setup|initiate|jumpstart|project setup|planning)/i.test(t)) {
    return { number: 1, name: 'Initiation & Setup', phase: 'initiation_contracting' };
  }
  // Unknown -> leave unset; do not fall back to Phase 3
  return null;
}

function extractModuleNamesFromTarget(target) {
  if (!target) return [];
  const t = target.toLowerCase();
  if (t.includes('module')) {
    const listMatch = target.match(/([A-Za-z0-9\s,&]+)\s+modules?/i);
    if (listMatch) {
      const before = listMatch[1];
      return before
        .split(/,|&|and/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => s.replace(/\bmodules?\b/i, '').trim())
        .filter(Boolean)
        .map(s => s.charAt(0).toUpperCase() + s.slice(1));
    }
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
  if (!fs.existsSync(excelPath)) {
    console.error(`Excel file not found: ${excelPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const header = rows[0] || [];
  const col = (name) => header.findIndex(h => String(h || '').toLowerCase().includes(name));
  const idxProject = col('project');
  const idxCategory = col('category');
  const idxTarget = col('target');
  const idxEndDate = col('end');
  const idxSubtasks = col('subtask');

  if ([idxProject, idxCategory, idxTarget, idxEndDate, idxSubtasks].some(i => i < 0)) {
    console.error('Missing expected columns. Found header:', header);
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const q = await client.query(`SELECT p.id, p.name, p.segment, t.name AS team_name FROM projects p LEFT JOIN teams t ON p.team_id = t.id`);
    const keyToProject = new Map();
    for (const r of q.rows) {
      if (!r.team_name) continue; // use team names only as requested
      for (const k of deriveKeysFromTeamName(r.team_name)) {
        if (!keyToProject.has(k)) keyToProject.set(k, r);
      }
    }

    const admin = await client.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    const createdById = admin.rows[0]?.id || (await client.query(`SELECT id FROM users LIMIT 1`)).rows[0]?.id;
    if (!createdById) throw new Error('No user found to set as createdById');

    const results = { milestonesUpserted: 0, modulesUpserted: 0, subtasksUpserted: 0, skipped: 0, errors: 0 };

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const projRaw = (r[idxProject] || '').toString().trim();
      const projKey = normalizeKey(projRaw);
      const category = (r[idxCategory] || '').toString().trim().toLowerCase();
      const target = (r[idxTarget] || '').toString().trim();
      const endDateStr = r[idxEndDate];
      const subtasksCell = r[idxSubtasks];

      if (!projKey || !target) { results.skipped++; continue; }
      let project = keyToProject.get(projKey);
      if (!project) {
        for (const [k, val] of keyToProject.entries()) {
          if (k.includes(projKey) || projKey.includes(k)) { project = val; break; }
        }
      }
      if (!project) { console.warn(`Row ${i+1}: Unknown team acronym '${projRaw}'`); results.skipped++; continue; }
      if (category && project.segment && category !== project.segment) {
        console.warn(`Row ${i+1}: Segment mismatch for '${projRaw}' (file=${category}, db=${project.segment})`);
      }

      const milestoneName = target;
      const milestoneEnd = parseEndDate(endDateStr, defaultYear);
      const phaseInfo = inferPhaseFromText(target);

      let milestone;
      if (dryRun) {
        milestone = { id: 'dry-run-milestone', project_id: project.id, name: milestoneName };
        results.milestonesUpserted++;
      } else {
        const { rows: m1 } = await client.query(
          `SELECT * FROM milestones WHERE project_id = $1 AND name = $2 LIMIT 1`,
          [project.id, milestoneName]
        );
        if (m1.length > 0) {
          const { rows: m2 } = await client.query(
            `UPDATE milestones SET end_date = COALESCE($3, end_date), updated_at = NOW() WHERE id = $1 RETURNING *`,
            [m1[0].id, project.id, milestoneEnd]
          );
          milestone = m2[0];
        } else {
          const { rows: m3 } = await client.query(
            `INSERT INTO milestones (name, project_id, created_by_id, end_date) VALUES ($1, $2, $3, $4) RETURNING *`,
            [milestoneName, project.id, createdById, milestoneEnd]
          );
          milestone = m3[0];
        }
        results.milestonesUpserted++;
      }

      const moduleNames = extractModuleNamesFromTarget(target);
      const subtasksList = splitSubtasksCell(subtasksCell);

      const ensureModule = async (moduleName) => {
        if (dryRun) {
          results.modulesUpserted++;
          return { id: `dry-${moduleName}` };
        }
        const { rows: q1 } = await client.query(
          `SELECT * FROM modules WHERE project_id = $1 AND milestone_id = $2 AND name = $3 LIMIT 1`,
          [project.id, milestone.id, moduleName]
        );
        if (q1.length > 0) {
          const { rows: q2 } = await client.query(
            `UPDATE modules SET phase_number = COALESCE($2, phase_number), phase_name = COALESCE($3, phase_name), phase = COALESCE($4, phase), updated_at = NOW() WHERE id = $1 RETURNING *`,
            [q1[0].id, phaseInfo?.number || null, phaseInfo?.name || null, phaseInfo?.phase || null]
          );
          results.modulesUpserted++;
          return q2[0];
        }
        const { rows: ins } = await client.query(
          `INSERT INTO modules (name, project_id, milestone_id, created_by_id, phase_number, phase_name, phase) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [moduleName, project.id, milestone.id, createdById, phaseInfo?.number || null, phaseInfo?.name || null, phaseInfo?.phase || null]
        );
        results.modulesUpserted++;
        return ins[0];
      };

      const attachSubtasksToModule = async (moduleId) => {
        for (const s of subtasksList) {
          if (!s) continue;
          if (dryRun) { results.subtasksUpserted++; continue; }
          const { rows: t1 } = await client.query(
            `SELECT id FROM subtasks WHERE module_id = $1 AND name = $2 LIMIT 1`,
            [moduleId, s]
          );
          if (t1.length > 0) continue;
          await client.query(
            `INSERT INTO subtasks (name, module_id, created_by_id, due_date, status) VALUES ($1, $2, $3, $4, 'not_started')`,
            [s, moduleId, createdById, milestoneEnd]
          );
          results.subtasksUpserted++;
        }
      };

      const attachSubtasksToMilestone = async (milestoneId) => {
        for (const s of subtasksList) {
          if (!s) continue;
          if (dryRun) { results.subtasksUpserted++; continue; }
          const { rows: t1 } = await client.query(
            `SELECT id FROM subtasks WHERE milestone_id = $1 AND name = $2 LIMIT 1`,
            [milestoneId, s]
          );
          if (t1.length > 0) continue;
          await client.query(
            `INSERT INTO subtasks (name, milestone_id, created_by_id, due_date, status) VALUES ($1, $2, $3, $4, 'not_started')`,
            [s, milestoneId, createdById, milestoneEnd]
          );
          results.subtasksUpserted++;
        }
      };

      const isPhase3 = phaseInfo?.number === 3;
      if (isPhase3 && moduleNames.length > 0) {
        // True Phase 3 with explicit modules
        for (const mn of moduleNames) {
          const mod = await ensureModule(mn);
          await attachSubtasksToModule(mod.id);
        }
      } else if (isPhase3 && subtasksList.length > 0) {
        // Phase 3 without explicit modules → use placeholder module
        const syntheticName = `${milestoneName} - General`;
        const mod = await ensureModule(syntheticName);
        await attachSubtasksToModule(mod.id);
      } else if (!isPhase3 && subtasksList.length > 0) {
        // Non-Phase 3 → attach subtasks directly to milestone
        await attachSubtasksToMilestone(milestone.id);
      }
    }

    console.log({ ...results, file: path.basename(excelPath), dryRun, defaultYear });
  } catch (err) {
    console.error('Import failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
