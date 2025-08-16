import 'dotenv/config';
import { db } from '../server/db';
import { notifications, taskDependencies, projectAttachments, tasks, teamMembers, projects, teams, users, sessions } from '../shared/schema';
import { sql, eq, not } from 'drizzle-orm';

/**
 * Truncate business data while keeping admin user accounts.
 *
 * Usage:
 *  tsx scripts/reset-data.ts            # dry run (shows counts)
 *  tsx scripts/reset-data.ts --apply    # actually deletes
 */
async function main() {
  const apply = process.argv.includes('--apply');

  // Counts snapshot
  const count = async (table: any) => (await db.select({ c: sql`COUNT(*)` }).from(table))[0].c as number;

  const snapshot = async () => ({
    sessions: await count(sessions),
    notifications: await count(notifications),
    taskDependencies: await count(taskDependencies),
    projectAttachments: await count(projectAttachments),
    tasks: await count(tasks),
    teamMembers: await count(teamMembers),
    projects: await count(projects),
    teams: await count(teams),
    users: await count(users),
  });

  console.log('Current counts:', await snapshot());

  if (!apply) {
    console.log('Dry run: pass --apply to delete');
    return;
  }

  // Delete in FK-safe order
  await db.delete(sessions).execute();
  await db.delete(notifications).execute();
  await db.delete(taskDependencies).execute();
  await db.delete(projectAttachments).execute();
  await db.delete(tasks).execute();
  await db.delete(teamMembers).execute();
  await db.delete(projects).execute();
  await db.delete(teams).execute();
  // Delete all non-admin users
  await db.delete(users).where(not(eq(users.role, 'admin'))).execute();

  console.log('After reset:', await snapshot());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



