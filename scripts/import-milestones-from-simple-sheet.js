/*
  Import milestones and subtasks from a simple Excel sheet.
  Expected columns (first sheet):
    A: Project name
    B: Segment (academic | parastals | private)
    C: Milestone name/description
    D: Milestone start date (any parseable date string)
    E: Milestone end date (any parseable date string)
    F: Subtasks list – one per line or numbered (e.g., "1. Task name (8th September - 19th September 2025)")

  Usage:
    node scripts/import-milestones-from-simple-sheet.js path/to/file.xlsx --manager user@example.com --phase 6 --phaseName "Transition & Closure"

  Notes:
    - If --manager is omitted, the first user in the DB is used as manager/creator.
    - Defaults to Phase 6 (Transition & Closure) for milestone placement.
*/

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, and, sql } = require('drizzle-orm');
const { pgTable, varchar, text, timestamp, integer, decimal, boolean } = require('drizzle-orm/pg-core');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  console.error('Missing dependency: xlsx. Install with: npm i xlsx');
  process.exit(1);
}

// Inline minimal schema
const users = pgTable('users', {
  id: varchar('id').primaryKey(),
  email: varchar('email'),
  firstName: varchar('first_name'),
  lastName: varchar('last_name'),
});

const projects = pgTable('projects', {
  id: varchar('id').primaryKey(),
  name: varchar('name'),
  description: text('description'),
  client: varchar('client'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  status: varchar('status'),
  segment: varchar('segment'),
  budget: decimal('budget'),
  teamId: varchar('team_id'),
  managerId: varchar('manager_id'),
  progress: integer('progress'),
});

const milestones = pgTable('milestones', {
  id: varchar('id').primaryKey(),
  name: varchar('name'),
  description: text('description'),
  priority: varchar('priority'),
  feeAmount: decimal('fee_amount'),
  billingStatus: varchar('billing_status'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  expectedInvoiceDate: timestamp('expected_invoice_date'),
  expectedCollectionDate: timestamp('expected_collection_date'),
  projectId: varchar('project_id'),
  createdById: varchar('created_by_id'),
});

const modules = pgTable('modules', {
  id: varchar('id').primaryKey(),
  name: varchar('name'),
  description: text('description'),
  priority: varchar('priority'),
  status: text('status'),
  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
  projectId: varchar('project_id'),
  phaseNumber: integer('phase_number'),
  phaseName: varchar('phase_name'),
  assignedUserId: varchar('assigned_user_id'),
  createdById: varchar('created_by_id'),
  progressPercent: integer('progress_percent'),
});

const subtasks = pgTable('subtasks', {
  id: varchar('id').primaryKey(),
  name: varchar('name'),
  description: text('description'),
  status: text('status'),
  priority: varchar('priority'),
  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
  moduleId: varchar('module_id'),
  milestoneId: varchar('milestone_id'),
  assignedUserId: varchar('assigned_user_id'),
  createdById: varchar('created_by_id'),
  progressPercent: integer('progress_percent'),
});

// DB connection
let connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskflow';
try {
  const u = new URL(connectionString);
  if (u.searchParams.has('schema')) u.searchParams.delete('schema');
  connectionString = u.toString();
} catch {}
const client = postgres(connectionString);
const db = drizzle(client);

// Helpers
function normalizeSegment(seg) {
  if (!seg) return 'private';
  const s = String(seg).toLowerCase().trim();
  if (['academic', 'parastals', 'private'].includes(s)) return s;
  if (s.startsWith('acad')) return 'academic';
  if (s.startsWith('para')) return 'parastals';
  return 'private';
}

function stripOrdinals(str) {
  return String(str).replace(/(\d+)(st|nd|rd|th)/gi, '$1');
}

function parseMaybeDate(str, fallbackYear) {
  if (!str) return undefined;
  let s = stripOrdinals(str).replace(/–/g, '-');
  // If month-day without year, add fallback year
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s) && !/\b\d{4}\b/.test(s) && fallbackYear) {
    s = s + ` ${fallbackYear}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function extractSubtasks(text, milestoneStart, milestoneEnd) {
  if (!text) return [];
  const lines = String(text).split(/\r?\n|\s*\d+\.\s*/).map(l => l.trim()).filter(Boolean);
  const fallbackYear = (milestoneEnd || milestoneStart || new Date()).getFullYear();
  const items = [];
  for (const line of lines) {
    // Extract dates inside parentheses: (start - end)
    const m = line.match(/\((.*?)\)/);
    let name = line;
    let start, end;
    if (m) {
      name = line.replace(m[0], '').trim().replace(/[–-]\s*$/,'');
      const range = m[1].split(/-|to|–/);
      if (range.length >= 1) start = parseMaybeDate(range[0], fallbackYear);
      if (range.length >= 2) end = parseMaybeDate(range[1], fallbackYear);
      if (!end && start && milestoneEnd && start > milestoneEnd) end = milestoneEnd;
    }
    items.push({ name: name || 'Subtask', startDate: start || milestoneStart, dueDate: end || milestoneEnd });
  }
  return items;
}

async function getOrCreateManager(managerEmail) {
  if (managerEmail) {
    const rows = await db.select().from(users).where(eq(users.email, managerEmail));
    if (rows.length > 0) return rows[0];
  }
  const any = await db.select().from(users).limit(1);
  if (any.length === 0) throw new Error('No users found to assign as manager/creator');
  return any[0];
}

async function getOrCreateProject(name, segment, managerId, startDate, endDate) {
  const existing = await db.select().from(projects).where(eq(projects.name, name));
  if (existing.length > 0) {
    const p = existing[0];
    // Optionally widen the project date range
    const newStart = p.startDate && startDate ? (p.startDate < startDate ? p.startDate : startDate) : (p.startDate || startDate);
    const newEnd = p.endDate && endDate ? (p.endDate > endDate ? p.endDate : endDate) : (p.endDate || endDate);
    if ((newStart && !p.startDate) || (newEnd && !p.endDate) || (newStart && p.startDate && newStart.getTime() !== p.startDate.getTime()) || (newEnd && p.endDate && newEnd.getTime() !== p.endDate.getTime())) {
      const [updated] = await db.update(projects)
        .set({ startDate: newStart || p.startDate, endDate: newEnd || p.endDate })
        .where(eq(projects.id, p.id))
        .returning();
      return updated;
    }
    return p;
  }
  const start = startDate || new Date();
  const end = endDate || start;
  const [created] = await db.insert(projects).values({
    name,
    description: name,
    client: name,
    startDate: start,
    endDate: end,
    status: 'planning',
    segment: normalizeSegment(segment),
    budget: '0',
    managerId,
    progress: 0,
  }).returning();
  return created;
}

async function run() {
  try {
    const [,, filePathArg, ...rest] = process.argv;
    if (!filePathArg) {
      console.error('Usage: node scripts/import-milestones-from-simple-sheet.js <xlsx-path> [--manager user@example.com] [--phase 6] [--phaseName "Transition & Closure"]');
      process.exit(1);
    }
    const resolvedPath = path.isAbsolute(filePathArg)
      ? filePathArg
      : path.resolve(process.cwd(), filePathArg);

    if (!fs.existsSync(resolvedPath)) {
      console.error(
        `File not found: ${resolvedPath}\n` +
        'Tips:\n' +
        '- Ensure the path is correct and the file exists.\n' +
        '- If the path contains spaces or parentheses, wrap it in quotes.\n' +
        '  Example (PowerShell):\n' +
        '  node scripts/import-milestones-from-simple-sheet.js "C:\\Users\\USERR\\PythonProject\\TaskFlowapp\\abony(1).xlsx"\n'
      );
      process.exit(1);
    }
    const args = new Map();
    for (let i = 0; i < rest.length; i += 2) {
      const k = rest[i];
      const v = rest[i+1];
      if (k && v) args.set(k.replace(/^--/, ''), v);
    }
    const managerEmail = args.get('manager') || process.env.IMPORT_MANAGER_EMAIL;
    const defaultPhaseNumber = Number(args.get('phase') || 6);
    const defaultPhaseName = args.get('phaseName') || 'Transition & Closure';
    const projectNameOverride = args.get('projectName') || 'abony 2';

    const manager = await getOrCreateManager(managerEmail);

    console.log(`Reading file: ${resolvedPath}`);
    const wb = XLSX.readFile(resolvedPath);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    let imported = 0;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const [projectNameCell, segment, milestoneName, startStr, endStr, subtaskBlob] = row;
      if ((!projectNameCell && !projectNameOverride) || !milestoneName) continue;

      const effectiveProjectName = String(projectNameOverride || projectNameCell || '').trim();
      if (!effectiveProjectName) continue;

      // Milestone (upsert by project + milestone name)
      const mStart = parseMaybeDate(startStr);
      const mEnd = parseMaybeDate(endStr, (mStart || new Date()).getFullYear());

      const project = await getOrCreateProject(effectiveProjectName, segment, manager.id, mStart, mEnd);
      const existingMs = await db
        .select()
        .from(milestones)
        .where(and(
          eq(milestones.projectId, project.id),
          eq(milestones.name, String(milestoneName).trim())
        ));

      let createdMilestone = existingMs[0];
      if (createdMilestone) {
        const [updated] = await db.update(milestones)
          .set({
            startDate: mStart || createdMilestone.startDate || null,
            endDate: mEnd || createdMilestone.endDate || null,
            phaseNumber: defaultPhaseNumber,
            phaseName: defaultPhaseName,
          })
          .where(eq(milestones.id, createdMilestone.id))
          .returning();
        createdMilestone = updated;
      } else {
        const [inserted] = await db.insert(milestones).values({
          name: String(milestoneName).trim(),
          description: String(milestoneName).trim(),
          priority: 'medium',
          billingStatus: 'none',
          startDate: mStart || null,
          endDate: mEnd || null,
          phaseNumber: defaultPhaseNumber,
          phaseName: defaultPhaseName,
          expectedInvoiceDate: null,
          expectedCollectionDate: null,
          projectId: project.id,
          createdById: manager.id,
        }).returning();
        createdMilestone = inserted;
      }

      // For phase 3 we create modules and attach subtasks to modules.
      // For other phases (incl. Phase 6), we attach subtasks directly to the milestone (no modules).
      const subtasksList = extractSubtasks(subtaskBlob, mStart, mEnd);

      if (defaultPhaseNumber === 3) {
        const [createdModule] = await db.insert(modules).values({
          name: String(milestoneName).trim(),
          description: String(milestoneName).trim(),
          priority: 'medium',
          status: 'todo',
          startDate: mStart || null,
          dueDate: mEnd || null,
          projectId: project.id,
          phaseNumber: defaultPhaseNumber,
          phaseName: defaultPhaseName,
          milestoneId: createdMilestone.id,
          assignedUserId: null,
          createdById: manager.id,
          progressPercent: 0,
        }).returning();

        for (const st of subtasksList) {
          await db.insert(subtasks).values({
            name: st.name,
            description: st.name,
            status: 'not_started',
            priority: 'medium',
            startDate: st.startDate || null,
            dueDate: st.dueDate || null,
            moduleId: createdModule.id,
            milestoneId: createdMilestone.id,
            assignedUserId: null,
            createdById: manager.id,
            progressPercent: 0,
          });
        }
      } else {
        for (const st of subtasksList) {
          const dup = await db.select().from(subtasks).where(and(
            eq(subtasks.milestoneId, createdMilestone.id),
            eq(subtasks.name, st.name)
          ));
          if (dup.length) continue;
          await db.insert(subtasks).values({
            name: st.name,
            description: st.name,
            status: 'not_started',
            priority: 'medium',
            startDate: st.startDate || null,
            dueDate: st.dueDate || null,
            milestoneId: createdMilestone.id,
            moduleId: null,
            assignedUserId: null,
            createdById: manager.id,
            progressPercent: 0,
          });
        }
      }

      imported++;
      console.log(`Imported row ${r + 1}: Project=${project.name}, Phase=${defaultPhaseNumber}, Milestone=${milestoneName}, Subtasks=${subtasksList.length}`);
    }

    console.log(`\nDone. Imported ${imported} record(s).`);
  } catch (err) {
    console.error('Import failed:', err?.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
