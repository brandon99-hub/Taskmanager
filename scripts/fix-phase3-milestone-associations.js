const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, and, isNull, isNotNull, sql } = require('drizzle-orm');
const { pgTable, varchar, text, timestamp, integer, decimal, boolean } = require('drizzle-orm/pg-core');
require('dotenv').config();

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskflow';
const postgresClient = postgres(connectionString);
const db = drizzle(postgresClient);

// Define schema tables inline (copied from working populate script)
const projects = pgTable('projects', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  budget: decimal('budget', { precision: 15, scale: 2 }),
  segment: varchar('segment', { length: 50 }).notNull().default('private'),
  teamId: varchar('team_id'),
  managerId: varchar('manager_id').notNull(),
  progress: integer('progress').default(0),
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
  status: varchar('status', { length: 20 }).notNull().default('todo'),
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

async function fixPhase3MilestoneAssociations() {
  try {
    console.log('🔍 Starting Phase 3 milestone association fix...');
    
    // Get all projects
    const allProjects = await db.select().from(projects);
    console.log(`📊 Found ${allProjects.length} projects`);
    
    for (const project of allProjects) {
      console.log(`\n🏗️  Processing project: ${project.name} (${project.id})`);
      
      // First, check if milestones exist for this project
      const projectMilestones = await db
        .select()
        .from(milestones)
        .where(eq(milestones.projectId, project.id))
        .orderBy(milestones.createdAt);
      
      console.log(`   📋 Found ${projectMilestones.length} milestones`);
      
      if (projectMilestones.length === 0) {
        console.log('   ⚠️  No milestones found for this project!');
        console.log('   🔧 Creating default Phase 3 milestones...');
        
        // Use a default user ID for createdById (you can change this to a real user ID)
        const createdById = 'system-user-id';
        
        // Create default Phase 3 milestones if none exist
        const defaultMilestones = [
          {
            name: 'Core System Development',
            description: 'User management and student management modules',
            priority: 'critical',
            startDate: new Date('2025-12-16'),
            endDate: new Date('2026-03-15'),
            feeAmount: 4000000,
            expectedInvoiceDate: new Date('2026-03-20'),
            expectedCollectionDate: new Date('2026-04-19'),
            projectId: project.id,
            createdById: createdById
          },
          {
            name: 'Financial System',
            description: 'Fee management and financial reporting modules',
            priority: 'critical',
            startDate: new Date('2026-03-16'),
            endDate: new Date('2026-06-15'),
            feeAmount: 3000000,
            expectedInvoiceDate: new Date('2026-06-20'),
            expectedCollectionDate: new Date('2026-07-19'),
            projectId: project.id,
            createdById: createdById
          },
          {
            name: 'Academic Management',
            description: 'Course management and library management modules',
            priority: 'high',
            startDate: new Date('2026-06-16'),
            endDate: new Date('2026-08-15'),
            feeAmount: 2500000,
            expectedInvoiceDate: new Date('2026-08-20'),
            expectedCollectionDate: new Date('2026-09-19'),
            projectId: project.id,
            createdById: createdById
          }
        ];
        
        for (const milestoneData of defaultMilestones) {
          const [createdMilestone] = await db
            .insert(milestones)
            .values(milestoneData)
            .returning();
          console.log(`   ✅ Created milestone: ${createdMilestone.name}`);
        }
        
        // Re-fetch milestones after creation
        const newProjectMilestones = await db
          .select()
          .from(milestones)
          .where(eq(milestones.projectId, project.id))
          .orderBy(milestones.createdAt);
        
        console.log(`   📋 Now have ${newProjectMilestones.length} milestones`);
        // Update the projectMilestones array with the newly created milestones
        projectMilestones.length = 0; // Clear the array
        projectMilestones.push(...newProjectMilestones);
      }
      
      // Get all Phase 3 modules that don't have a milestoneId
      const phase3Modules = await db
        .select()
        .from(modules)
        .where(and(
          eq(modules.projectId, project.id),
          eq(modules.phaseNumber, 3),
          isNull(modules.milestoneId)
        ));
      
      console.log(`   🔧 Found ${phase3Modules.length} Phase 3 modules without milestone associations`);
      
      if (phase3Modules.length === 0) {
        console.log('   ✅ All Phase 3 modules already have milestone associations');
        continue;
      }
      
      // For each Phase 3 module, try to find the best matching milestone
      for (const module of phase3Modules) {
        console.log(`\n   🔍 Processing module: ${module.name}`);
        
        // Try to find a milestone that matches the module name or description
        let bestMatch = null;
        let bestScore = 0;
        
        for (const milestone of projectMilestones) {
          let score = 0;
          
          // Check if module name contains milestone name or vice versa
          if (module.name.toLowerCase().includes(milestone.name.toLowerCase()) ||
              milestone.name.toLowerCase().includes(module.name.toLowerCase())) {
            score += 10;
          }
          
          // Check if module description contains milestone name or vice versa
          if (module.description && milestone.description) {
            if (module.description.toLowerCase().includes(milestone.name.toLowerCase()) ||
                milestone.description.toLowerCase().includes(module.name.toLowerCase())) {
              score += 5;
            }
          }
          
                     // Check for common keywords with better matching
           const keywordMappings = {
             'user': ['core system development', 'user management'],
             'management': ['core system development', 'academic management'],
             'system': ['core system development', 'financial system'],
             'authentication': ['core system development', 'user management'],
             'registration': ['core system development', 'user management'],
             'role': ['core system development', 'user management'],
             'student': ['core system development', 'academic management'],
             'financial': ['financial system'],
             'academic': ['academic management'],
             'testing': ['system testing'],
             'ui': ['ui/ux design'],
             'ux': ['ui/ux design'],
             'design': ['ui/ux design'],
             'development': ['core system development'],
             'core': ['core system development']
           };
           
           for (const [keyword, milestoneNames] of Object.entries(keywordMappings)) {
             if (module.name.toLowerCase().includes(keyword)) {
               for (const milestoneName of milestoneNames) {
                 if (milestone.name.toLowerCase().includes(milestoneName)) {
                   score += 5;
                 }
               }
             }
           }
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = milestone;
          }
        }
        
        if (bestMatch && bestScore > 0) {
          console.log(`   ✅ Best match: "${bestMatch.name}" (score: ${bestScore})`);
          
                     // Update the module with the milestone ID
           await db
             .update(modules)
             .set({ 
               milestoneId: bestMatch.id,
               updatedAt: new Date()
             })
             .where(eq(modules.id, module.id));
          
          console.log(`   🔗 Associated "${module.name}" with milestone "${bestMatch.name}"`);
        } else {
          console.log(`   ⚠️  No good match found for "${module.name}"`);
          
          // If no good match, associate with the first milestone as fallback
          if (projectMilestones.length > 0) {
            const fallbackMilestone = projectMilestones[0];
                         await db
               .update(modules)
               .set({ 
                 milestoneId: fallbackMilestone.id,
                 updatedAt: new Date()
               })
               .where(eq(modules.id, module.id));
            
            console.log(`   🔄 Fallback: Associated "${module.name}" with first milestone "${fallbackMilestone.name}"`);
          }
        }
      }
    }
    
    console.log('\n✅ Phase 3 milestone association fix completed!');
    
    // Verify the results
    console.log('\n📊 Verification:');
    const totalPhase3Modules = await db
      .select()
      .from(modules)
      .where(eq(modules.phaseNumber, 3));
    
    const associatedPhase3Modules = await db
      .select()
      .from(modules)
      .where(and(
        eq(modules.phaseNumber, 3),
        isNotNull(modules.milestoneId)
      ));
    
    console.log(`   Total Phase 3 modules: ${totalPhase3Modules.length}`);
    console.log(`   Modules with milestone associations: ${associatedPhase3Modules.length}`);
    console.log(`   Association rate: ${((associatedPhase3Modules.length / totalPhase3Modules.length) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error fixing Phase 3 milestone associations:', error);
    throw error;
  } finally {
    await postgresClient.end();
  }
}

// Run the script
if (require.main === module) {
  fixPhase3MilestoneAssociations()
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixPhase3MilestoneAssociations };
