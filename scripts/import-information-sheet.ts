import 'dotenv/config';
import { readFile } from 'fs/promises';
import xlsx from 'xlsx';
import { db } from '../server/db';
import { projects, tasks, users } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Importer for the "Information" sheet structured as rows of ordinal milestones
 * and repeating [Milestone, Amount] column pairs per client (project).
 *
 * Usage:
 *  tsx scripts/import-information-sheet.ts "C:/path/ASL-Receivable Master Plan-.xlsx" --apply
 */

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.some(a => a === '--apply' || a === '-a' || a.toLowerCase() === 'apply' || a === '--APPLY');
  const filePath = argv.find(a => !a.startsWith('-'));
  if (!filePath) {
    console.error('Usage: tsx scripts/import-information-sheet.ts <file.xlsx> [--apply]');
    process.exit(1);
  }

  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets['Information'] || wb.Sheets[wb.SheetNames.find(n => n.toLowerCase().includes('info'))!];
  if (!sheet) {
    console.error('Could not find "Information" sheet. Sheets:', wb.SheetNames);
    process.exit(1);
  }

  const json = xlsx.utils.sheet_to_json<any>(sheet, { header: 1, raw: false });
  // Expect first 3 rows as headers; column groups start at some fixed offset
  // We will detect client names on header row by scanning for non-empty strings
  const headerRowIndex = 2; // 0-based (third row visually)
  const headerRow: any[] = json[headerRowIndex] || [];

  type ClientCol = { client: string; milestoneCol: number; amountCol: number };
  const clients: ClientCol[] = [];
  for (let c = 0; c < headerRow.length; c++) {
    const cell = String(headerRow[c] ?? '').trim();
    if (!cell) continue;
    // Heuristic: if next column is labeled "Amount" in a lower header row or the next row
    // We will assume pairs [Milestone, Amount]
    const nextHeader = String((json[headerRowIndex + 1] || [])[c + 1] ?? '').toLowerCase();
    if (nextHeader.includes('amount') || nextHeader === '') {
      clients.push({ client: cell, milestoneCol: c, amountCol: c + 1 });
      c++; // skip amount col in scan
    }
  }

  if (clients.length === 0) {
    console.error('No client column pairs detected on header rows.');
    process.exit(1);
  }

  const startDataRow = headerRowIndex + 2; // data seems to start a couple rows after headers
  const ordinalCol = 0; // leftmost column has ordinal (1st, 2nd...)

  let newProjects = 0;
  let newMilestones = 0;
  let totalAmount = 0;

  // Pick a default manager (admin) for imported projects
  let adminUser = (await db.select().from(users).where(sql`${users.role} = 'admin'`).limit(1))[0];
  if (!adminUser) {
    // Fallback: pick any user so constraints are satisfied
    adminUser = (await db.select().from(users).limit(1))[0];
  }
  if (!adminUser) {
    console.error('No users found. Please create an admin first (npm run setup:admin) and rerun.');
    process.exit(1);
  }

  for (const cl of clients) {
    const projectName = cl.client;
    if (!projectName) continue;

    // Upsert project by name (no timeline from sheet)
    let project = (await db.select().from(projects).where(eq(projects.name, projectName)))[0];
    if (!project) {
      if (apply) {
        project = (await db.insert(projects).values({
          name: projectName,
          description: projectName,
          startDate: new Date(),
          endDate: new Date(),
          managerId: adminUser?.id ?? '00000000-0000-0000-0000-000000000000',
          status: 'planning',
        }).returning())[0];
      }
      newProjects++;
    }

    // Iterate data rows for milestones
    for (let r = startDataRow; r < json.length; r++) {
      const row: any[] = json[r] || [];
      const ordinal = String(row[ordinalCol] ?? '').trim();
      const milestoneNameRaw = String(row[cl.milestoneCol] ?? '').trim();
      if (!milestoneNameRaw) continue;
      const milestoneName = milestoneNameRaw.slice(0, 200); // tasks.name is varchar(200)
      const amountRaw = String(row[cl.amountCol] ?? '').replace(/[,\s]/g, '');
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount)) continue;
      totalAmount += amount;

      if (apply && project) {
        await db.insert(tasks).values({
          name: milestoneName,
          description: milestoneName,
          projectId: project.id,
          feeAmount: String(amount),
          status: 'todo',
          progressPercent: 0,
          priority: 'medium',
          createdById: adminUser.id,
        });
      }
      newMilestones++;
    }
  }

  console.log('Dry run summary (use --apply to write):');
  console.log('Detected projects:', clients.map(c => c.client));
  console.log('New projects:', newProjects);
  console.log('New milestones:', newMilestones);
  console.log('Total amount:', totalAmount.toLocaleString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


