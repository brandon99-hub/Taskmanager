const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, and, sql } = require('drizzle-orm');
const { pgTable, varchar, text, timestamp, integer, decimal, boolean } = require('drizzle-orm/pg-core');
require('dotenv').config();

// Define schema tables inline
const users = pgTable('users', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email').unique().notNull(),
});

const projects = pgTable('projects', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  segment: varchar('segment').notNull().default('private'),
});

const projectPhases = pgTable('project_phases', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar('project_id').notNull(),
  phaseNumber: integer('phase_number').notNull(),
  phaseName: varchar('phase_name', { length: 100 }).notNull(),
  description: text('description'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
});

const modules = pgTable('modules', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  phaseNumber: integer('phase_number'),
  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
  projectId: varchar('project_id').notNull(),
});

const subtasks = pgTable('subtasks', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar('module_id').notNull(),
  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
});

// Helper function to add days to a date
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper function to format date in a readable way
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function fixPhaseDates() {
  console.log('🚀 Starting Phase Date Fix Script...');

  try {
    // Connect to database
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskflow';
    const client = postgres(connectionString);
    const db = drizzle(client);

    // Get the academic project created in the population script
    console.log('🔍 Finding the academic project...');
    const academicProjects = await db.select().from(projects).where(
      and(
        eq(projects.segment, 'academic'),
        eq(projects.name, 'Academic Management System Development')
      )
    );

    if (academicProjects.length === 0) {
      throw new Error('Academic project not found. Run the population script first.');
    }

    const project = academicProjects[0];
    console.log(`✅ Found project: ${project.name}`);
    console.log(`📅 Project timeline: ${formatDate(project.startDate)} - ${formatDate(project.endDate)}`);

    // Calculate total project duration in days
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    const totalDays = Math.floor((projectEnd - projectStart) / (1000 * 60 * 60 * 24));
    console.log(`📏 Project duration: ${totalDays} days`);

    // Define phase durations as percentages of total project duration
    const phaseDurations = [
      { number: 1, percentage: 0.15, overlap: 0.05 },    // Phase 1: 15% of project, 5% overlap
      { number: 2, percentage: 0.20, overlap: 0.05 },    // Phase 2: 20% of project, 5% overlap
      { number: 3, percentage: 0.35, overlap: 0.05 },    // Phase 3: 35% of project, 5% overlap
      { number: 4, percentage: 0.15, overlap: 0.05 },    // Phase 4: 15% of project, 5% overlap
      { number: 5, percentage: 0.10, overlap: 0.05 },    // Phase 5: 10% of project, 5% overlap
      { number: 6, percentage: 0.05, overlap: 0 }        // Phase 6: 5% of project, no overlap
    ];

    // Calculate phase start and end dates
    console.log('📊 Calculating phase dates...');
    const phaseTimeframes = [];
    let currentDay = 0;

    for (const phase of phaseDurations) {
      const phaseDuration = Math.floor(totalDays * phase.percentage);
      const phaseStart = addDays(projectStart, currentDay);
      const phaseEnd = addDays(phaseStart, phaseDuration);
      
      phaseTimeframes.push({
        number: phase.number,
        start: phaseStart,
        end: phaseEnd
      });
      
      // Move to next phase start, accounting for overlap
      currentDay += Math.floor(phaseDuration * (1 - phase.overlap));
    }

    // Update phase dates in database
    console.log('🔄 Updating phase dates...');
    for (const phase of phaseTimeframes) {
      await db.update(projectPhases)
        .set({
          startDate: phase.start,
          endDate: phase.end
        })
        .where(
          and(
            eq(projectPhases.projectId, project.id),
            eq(projectPhases.phaseNumber, phase.number)
          )
        );
      
      console.log(`✅ Phase ${phase.number}: ${formatDate(phase.start)} - ${formatDate(phase.end)}`);
    }

    // Update module dates to align with phases
    console.log('🔄 Updating module dates...');
    for (const phase of phaseTimeframes) {
      // Get all modules for this phase
      const phaseModules = await db.select().from(modules).where(
        and(
          eq(modules.projectId, project.id),
          eq(modules.phaseNumber, phase.number)
        )
      );
      
      if (phaseModules.length === 0) {
        console.log(`ℹ️ No modules found for Phase ${phase.number}`);
        continue;
      }
      
      console.log(`📋 Found ${phaseModules.length} modules in Phase ${phase.number}`);
      
      // Calculate even distribution of modules across phase timeframe
      const phaseStart = phase.start;
      const phaseEnd = phase.end;
      const phaseDuration = Math.floor((phaseEnd - phaseStart) / (1000 * 60 * 60 * 24));
      const moduleSpacing = Math.floor(phaseDuration / (phaseModules.length + 1));
      
      // Update each module's dates
      for (let i = 0; i < phaseModules.length; i++) {
        const module = phaseModules[i];
        const moduleStart = addDays(phaseStart, (i + 1) * moduleSpacing - Math.floor(moduleSpacing / 2));
        const moduleDuration = Math.floor(moduleSpacing * 0.8); // 80% of spacing
        const moduleEnd = addDays(moduleStart, moduleDuration);
        
        await db.update(modules)
          .set({
            startDate: moduleStart,
            dueDate: moduleEnd
          })
          .where(eq(modules.id, module.id));
        
        console.log(`   ✅ Module "${module.name}": ${formatDate(moduleStart)} - ${formatDate(moduleEnd)}`);
        
        // Update subtasks for this module
        const moduleSubtasks = await db.select().from(subtasks).where(eq(subtasks.moduleId, module.id));
        if (moduleSubtasks.length > 0) {
          console.log(`      📋 Updating ${moduleSubtasks.length} subtasks`);
          
          // Calculate even distribution of subtasks across module timeframe
          const subtaskSpacing = Math.floor(moduleDuration / (moduleSubtasks.length + 1));
          
          for (let j = 0; j < moduleSubtasks.length; j++) {
            const subtask = moduleSubtasks[j];
            const subtaskStart = addDays(moduleStart, (j + 1) * subtaskSpacing - Math.floor(subtaskSpacing / 2));
            const subtaskDuration = Math.floor(subtaskSpacing * 0.7); // 70% of spacing
            const subtaskEnd = addDays(subtaskStart, subtaskDuration);
            
            await db.update(subtasks)
              .set({
                startDate: subtaskStart,
                dueDate: subtaskEnd
              })
              .where(eq(subtasks.id, subtask.id));
          }
        }
      }
    }

    console.log('\n🎉 Phase Date Fix Complete!');
    console.log(`📊 Summary:`);
    console.log(`   • Project: ${project.name}`);
    console.log(`   • Timeline: ${formatDate(project.startDate)} - ${formatDate(project.endDate)}`);
    console.log(`   • Phases Updated: ${phaseTimeframes.length}`);
    console.log(`   • Phase 1 Start: ${formatDate(phaseTimeframes[0].start)}`);
    console.log(`   • Phase 6 End: ${formatDate(phaseTimeframes[5].end)}`);

  } catch (error) {
    console.error('❌ Error during phase date fix:', error.message);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixPhaseDates()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixPhaseDates };