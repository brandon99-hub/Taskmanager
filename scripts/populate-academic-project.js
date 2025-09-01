const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, and, sql } = require('drizzle-orm');
const { pgTable, varchar, text, timestamp, integer, decimal, boolean } = require('drizzle-orm/pg-core');
require('dotenv').config();

// Define schema tables inline
const users = pgTable('users', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email').unique().notNull(),
  password: varchar('password').notNull(),
  firstName: varchar('first_name'),
  lastName: varchar('last_name'),
  role: varchar('role', { length: 20 }).notNull().default('employee'),
  assignedSegment: varchar('assigned_segment'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

const teams = pgTable('teams', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  segment: varchar('segment').notNull().default('private'),
  createdAt: timestamp('created_at').defaultNow(),
});

const teamMembers = pgTable('team_members', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar('team_id').notNull(),
  userId: varchar('user_id').notNull(),
  role: varchar('role', { length: 50 }).default('member'),
  joinedAt: timestamp('joined_at').defaultNow(),
});

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

const projectPhases = pgTable('project_phases', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar('project_id').notNull(),
  phaseNumber: integer('phase_number').notNull(),
  phaseType: varchar('phase_type', { length: 50 }).notNull(),
  phaseName: varchar('phase_name', { length: 100 }).notNull(),
  description: text('description'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  status: varchar('status', { length: 20 }).notNull().default('not_started'),
  progress: integer('progress').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

const modules = pgTable('modules', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  priority: varchar('priority').notNull().default('medium'),
  status: text('status').notNull().default('not_started'),
  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
  projectId: varchar('project_id').notNull(),
  phaseNumber: integer('phase_number'),
  phaseName: varchar('phase_name', { length: 100 }),
  phase: varchar('phase', { length: 100 }),
  assignedUserId: varchar('assigned_user_id'),
  assignedTeamId: varchar('assigned_team_id'),
  createdById: varchar('created_by_id').notNull(),
  progressPercent: integer('progress_percent').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

const subtasks = pgTable('subtasks', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  status: text('status').notNull().default('not_started'),
  priority: varchar('priority').notNull().default('medium'),
  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
  moduleId: varchar('module_id').notNull(),
  assignedUserId: varchar('assigned_user_id'),
  assignedDevId: varchar('assigned_dev_id'),
  assignedConsultantId: varchar('assigned_consultant_id'),
  createdById: varchar('created_by_id').notNull(),
  progressPercent: integer('progress_percent').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

const milestones = pgTable('milestones', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  feeAmount: decimal('fee_amount', { precision: 12, scale: 2 }),
  billingStatus: varchar('billing_status').notNull().default('none'),
  expectedInvoiceDate: timestamp('expected_invoice_date'),
  expectedCollectionDate: timestamp('expected_collection_date'),
  projectId: varchar('project_id').notNull(),
  createdById: varchar('created_by_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskflow';
const client = postgres(connectionString);
const db = drizzle(client);

// Helper function to generate random date within range
function randomDateBetween(start, end) {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
}

// Helper function to add days to a date
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Project timeline
const PROJECT_START = new Date('2025-09-01');
const PROJECT_END = new Date('2027-01-01');

// Project phases data
const PHASES = [
  {
    phaseNumber: 1,
    phaseType: 'initiation_contracting',
    phaseName: 'Initiation & Contracting',
    description: 'Project setup and contract finalization'
  },
  {
    phaseNumber: 2,
    phaseType: 'requirements_design',
    phaseName: 'Requirements Gathering & Design',
    description: 'Business requirements analysis and system design'
  },
  {
    phaseNumber: 3,
    phaseType: 'development',
    phaseName: 'System Customization & Development',
    description: 'Core system development and customization'
  },
  {
    phaseNumber: 4,
    phaseType: 'testing',
    phaseName: 'Testing & Validation',
    description: 'Comprehensive testing and quality assurance'
  },
  {
    phaseNumber: 5,
    phaseType: 'deployment',
    phaseName: 'Deployment & Go-Live',
    description: 'System deployment and go-live activities'
  },
  {
    phaseNumber: 6,
    phaseType: 'closure',
    phaseName: 'Transition & Closure',
    description: 'Knowledge transfer and project closure'
  }
];

// Modules data
const MODULES_DATA = [
  // Phase 1 modules
  {
    phaseNumber: 1,
    name: 'Project Setup & Planning',
    description: 'Initial project setup and comprehensive planning activities',
    priority: 'high',
    subtasks: [
      'Conduct stakeholder meetings',
      'Define project scope and objectives',
      'Create project charter document',
      'Establish communication protocols',
      'Set up project management tools'
    ]
  },
  {
    phaseNumber: 1,
    name: 'Contract Finalization',
    description: 'Complete contract finalization and legal processes',
    priority: 'critical',
    subtasks: [
      'Review and finalize contract terms',
      'Obtain legal approval',
      'Get client signatures',
      'Set up billing milestones',
      'Establish payment schedules'
    ]
  },
  // Phase 2 modules
  {
    phaseNumber: 2,
    name: 'Business Requirements Analysis',
    description: 'Comprehensive analysis of business requirements',
    priority: 'critical',
    subtasks: [
      'Conduct user interviews',
      'Document functional requirements',
      'Create user stories and acceptance criteria',
      'Validate requirements with stakeholders',
      'Finalize requirements document'
    ]
  },
  {
    phaseNumber: 2,
    name: 'System Architecture Design',
    description: 'Design comprehensive system architecture',
    priority: 'high',
    subtasks: [
      'Design system architecture',
      'Create database schema',
      'Define API specifications',
      'Design security framework',
      'Create technical documentation'
    ]
  },
  {
    phaseNumber: 2,
    name: 'UI/UX Design',
    description: 'User interface and experience design',
    priority: 'high',
    subtasks: [
      'Create wireframes and mockups',
      'Design user interface components',
      'Develop style guide and branding',
      'Conduct usability testing',
      'Finalize design specifications'
    ]
  },
  // Phase 3 modules
  {
    phaseNumber: 3,
    name: 'Backend Development',
    description: 'Core backend system development',
    priority: 'critical',
    subtasks: [
      'Set up development environment',
      'Implement database models',
      'Develop REST API endpoints',
      'Implement authentication system',
      'Create data validation logic'
    ]
  },
  {
    phaseNumber: 3,
    name: 'Frontend Development',
    description: 'User interface development and integration',
    priority: 'critical',
    subtasks: [
      'Set up React application structure',
      'Implement UI components',
      'Integrate with backend APIs',
      'Implement state management',
      'Add responsive design'
    ]
  },
  {
    phaseNumber: 3,
    name: 'Integration & Configuration',
    description: 'System integration and configuration',
    priority: 'high',
    subtasks: [
      'Configure third-party integrations',
      'Set up email notifications',
      'Implement file upload functionality',
      'Configure security settings',
      'Optimize performance'
    ]
  },
  // Phase 4 modules
  {
    phaseNumber: 4,
    name: 'Unit & Integration Testing',
    description: 'Comprehensive testing implementation',
    priority: 'high',
    subtasks: [
      'Write unit tests for backend',
      'Write component tests for frontend',
      'Perform integration testing',
      'Set up automated testing pipeline',
      'Fix identified bugs and issues'
    ]
  },
  {
    phaseNumber: 4,
    name: 'User Acceptance Testing',
    description: 'User acceptance testing and validation',
    priority: 'critical',
    subtasks: [
      'Prepare UAT environment',
      'Train end users on system',
      'Conduct user acceptance testing',
      'Document and resolve issues',
      'Obtain user sign-off'
    ]
  },
  // Phase 5 modules
  {
    phaseNumber: 5,
    name: 'Production Deployment',
    description: 'Production deployment and setup',
    priority: 'critical',
    subtasks: [
      'Set up production environment',
      'Deploy application to production',
      'Configure production database',
      'Set up monitoring and logging',
      'Perform smoke testing'
    ]
  },
  {
    phaseNumber: 5,
    name: 'Go-Live Support',
    description: 'Go-live support and monitoring',
    priority: 'high',
    subtasks: [
      'Provide go-live support',
      'Monitor system performance',
      'Address immediate issues',
      'Train support team',
      'Document operational procedures'
    ]
  },
  // Phase 6 modules
  {
    phaseNumber: 6,
    name: 'Knowledge Transfer',
    description: 'Knowledge transfer and documentation',
    priority: 'medium',
    subtasks: [
      'Create user documentation',
      'Conduct training sessions',
      'Transfer technical knowledge',
      'Set up support procedures',
      'Create maintenance guidelines'
    ]
  },
  {
    phaseNumber: 6,
    name: 'Project Closure',
    description: 'Final project closure activities',
    priority: 'medium',
    subtasks: [
      'Conduct project review',
      'Document lessons learned',
      'Archive project artifacts',
      'Release project resources',
      'Complete final billing'
    ]
  }
];

// Billing milestones
const MILESTONES_DATA = [
  {
    name: 'Project Initiation Complete',
    description: 'Initial project setup and planning completion',
    feeAmount: 2000000,
    invoiceOffsetDays: 14,
    collectionOffsetDays: 30
  },
  {
    name: 'Requirements & Design Approval',
    description: 'Business requirements and system design approval',
    feeAmount: 2500000,
    invoiceOffsetDays: 7,
    collectionOffsetDays: 30
  },
  {
    name: 'Development Phase 50% Complete',
    description: 'Mid-development milestone achievement',
    feeAmount: 2000000,
    invoiceOffsetDays: 10,
    collectionOffsetDays: 30
  },
  {
    name: 'Testing & UAT Complete',
    description: 'Testing and user acceptance completion',
    feeAmount: 1500000,
    invoiceOffsetDays: 5,
    collectionOffsetDays: 30
  },
  {
    name: 'Go-Live & Final Delivery',
    description: 'System go-live and final project delivery',
    feeAmount: 2000000,
    invoiceOffsetDays: 3,
    collectionOffsetDays: 30
  }
];

async function populateDatabase() {
  console.log('🚀 Starting Academic Project Population...');

  try {
    // Step 1: Find existing FC user
    console.log('👤 Finding FC user...');
    const fcUsers = await db.select().from(users).where(eq(users.email, 'laxusnobody457@gmail.com'));
    
    if (fcUsers.length === 0) {
      throw new Error('FC user (laxusnobody457@gmail.com) not found. Please create this user first.');
    }
    
    const fcUser = fcUsers[0];
    console.log(`✅ Found FC user: ${fcUser.firstName} ${fcUser.lastName}`);

    // Step 2: Find existing academic team "Full Stack Devs 2"
    console.log('🏗️ Finding academic team...');
    const academicTeams = await db.select().from(teams).where(
      and(eq(teams.name, 'Full Stack Devs 2'), eq(teams.segment, 'academic'))
    );
    
    if (academicTeams.length === 0) {
      throw new Error('Academic team "Full Stack Devs 2" not found. Please create this team first.');
    }
    
    const academicTeam = academicTeams[0];
    
    console.log(`✅ Found academic team: ${academicTeam.name}`);

    // Step 3: Get team members (developers)
    console.log('👥 Finding team developers...');
    const teamMembersList = await db.select({
      userId: teamMembers.userId,
      role: teamMembers.role,
      user: users
    }).from(teamMembers)
      .leftJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, academicTeam.id));
    
    const developers = teamMembersList.filter(member => 
      member.user && member.user.id !== fcUser.id
    );
    
    if (developers.length < 2) {
      throw new Error(`Need at least 2 developers in team. Found only ${developers.length}`);
    }
    
    console.log(`✅ Found ${developers.length} developers in team:`);
    developers.forEach((dev, index) => {
      console.log(`   ${index + 1}. ${dev.user.firstName} ${dev.user.lastName} (${dev.role})`);
    });

    // Step 4: Create project
    console.log('📋 Creating project...');
    const projectData = {
      name: 'Academic Management System Development',
      description: 'Comprehensive academic management system for educational institutions',
      client: 'Maseno University',
      contactPerson: 'Dr. Sarah Kemunto',
      contactPhone: '+254-720-123456',
      contactEmail: 'sarah.kemunto@maseno.ac.ke',
      startDate: PROJECT_START,
      endDate: PROJECT_END,
      status: 'planning',
      segment: 'academic',
      budget: 10000000,
      teamId: academicTeam.id,
      managerId: fcUser.id,
      progress: 0
    };

    const [project] = await db.insert(projects).values(projectData).returning();
    console.log(`✅ Created project: ${project.name}`);

    // Step 5: Create project phases
    console.log('📊 Creating project phases...');
    const createdPhases = [];
    
    for (const phaseData of PHASES) {
      const phase = {
        projectId: project.id,
        phaseNumber: phaseData.phaseNumber,
        phaseType: phaseData.phaseType,
        phaseName: phaseData.phaseName,
        description: phaseData.description,
        startDate: null,
        endDate: null,
        status: 'not_started',
        progress: 0
      };
      
      const [createdPhase] = await db.insert(projectPhases).values(phase).returning();
      createdPhases.push(createdPhase);
      console.log(`   ✅ Phase ${phaseData.phaseNumber}: ${phaseData.phaseName}`);
    }

    // Step 6: Create modules with random dates
    console.log('🔧 Creating modules...');
    const createdModules = [];
    
    for (const moduleData of MODULES_DATA) {
      // Generate random dates within project timeline
      const moduleStart = randomDateBetween(PROJECT_START, addDays(PROJECT_END, -30));
      const moduleDue = randomDateBetween(addDays(moduleStart, 5), PROJECT_END);
      
      // Modules have NO assignments - only subtasks do
      const module = {
        name: moduleData.name,
        description: moduleData.description,
        priority: moduleData.priority,
        status: 'not_started',
        startDate: moduleStart,
        dueDate: moduleDue,
        projectId: project.id,
        phaseNumber: moduleData.phaseNumber,
        phaseName: PHASES.find(p => p.phaseNumber === moduleData.phaseNumber).phaseName,
        phase: PHASES.find(p => p.phaseNumber === moduleData.phaseNumber).phaseName,
        assignedUserId: null, // NO assignment for modules
        assignedTeamId: academicTeam.id,
        createdById: fcUser.id,
        progressPercent: 0
      };
      
      const [createdModule] = await db.insert(modules).values(module).returning();
      createdModules.push({ ...createdModule, subtasks: moduleData.subtasks });
      console.log(`   ✅ Module: ${moduleData.name} (no assignment - only subtasks get assigned)`);
    }

    // Step 7: Create subtasks
    console.log('📝 Creating subtasks...');
    let subtaskCount = 0;
    
    for (const module of createdModules) {
      for (const subtaskName of module.subtasks) {
        // Generate random dates within module timeframe
        const subtaskStart = randomDateBetween(module.startDate, addDays(module.dueDate, -3));
        const subtaskDue = randomDateBetween(addDays(subtaskStart, 1), module.dueDate);
        
        // Assign one developer randomly (not both)
        const assignedDev = developers[Math.floor(Math.random() * developers.length)].user;
        
        const subtask = {
          name: subtaskName,
          description: `${subtaskName} for ${module.name}`,
          status: 'not_started',
          priority: module.priority,
          startDate: subtaskStart,
          dueDate: subtaskDue,
          moduleId: module.id,
          assignedUserId: assignedDev.id, // Assigned developer
          assignedDevId: assignedDev.id,
          assignedConsultantId: fcUser.id, // FC as consultant
          createdById: fcUser.id,
          progressPercent: 0
        };
        
        await db.insert(subtasks).values(subtask);
        subtaskCount++;
      }
      console.log(`   ✅ Created ${module.subtasks.length} subtasks for ${module.name}`);
    }
    
    console.log(`✅ Created total of ${subtaskCount} subtasks`);

    // Step 8: Create billing milestones
    console.log('💰 Creating billing milestones...');
    
    for (const milestoneData of MILESTONES_DATA) {
      // Generate random milestone dates
      const milestoneBaseDate = randomDateBetween(PROJECT_START, addDays(PROJECT_END, -60));
      const invoiceDate = addDays(milestoneBaseDate, milestoneData.invoiceOffsetDays);
      const collectionDate = addDays(invoiceDate, milestoneData.collectionOffsetDays);
      
      const milestone = {
        name: milestoneData.name,
        description: milestoneData.description,
        feeAmount: milestoneData.feeAmount,
        billingStatus: 'none',
        expectedInvoiceDate: invoiceDate,
        expectedCollectionDate: collectionDate,
        projectId: project.id,
        createdById: fcUser.id
      };
      
      await db.insert(milestones).values(milestone);
      console.log(`   ✅ Milestone: ${milestoneData.name} - KSh ${milestoneData.feeAmount.toLocaleString()}`);
    }

    console.log('\n🎉 Academic Project Population Complete!');
    console.log(`📊 Summary:`);
    console.log(`   • Project: ${project.name}`);
    console.log(`   • Client: ${projectData.client}`);
    console.log(`   • Timeline: ${PROJECT_START.toDateString()} - ${PROJECT_END.toDateString()}`);
    console.log(`   • Budget: KSh ${projectData.budget.toLocaleString()}`);
    console.log(`   • Phases: ${PHASES.length}`);
    console.log(`   • Modules: ${MODULES_DATA.length}`);
    console.log(`   • Subtasks: ${subtaskCount}`);
    console.log(`   • Milestones: ${MILESTONES_DATA.length}`);
    console.log(`   • Team: ${academicTeam.name} (${teamMembersList.length} members)`);
    console.log(`   • Project Manager: ${fcUser.firstName} ${fcUser.lastName}`);

  } catch (error) {
    console.error('❌ Error during population:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the population
if (require.main === module) {
  populateDatabase()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { populateDatabase };