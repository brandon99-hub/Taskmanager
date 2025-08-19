import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrateTeamSegments() {
  console.log("Starting team segments and invoice tracking migration...");
  try {
    // Add segment column to teams table
    console.log("Adding segment column to teams table...");
    await db.execute(sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS segment project_segment NOT NULL DEFAULT 'private';`);
    
    // Update existing teams to have default segment
    console.log("Updating existing teams with default segment...");
    await db.execute(sql`UPDATE teams SET segment = 'private' WHERE segment IS NULL;`);
    
    // Add new statuses to billing_status enum
    console.log("Adding new billing statuses...");
    await db.execute(sql`ALTER TYPE billing_status ADD VALUE IF NOT EXISTS 'overdue';`);
    await db.execute(sql`ALTER TYPE billing_status ADD VALUE IF NOT EXISTS 'processing';`);
    
    // Add invoice tracking fields to tasks
    console.log("Adding invoice tracking fields to tasks...");
    await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMP;`);
    await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMP;`);
    await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS overdue_flag BOOLEAN DEFAULT FALSE;`);
    
    // Update existing completed milestones without invoice dates
    console.log("Updating existing completed milestones...");
    await db.execute(sql`
      UPDATE tasks 
      SET 
        expected_invoice_date = completed_at,
        expected_collection_date = completed_at + INTERVAL '30 days',
        billing_status = 'to_send'
      WHERE 
        status = 'done' 
        AND expected_invoice_date IS NULL 
        AND fee_amount > 0;
    `);
    
    console.log("Team segments and invoice tracking migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateTeamSegments()
    .then(() => {
      console.log("Migration completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateTeamSegments };
