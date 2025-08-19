import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrateSchema() {
  console.log("Starting schema migration...");

  try {
    // Add new enum values to project_status
    console.log("Adding 'terminated' to project_status enum...");
    await db.execute(sql`
      ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'terminated';
    `);

    // Create project_segment enum
    console.log("Creating project_segment enum...");
    await db.execute(sql`
      CREATE TYPE IF NOT EXISTS project_segment AS ENUM ('academic', 'parastals', 'private');
    `);

    // Add segment column to projects table
    console.log("Adding segment column to projects table...");
    await db.execute(sql`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS segment project_segment NOT NULL DEFAULT 'private';
    `);

    // Add invoice date columns to tasks table
    console.log("Adding invoice date columns to tasks table...");
    await db.execute(sql`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS expected_invoice_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS expected_collection_date TIMESTAMP;
    `);

    // Create invoice_reports table
    console.log("Creating invoice_reports table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invoice_reports (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id VARCHAR NOT NULL REFERENCES tasks(id),
        project_id VARCHAR NOT NULL REFERENCES projects(id),
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        invoice_date TIMESTAMP NOT NULL,
        expected_collection_date TIMESTAMP NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'sent',
        sent_by VARCHAR NOT NULL REFERENCES users(id),
        sent_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create monthly_targets table
    console.log("Creating monthly_targets table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monthly_targets (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        year INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
        segment project_segment NOT NULL,
        target_amount DECIMAL(12,2) NOT NULL,
        actual_amount DECIMAL(12,2) DEFAULT 0,
        calculated_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(year, month, segment)
      );
    `);

    // Create invoice_collections table
    console.log("Creating invoice_collections table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invoice_collections (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id VARCHAR NOT NULL REFERENCES invoice_reports(id),
        task_id VARCHAR NOT NULL REFERENCES tasks(id),
        project_id VARCHAR NOT NULL REFERENCES projects(id),
        collection_date TIMESTAMP NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_method VARCHAR(100),
        reference VARCHAR(200),
        notes TEXT,
        collected_by VARCHAR REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes for better performance
    console.log("Creating indexes...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_projects_segment ON projects(segment);
      CREATE INDEX IF NOT EXISTS idx_tasks_invoice_dates ON tasks(expected_invoice_date, expected_collection_date);
      CREATE INDEX IF NOT EXISTS idx_invoice_reports_status ON invoice_reports(status);
      CREATE INDEX IF NOT EXISTS idx_monthly_targets_year_month ON monthly_targets(year, month);
      CREATE INDEX IF NOT EXISTS idx_invoice_collections_date ON invoice_collections(collection_date);
    `);

    console.log("Schema migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateSchema()
    .then(() => {
      console.log("Migration completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateSchema };
