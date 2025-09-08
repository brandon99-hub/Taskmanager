const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, and, sql } = require('drizzle-orm');
const { pgTable, varchar, text, timestamp, integer, decimal, boolean } = require('drizzle-orm/pg-core');
require('dotenv').config();

// Define schema tables inline to match the actual database
const projects = pgTable('projects', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  client: varchar('client', { length: 200 }),
  contactPerson: varchar('contact_person'),
  contactPhone: varchar('contact_phone'),
  contactEmail: varchar('contact_email'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: varchar('status').notNull().default('planning'),
  segment: varchar('segment').notNull().default('private'),
  budget: decimal('budget', { precision: 12, scale: 2 }),
  teamId: varchar('team_id'),
  managerId: varchar('manager_id').notNull(),
  progress: integer('progress').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

const milestones = pgTable('milestones', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  feeAmount: decimal('fee_amount', { precision: 12, scale: 2 }),
  billingStatus: varchar('billing_status', { length: 20 }).notNull().default('none'),
  expectedInvoiceDate: timestamp('expected_invoice_date'),
  expectedCollectionDate: timestamp('expected_collection_date'),
  invoiceSentAt: timestamp('invoice_sent_at'),
  paymentReceivedAt: timestamp('payment_received_at'),
  overdueFlag: boolean('overdue_flag').default(false),
  projectId: varchar('project_id').notNull(),
  createdById: varchar('created_by_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

const modules = pgTable('modules', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  status: text('status').notNull().default('todo'),
  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
  estimatedHours: integer('estimated_hours'),
  actualHours: integer('actual_hours').default(0),
  weight: integer('weight').default(2),
  projectId: varchar('project_id').notNull(),
  phaseNumber: integer('phase_number'),
  phaseName: varchar('phase_name', { length: 100 }),
  assignedUserId: varchar('assigned_user_id'),
  assignedTeamId: varchar('assigned_team_id'),
  milestoneId: varchar('milestone_id'),
  createdById: varchar('created_by_id').notNull(),
  completedAt: timestamp('completed_at'),
  progressPercent: integer('progress_percent').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskflow';
const postgresClient = postgres(connectionString);
const db = drizzle(postgresClient);

// Financial data for milestones by phase (based on the original population script)
const MILESTONE_FINANCIAL_DATA = {
  1: [ // Phase 1: Initiation & Contracting
    {
      name: 'Project Setup',
      feeAmount: 1200000,
      expectedInvoiceDate: new Date('2025-10-01'),
      expectedCollectionDate: new Date('2025-10-31')
    },
    {
      name: 'Contract Finalization',
      feeAmount: 800000,
      expectedInvoiceDate: new Date('2025-10-20'),
      expectedCollectionDate: new Date('2025-11-19')
    }
  ],
  2: [ // Phase 2: Planning & Design
    {
      name: 'System Architecture',
      feeAmount: 1800000,
      expectedInvoiceDate: new Date('2025-11-20'),
      expectedCollectionDate: new Date('2025-12-20')
    },
    {
      name: 'UI/UX Design',
      feeAmount: 1200000,
      expectedInvoiceDate: new Date('2025-12-20'),
      expectedCollectionDate: new Date('2026-01-19')
    }
  ],
  4: [ // Phase 4: Testing & Quality Assurance
    {
      name: 'System Testing',
      feeAmount: 1200000,
      expectedInvoiceDate: new Date('2026-09-20'),
      expectedCollectionDate: new Date('2026-10-20')
    },
    {
      name: 'User Acceptance Testing',
      feeAmount: 800000,
      expectedInvoiceDate: new Date('2026-10-20'),
      expectedCollectionDate: new Date('2026-11-19')
    }
  ],
  5: [ // Phase 5: Deployment & Go-Live
    {
      name: 'Production Deployment',
      feeAmount: 500000,
      expectedInvoiceDate: new Date('2026-11-05'),
      expectedCollectionDate: new Date('2026-12-05')
    },
    {
      name: 'Go-Live Support',
      feeAmount: 300000,
      expectedInvoiceDate: new Date('2026-11-20'),
      expectedCollectionDate: new Date('2026-12-20')
    }
  ],
  6: [ // Phase 6: Support & Maintenance
    {
      name: 'Post-Launch Support',
      feeAmount: 200000,
      expectedInvoiceDate: new Date('2026-12-10'),
      expectedCollectionDate: new Date('2027-01-09')
    }
  ]
};

async function updateMilestoneFinancialData() {
  console.log('🚀 Starting Milestone Financial Data Update...');

  try {
    // Step 1: Find the Maseno University ERP System project
    console.log('📋 Finding Maseno University ERP System project...');
    const projectsList = await db.select().from(projects).where(eq(projects.name, 'Maseno University ERP System'));
    
    if (projectsList.length === 0) {
      throw new Error('Maseno University ERP System project not found.');
    }
    
    const project = projectsList[0];
    console.log(`✅ Found project: ${project.name}`);

    // Step 2: Get all milestones for this project
    console.log('💰 Finding milestones...');
    const milestonesList = await db.select().from(milestones).where(eq(milestones.projectId, project.id));
    console.log(`✅ Found ${milestonesList.length} milestones`);

    // Step 3: Create a map of milestone names to their phase numbers
    console.log('📊 Mapping milestone names to phase numbers...');
    const milestonePhaseMap = new Map();
    
    // Map milestones to phases based on their names and the original data structure
    const milestoneToPhaseMap = {
      'Project Setup': 1,
      'Contract Finalization': 1,
      'System Architecture': 2,
      'UI/UX Design': 2,
      'Core System Development': 3,
      'Financial System': 3,
      'Academic Management': 3,
      'System Testing': 4,
      'User Acceptance Testing': 4,
      'Production Deployment': 5,
      'Go-Live Support': 5,
      'Post-Launch Support': 6
    };
    
    for (const milestone of milestonesList) {
      const phaseNumber = milestoneToPhaseMap[milestone.name];
      if (phaseNumber) {
        milestonePhaseMap.set(milestone.name, phaseNumber);
        console.log(`   📍 Mapped ${milestone.name} to Phase ${phaseNumber}`);
      } else {
        console.log(`   ⚠️  Could not map milestone: ${milestone.name}`);
      }
    }

    // Step 4: Update milestones with financial data
    console.log('💸 Updating milestone financial data...');
    let updatedCount = 0;

    for (const milestone of milestonesList) {
      // Skip Phase 3 milestones as they should already have financial data
      const phaseNumber = milestonePhaseMap.get(milestone.name);
      
      if (!phaseNumber || phaseNumber === 3) {
        console.log(`   ⏭️  Skipping ${milestone.name} (Phase ${phaseNumber || 'unknown'})`);
        continue;
      }

      // Find financial data for this milestone
      const phaseData = MILESTONE_FINANCIAL_DATA[phaseNumber];
      if (!phaseData) {
        console.log(`   ⚠️  No financial data found for Phase ${phaseNumber} milestone: ${milestone.name}`);
        continue;
      }

      const financialData = phaseData.find(data => 
        data.name.toLowerCase().includes(milestone.name.toLowerCase()) ||
        milestone.name.toLowerCase().includes(data.name.toLowerCase())
      );

      if (!financialData) {
        console.log(`   ⚠️  No matching financial data for milestone: ${milestone.name}`);
        continue;
      }

      // Update the milestone with financial data
      await db
        .update(milestones)
        .set({
          feeAmount: financialData.feeAmount,
          expectedInvoiceDate: financialData.expectedInvoiceDate,
          expectedCollectionDate: financialData.expectedCollectionDate,
          updatedAt: new Date()
        })
        .where(eq(milestones.id, milestone.id));

      console.log(`   ✅ Updated ${milestone.name} (Phase ${phaseNumber}): KSh ${financialData.feeAmount.toLocaleString()}`);
      updatedCount++;
    }

    console.log('\n🎉 Milestone Financial Data Update Complete!');
    console.log(`📊 Summary:`);
    console.log(`   • Project: ${project.name}`);
    console.log(`   • Total Milestones: ${milestonesList.length}`);
    console.log(`   • Updated Milestones: ${updatedCount}`);
    console.log(`   • Skipped Phase 3: ${milestonesList.filter(m => milestonePhaseMap.get(m.name) === 3).length}`);

  } catch (error) {
    console.error('❌ Error during update:', error.message);
    throw error;
  } finally {
    await postgresClient.end();
  }
}

// Run the update
if (require.main === module) {
  updateMilestoneFinancialData()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateMilestoneFinancialData };
