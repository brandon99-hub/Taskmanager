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
  priority: varchar('priority').notNull().default('medium'),
  feeAmount: decimal('fee_amount', { precision: 12, scale: 2 }),
  billingStatus: varchar('billing_status').notNull().default('none'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
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

// Helper function to add days to a date
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper function to create date from string
function createDate(dateString) {
  return new Date(dateString);
}

// Project timeline - Maseno University ERP System
const PROJECT_START = createDate('2025-09-04');
const PROJECT_END = createDate('2026-12-04');

// Project phases data
const PHASES = [
  {
    phaseNumber: 1,
    phaseType: 'initiation_contracting',
    phaseName: 'Initiation & Contracting',
    description: 'Project setup and contract finalization',
    startDate: createDate('2025-09-04'),
    endDate: createDate('2025-10-15')
  },
  {
    phaseNumber: 2,
    phaseType: 'planning_design',
    phaseName: 'Planning & Design',
    description: 'System architecture and UI/UX design',
    startDate: createDate('2025-10-16'),
    endDate: createDate('2025-12-15')
  },
  {
    phaseNumber: 3,
    phaseType: 'development',
    phaseName: 'Development',
    description: 'Core system development and customization',
    startDate: createDate('2025-12-16'),
    endDate: createDate('2026-08-15')
  },
  {
    phaseNumber: 4,
    phaseType: 'testing',
    phaseName: 'Testing & Quality Assurance',
    description: 'Comprehensive testing and quality assurance',
    startDate: createDate('2026-08-16'),
    endDate: createDate('2026-10-15')
  },
  {
    phaseNumber: 5,
    phaseType: 'deployment',
    phaseName: 'Deployment & Go-Live',
    description: 'System deployment and go-live activities',
    startDate: createDate('2026-10-16'),
    endDate: createDate('2026-11-15')
  },
  {
    phaseNumber: 6,
    phaseType: 'support',
    phaseName: 'Support & Maintenance',
    description: 'Post-launch support and maintenance',
    startDate: createDate('2026-11-16'),
    endDate: createDate('2026-12-04')
  }
];

// Milestones data with priority
const MILESTONES_DATA = [
  // Phase 1 Milestones
  {
    phaseNumber: 1,
    name: 'Project Setup',
    description: 'Initial project setup and stakeholder meetings',
    priority: 'high',
    feeAmount: 1200000,
    startDate: createDate('2025-09-04'),
    endDate: createDate('2025-09-25'),
    expectedInvoiceDate: createDate('2025-10-01'),
    expectedCollectionDate: createDate('2025-10-31'),
    subtasks: [
      {
        name: 'Initial Stakeholder Meeting',
        startDate: createDate('2025-09-04'),
        dueDate: createDate('2025-09-06'),
        estimatedDays: 3,
        priority: 'high'
      },
      {
        name: 'Requirements Gathering',
        startDate: createDate('2025-09-09'),
        dueDate: createDate('2025-09-20'),
        estimatedDays: 10,
        priority: 'critical'
      },
      {
        name: 'Project Charter Approval',
        startDate: createDate('2025-09-23'),
        dueDate: createDate('2025-09-25'),
        estimatedDays: 3,
        priority: 'high'
      }
    ]
  },
  {
    phaseNumber: 1,
    name: 'Contract Finalization',
    description: 'Legal documentation and budget approval',
    priority: 'critical',
    feeAmount: 800000,
    startDate: createDate('2025-09-26'),
    endDate: createDate('2025-10-15'),
    expectedInvoiceDate: createDate('2025-10-20'),
    expectedCollectionDate: createDate('2025-11-19'),
    subtasks: [
      {
        name: 'Legal Documentation',
        startDate: createDate('2025-09-26'),
        dueDate: createDate('2025-10-05'),
        estimatedDays: 8,
        priority: 'critical'
      },
      {
        name: 'Budget Approval',
        startDate: createDate('2025-10-08'),
        dueDate: createDate('2025-10-15'),
        estimatedDays: 6,
        priority: 'high'
      }
    ]
  },
  // Phase 2 Milestones
  {
    phaseNumber: 2,
    name: 'System Architecture',
    description: 'Database design and system architecture',
    priority: 'critical',
    feeAmount: 1800000,
    startDate: createDate('2025-10-16'),
    endDate: createDate('2025-11-15'),
    expectedInvoiceDate: createDate('2025-11-20'),
    expectedCollectionDate: createDate('2025-12-20'),
    subtasks: [
      {
        name: 'Database Design',
        startDate: createDate('2025-10-16'),
        dueDate: createDate('2025-10-30'),
        estimatedDays: 12,
        priority: 'critical'
      },
      {
        name: 'System Architecture',
        startDate: createDate('2025-11-01'),
        dueDate: createDate('2025-11-15'),
        estimatedDays: 12,
        priority: 'critical'
      }
    ]
  },
  {
    phaseNumber: 2,
    name: 'UI/UX Design',
    description: 'Wireframe creation and UI mockups',
    priority: 'high',
    feeAmount: 1200000,
    startDate: createDate('2025-11-16'),
    endDate: createDate('2025-12-15'),
    expectedInvoiceDate: createDate('2025-12-20'),
    expectedCollectionDate: createDate('2026-01-19'),
    subtasks: [
      {
        name: 'Wireframe Creation',
        startDate: createDate('2025-11-16'),
        dueDate: createDate('2025-11-30'),
        estimatedDays: 12,
        priority: 'high'
      },
      {
        name: 'UI Mockups',
        startDate: createDate('2025-12-01'),
        dueDate: createDate('2025-12-15'),
        estimatedDays: 12,
        priority: 'high'
      }
    ]
  },
  // Phase 3 Milestones (with nested modules)
  {
    phaseNumber: 3,
    name: 'Core System Development',
    description: 'User management and student management modules',
    priority: 'critical',
    feeAmount: 4000000,
    startDate: createDate('2025-12-16'),
    endDate: createDate('2026-03-15'),
    expectedInvoiceDate: createDate('2026-03-20'),
    expectedCollectionDate: createDate('2026-04-19'),
    modules: [
      {
        name: 'User Management Module',
        priority: 'critical',
        startDate: createDate('2025-12-16'),
        dueDate: createDate('2026-01-31'),
        subtasks: [
          {
            name: 'User Registration',
            startDate: createDate('2025-12-16'),
            dueDate: createDate('2025-12-30'),
            estimatedDays: 12,
            priority: 'critical'
          },
          {
            name: 'Authentication System',
            startDate: createDate('2026-01-02'),
            dueDate: createDate('2026-01-15'),
            estimatedDays: 12,
            priority: 'critical'
          },
          {
            name: 'Role Management',
            startDate: createDate('2026-01-16'),
            dueDate: createDate('2026-01-31'),
            estimatedDays: 12,
            priority: 'high'
          }
        ]
      },
      {
        name: 'Student Management Module',
        priority: 'high',
        startDate: createDate('2026-02-01'),
        dueDate: createDate('2026-03-15'),
        subtasks: [
          {
            name: 'Student Registration',
            startDate: createDate('2026-02-01'),
            dueDate: createDate('2026-02-15'),
            estimatedDays: 12,
            priority: 'high'
          },
          {
            name: 'Academic Records',
            startDate: createDate('2026-02-16'),
            dueDate: createDate('2026-02-28'),
            estimatedDays: 12,
            priority: 'high'
          },
          {
            name: 'Grade Management',
            startDate: createDate('2026-03-01'),
            dueDate: createDate('2026-03-15'),
            estimatedDays: 12,
            priority: 'high'
          }
        ]
      }
    ]
  },
  {
    phaseNumber: 3,
    name: 'Financial System',
    description: 'Fee management and financial reporting modules',
    priority: 'critical',
    feeAmount: 3500000,
    startDate: createDate('2026-03-16'),
    endDate: createDate('2026-06-15'),
    expectedInvoiceDate: createDate('2026-06-20'),
    expectedCollectionDate: createDate('2026-07-20'),
    modules: [
      {
        name: 'Fee Management Module',
        priority: 'critical',
        startDate: createDate('2026-03-16'),
        dueDate: createDate('2026-05-15'),
        subtasks: [
          {
            name: 'Fee Structure Setup',
            startDate: createDate('2026-03-16'),
            dueDate: createDate('2026-03-31'),
            estimatedDays: 12,
            priority: 'critical'
          },
          {
            name: 'Payment Processing',
            startDate: createDate('2026-04-01'),
            dueDate: createDate('2026-04-30'),
            estimatedDays: 20,
            priority: 'critical'
          },
          {
            name: 'Receipt Generation',
            startDate: createDate('2026-05-01'),
            dueDate: createDate('2026-05-15'),
            estimatedDays: 12,
            priority: 'high'
          }
        ]
      },
      {
        name: 'Financial Reporting Module',
        priority: 'high',
        startDate: createDate('2026-05-16'),
        dueDate: createDate('2026-06-15'),
        subtasks: [
          {
            name: 'Report Templates',
            startDate: createDate('2026-05-16'),
            dueDate: createDate('2026-05-31'),
            estimatedDays: 12,
            priority: 'high'
          },
          {
            name: 'Dashboard Creation',
            startDate: createDate('2026-06-01'),
            dueDate: createDate('2026-06-15'),
            estimatedDays: 12,
            priority: 'high'
          }
        ]
      }
    ]
  },
  {
    phaseNumber: 3,
    name: 'Academic Management',
    description: 'Course management and library management modules',
    priority: 'high',
    feeAmount: 2500000,
    startDate: createDate('2026-06-16'),
    endDate: createDate('2026-08-15'),
    expectedInvoiceDate: createDate('2026-08-20'),
    expectedCollectionDate: createDate('2026-09-19'),
    modules: [
      {
        name: 'Course Management Module',
        priority: 'high',
        startDate: createDate('2026-06-16'),
        dueDate: createDate('2026-07-31'),
        subtasks: [
          {
            name: 'Course Registration',
            startDate: createDate('2026-06-16'),
            dueDate: createDate('2026-06-30'),
            estimatedDays: 12,
            priority: 'high'
          },
          {
            name: 'Timetable Management',
            startDate: createDate('2026-07-01'),
            dueDate: createDate('2026-07-15'),
            estimatedDays: 12,
            priority: 'high'
          },
          {
            name: 'Exam Scheduling',
            startDate: createDate('2026-07-16'),
            dueDate: createDate('2026-07-31'),
            estimatedDays: 12,
            priority: 'high'
          }
        ]
      },
      {
        name: 'Library Management Module',
        priority: 'medium',
        startDate: createDate('2026-08-01'),
        dueDate: createDate('2026-08-15'),
        subtasks: [
          {
            name: 'Book Catalog',
            startDate: createDate('2026-08-01'),
            dueDate: createDate('2026-08-08'),
            estimatedDays: 6,
            priority: 'medium'
          },
          {
            name: 'Borrowing System',
            startDate: createDate('2026-08-09'),
            dueDate: createDate('2026-08-15'),
            estimatedDays: 6,
            priority: 'medium'
          }
        ]
      }
    ]
  },
  // Phase 4 Milestones
  {
    phaseNumber: 4,
    name: 'System Testing',
    description: 'Unit testing and integration testing',
    priority: 'high',
    feeAmount: 1200000,
    startDate: createDate('2026-08-16'),
    endDate: createDate('2026-09-15'),
    expectedInvoiceDate: createDate('2026-09-20'),
    expectedCollectionDate: createDate('2026-10-20'),
    subtasks: [
      {
        name: 'Unit Testing',
        startDate: createDate('2026-08-16'),
        dueDate: createDate('2026-08-31'),
        estimatedDays: 12,
        priority: 'high'
      },
      {
        name: 'Integration Testing',
        startDate: createDate('2026-09-01'),
        dueDate: createDate('2026-09-15'),
        estimatedDays: 12,
        priority: 'high'
      }
    ]
  },
  {
    phaseNumber: 4,
    name: 'User Acceptance Testing',
    description: 'UAT planning and user training',
    priority: 'critical',
    feeAmount: 800000,
    startDate: createDate('2026-09-16'),
    endDate: createDate('2026-10-15'),
    expectedInvoiceDate: createDate('2026-10-20'),
    expectedCollectionDate: createDate('2026-11-19'),
    subtasks: [
      {
        name: 'UAT Planning',
        startDate: createDate('2026-09-16'),
        dueDate: createDate('2026-09-30'),
        estimatedDays: 12,
        priority: 'critical'
      },
      {
        name: 'User Training',
        startDate: createDate('2026-10-01'),
        dueDate: createDate('2026-10-15'),
        estimatedDays: 12,
        priority: 'critical'
      }
    ]
  },
  // Phase 5 Milestones
  {
    phaseNumber: 5,
    name: 'Production Deployment',
    description: 'Server setup and data migration',
    priority: 'critical',
    feeAmount: 500000,
    startDate: createDate('2026-10-16'),
    endDate: createDate('2026-10-31'),
    expectedInvoiceDate: createDate('2026-11-05'),
    expectedCollectionDate: createDate('2026-12-05'),
    subtasks: [
      {
        name: 'Server Setup',
        startDate: createDate('2026-10-16'),
        dueDate: createDate('2026-10-25'),
        estimatedDays: 8,
        priority: 'critical'
      },
      {
        name: 'Data Migration',
        startDate: createDate('2026-10-26'),
        dueDate: createDate('2026-10-31'),
        estimatedDays: 5,
        priority: 'critical'
      }
    ]
  },
  {
    phaseNumber: 5,
    name: 'Go-Live Support',
    description: 'Live system monitoring and issue resolution',
    priority: 'high',
    feeAmount: 300000,
    startDate: createDate('2026-11-01'),
    endDate: createDate('2026-11-15'),
    expectedInvoiceDate: createDate('2026-11-20'),
    expectedCollectionDate: createDate('2026-12-20'),
    subtasks: [
      {
        name: 'Live System Monitoring',
        startDate: createDate('2026-11-01'),
        dueDate: createDate('2026-11-08'),
        estimatedDays: 6,
        priority: 'high'
      },
      {
        name: 'Issue Resolution',
        startDate: createDate('2026-11-09'),
        dueDate: createDate('2026-11-15'),
        estimatedDays: 6,
        priority: 'high'
      }
    ]
  },
  // Phase 6 Milestones
  {
    phaseNumber: 6,
    name: 'Post-Launch Support',
    description: 'Bug fixes and performance optimization',
    priority: 'medium',
    feeAmount: 200000,
    startDate: createDate('2026-11-16'),
    endDate: createDate('2026-12-04'),
    expectedInvoiceDate: createDate('2026-12-10'),
    expectedCollectionDate: createDate('2027-01-09'),
    subtasks: [
      {
        name: 'Bug Fixes',
        startDate: createDate('2026-11-16'),
        dueDate: createDate('2026-11-30'),
        estimatedDays: 12,
        priority: 'medium'
      },
      {
        name: 'Performance Optimization',
        startDate: createDate('2026-12-01'),
        dueDate: createDate('2026-12-04'),
        estimatedDays: 3,
        priority: 'medium'
      }
    ]
  }
];

async function populateDatabase() {
  console.log('🚀 Starting Maseno University ERP System Project Population...');

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
    console.log('📋 Creating Maseno University ERP System project...');
    const projectData = {
      name: 'Maseno University ERP System',
      description: 'Comprehensive ERP system for Maseno University including student management, financial systems, and academic management',
      client: 'Maseno University',
      contactPerson: 'Prof. Sarah Kemunto',
      contactPhone: '+254 700 123 456',
      contactEmail: 'sarah.kemunto@maseno.ac.ke',
      startDate: PROJECT_START,
      endDate: PROJECT_END,
      status: 'planning',
      segment: 'academic',
      budget: 18000000,
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
        startDate: phaseData.startDate,
        endDate: phaseData.endDate,
        status: 'not_started',
        progress: 0
      };
      
      const [createdPhase] = await db.insert(projectPhases).values(phase).returning();
      createdPhases.push(createdPhase);
      console.log(`   ✅ Phase ${phaseData.phaseNumber}: ${phaseData.phaseName}`);
    }

    // Step 6: Create milestones and modules
    console.log('💰 Creating milestones and modules...');
    let totalModules = 0;
    let totalSubtasks = 0;
    
    for (const milestoneData of MILESTONES_DATA) {
      // Create milestone
      const milestone = {
        name: milestoneData.name,
        description: milestoneData.description,
        priority: milestoneData.priority,
        feeAmount: milestoneData.feeAmount,
        billingStatus: 'none',
        startDate: milestoneData.startDate,
        endDate: milestoneData.endDate,
        expectedInvoiceDate: milestoneData.expectedInvoiceDate,
        expectedCollectionDate: milestoneData.expectedCollectionDate,
        projectId: project.id,
        createdById: fcUser.id
      };
      
      const [createdMilestone] = await db.insert(milestones).values(milestone).returning();
      console.log(`   ✅ Milestone: ${milestoneData.name} - KSh ${milestoneData.feeAmount.toLocaleString()}`);
      
      // Handle Phase 3 nested modules
      if (milestoneData.modules) {
        for (const moduleData of milestoneData.modules) {
          const module = {
            name: moduleData.name,
            description: `${moduleData.name} for ${milestoneData.name}`,
            priority: moduleData.priority,
            status: 'not_started',
            startDate: moduleData.startDate,
            dueDate: moduleData.dueDate,
            projectId: project.id,
            phaseNumber: milestoneData.phaseNumber,
            phaseName: PHASES.find(p => p.phaseNumber === milestoneData.phaseNumber).phaseName,
            phase: PHASES.find(p => p.phaseNumber === milestoneData.phaseNumber).phaseName,
            assignedUserId: null,
            assignedTeamId: academicTeam.id,
            createdById: fcUser.id,
            progressPercent: 0
          };
          
          const [createdModule] = await db.insert(modules).values(module).returning();
          totalModules++;
          
          // Create subtasks for this module
          for (const subtaskData of moduleData.subtasks) {
            // Randomly assign one of the two developers
            const assignedDev = developers[Math.floor(Math.random() * developers.length)].user;
            
            const subtask = {
              name: subtaskData.name,
              description: `${subtaskData.name} for ${moduleData.name}`,
              status: 'not_started',
              priority: subtaskData.priority,
              startDate: subtaskData.startDate,
              dueDate: subtaskData.dueDate,
              moduleId: createdModule.id,
              assignedUserId: assignedDev.id,
              assignedDevId: assignedDev.id,
              assignedConsultantId: fcUser.id,
              createdById: fcUser.id,
              progressPercent: 0
            };
            
            await db.insert(subtasks).values(subtask);
            totalSubtasks++;
          }
          
          console.log(`      ✅ Module: ${moduleData.name} (${moduleData.subtasks.length} subtasks)`);
        }
      } else {
        // Handle regular phases (1,2,4,5,6) - create modules directly
        const module = {
          name: milestoneData.name,
          description: milestoneData.description,
          priority: milestoneData.priority,
          status: 'not_started',
          startDate: milestoneData.startDate,
          dueDate: milestoneData.endDate,
          projectId: project.id,
          phaseNumber: milestoneData.phaseNumber,
          phaseName: PHASES.find(p => p.phaseNumber === milestoneData.phaseNumber).phaseName,
          phase: PHASES.find(p => p.phaseNumber === milestoneData.phaseNumber).phaseName,
          assignedUserId: null,
          assignedTeamId: academicTeam.id,
          createdById: fcUser.id,
          progressPercent: 0
        };
        
        const [createdModule] = await db.insert(modules).values(module).returning();
        totalModules++;
        
        // Create subtasks for this module
        for (const subtaskData of milestoneData.subtasks) {
          // Randomly assign one of the two developers
          const assignedDev = developers[Math.floor(Math.random() * developers.length)].user;
          
          const subtask = {
            name: subtaskData.name,
            description: `${subtaskData.name} for ${milestoneData.name}`,
            status: 'not_started',
            priority: subtaskData.priority,
            startDate: subtaskData.startDate,
            dueDate: subtaskData.dueDate,
            moduleId: createdModule.id,
            assignedUserId: assignedDev.id,
            assignedDevId: assignedDev.id,
            assignedConsultantId: fcUser.id,
            createdById: fcUser.id,
            progressPercent: 0
          };
          
          await db.insert(subtasks).values(subtask);
          totalSubtasks++;
        }
        
        console.log(`      ✅ Module: ${milestoneData.name} (${milestoneData.subtasks.length} subtasks)`);
      }
    }

    console.log('\n🎉 Maseno University ERP System Project Population Complete!');
    console.log(`📊 Summary:`);
    console.log(`   • Project: ${project.name}`);
    console.log(`   • Client: ${projectData.client}`);
    console.log(`   • Contact: ${projectData.contactPerson} (${projectData.contactEmail})`);
    console.log(`   • Timeline: ${PROJECT_START.toDateString()} - ${PROJECT_END.toDateString()}`);
    console.log(`   • Budget: KSh ${projectData.budget.toLocaleString()}`);
    console.log(`   • Phases: ${PHASES.length}`);
    console.log(`   • Milestones: ${MILESTONES_DATA.length}`);
    console.log(`   • Modules: ${totalModules}`);
    console.log(`   • Subtasks: ${totalSubtasks}`);
    console.log(`   • Team: ${academicTeam.name} (${teamMembersList.length} members)`);
    console.log(`   • Project Manager: ${fcUser.firstName} ${fcUser.lastName}`);
    console.log(`   • Developers: ${developers.map(d => d.user.firstName).join(', ')}`);

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
