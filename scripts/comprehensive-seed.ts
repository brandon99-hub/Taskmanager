import 'dotenv/config';
import { db } from "../server/db";
import { 
  users, 
  teams, 
  projects, 
  tasks, 
  teamMembers, 
  segmentLeaders, 
  employeeRoles, 
  teamMemberRoles, 
  externalNotificationRecipients,
  notifications,
  userNotificationPreferences
} from "../shared/schema";
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';

// Comprehensive Seed Data Configuration
const SEED_DATA = {
  // Employee roles
  employeeRoles: [
    { roleName: "Business Central Developer", description: "Develops and maintains Business Central solutions" },
    { roleName: "Functional Consultant", description: "Provides functional consulting and business analysis" },
    { roleName: "Portal Developer", description: "Develops web portals and user interfaces" },
    { roleName: "Account Manager", description: "Manages client relationships and project delivery" },
    { roleName: "Project Leader", description: "Leads project teams and ensures delivery" }
  ],

  // Segment leaders
  segmentLeaders: [
    { segment: "academic", leaderEmail: "academic.leader@taskflow.com", leaderName: "Dr. Sarah Johnson" },
    { segment: "parastals", leaderEmail: "parastals.leader@taskflow.com", leaderName: "Mr. James Mwangi" },
    { segment: "private", leaderEmail: "private.leader@taskflow.com", leaderName: "Ms. Grace Ochieng" }
  ],

  // External notification recipients
  externalNotificationRecipients: [
    { type: "finance", email: "finance@taskflow.com" },
    { type: "account_manager", email: "account.manager@taskflow.com" }
  ],

  // Comprehensive user list with specific roles
  users: [
    // BC Developers
    {
      email: "john.bcdev@taskflow.com",
      password: "BCDev123!",
      firstName: "John",
      lastName: "Kamau",
      role: "employee" as const
    },
    {
      email: "mary.bcdev@taskflow.com",
      password: "BCDev123!",
      firstName: "Mary",
      lastName: "Wanjiku",
      role: "employee" as const
    },
    {
      email: "peter.bcdev@taskflow.com",
      password: "BCDev123!",
      firstName: "Peter",
      lastName: "Ochieng",
      role: "employee" as const
    },
    {
      email: "faith.bcdev@taskflow.com",
      password: "BCDev123!",
      firstName: "Faith",
      lastName: "Akinyi",
      role: "employee" as const
    },

    // Functional Consultants
    {
      email: "david.consultant@taskflow.com",
      password: "Consultant123!",
      firstName: "David",
      lastName: "Muthoni",
      role: "employee" as const
    },
    {
      email: "lisa.consultant@taskflow.com",
      password: "Consultant123!",
      firstName: "Lisa",
      lastName: "Wambui",
      role: "employee" as const
    },
    {
      email: "kevin.consultant@taskflow.com",
      password: "Consultant123!",
      firstName: "Kevin",
      lastName: "Odhiambo",
      role: "employee" as const
    },
    {
      email: "nancy.consultant@taskflow.com",
      password: "Consultant123!",
      firstName: "Nancy",
      lastName: "Achieng",
      role: "employee" as const
    },
    {
      email: "robert.consultant@taskflow.com",
      password: "Consultant123!",
      firstName: "Robert",
      lastName: "Ouma",
      role: "employee" as const
    },
    {
      email: "susan.consultant@taskflow.com",
      password: "Consultant123!",
      firstName: "Susan",
      lastName: "Atieno",
      role: "employee" as const
    },

    // Portal Developers
    {
      email: "alex.portal@taskflow.com",
      password: "Portal123!",
      firstName: "Alex",
      lastName: "Kiprop",
      role: "employee" as const
    },
    {
      email: "emma.portal@taskflow.com",
      password: "Portal123!",
      firstName: "Emma",
      lastName: "Chebet",
      role: "employee" as const
    },
    {
      email: "daniel.portal@taskflow.com",
      password: "Portal123!",
      firstName: "Daniel",
      lastName: "Kipchirchir",
      role: "employee" as const
    },

    // Account Managers
    {
      email: "sarah.account@taskflow.com",
      password: "Account123!",
      firstName: "Sarah",
      lastName: "Ngeno",
      role: "employee" as const
    },
    {
      email: "michael.account@taskflow.com",
      password: "Account123!",
      firstName: "Michael",
      lastName: "Kipngetich",
      role: "employee" as const
    },
    {
      email: "jennifer.account@taskflow.com",
      password: "Account123!",
      firstName: "Jennifer",
      lastName: "Chepkoech",
      role: "employee" as const
    },

    // Project Leaders
    {
      email: "brian.leader@taskflow.com",
      password: "Leader123!",
      firstName: "Brian",
      lastName: "Kiprotich",
      role: "manager" as const
    },
    {
      email: "rachel.leader@taskflow.com",
      password: "Leader123!",
      firstName: "Rachel",
      lastName: "Jepchirchir",
      role: "manager" as const
    },

    // Additional managers
    {
      email: "admin@taskflow.com",
      password: "Admin123!",
      firstName: "System",
      lastName: "Administrator",
      role: "admin" as const
    }
  ],

  // Teams for each segment
  teams: [
    // Academic Segment Teams
    {
      name: "Academic Team Alpha",
      description: "Primary team for academic institution projects",
      segment: "academic" as const
    },
    {
      name: "Academic Team Beta",
      description: "Secondary team for academic institution projects",
      segment: "academic" as const
    },

    // Parastals Segment Teams
    {
      name: "Parastals Team Alpha",
      description: "Primary team for government parastatal projects",
      segment: "parastals" as const
    },
    {
      name: "Parastals Team Beta",
      description: "Secondary team for government parastatal projects",
      segment: "parastals" as const
    },

    // Private Segment Teams
    {
      name: "Private Team Alpha",
      description: "Primary team for private sector projects",
      segment: "private" as const
    },
    {
      name: "Private Team Beta",
      description: "Secondary team for private sector projects",
      segment: "private" as const
    },
    {
      name: "Private Team Gamma",
      description: "Tertiary team for private sector projects",
      segment: "private" as const
    }
  ]
};

// Team composition mapping
const TEAM_COMPOSITIONS = [
  // Academic Team Alpha
  {
    teamName: "Academic Team Alpha",
    members: [
      { email: "john.bcdev@taskflow.com", role: "Business Central Developer" },
      { email: "david.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "lisa.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "alex.portal@taskflow.com", role: "Portal Developer" },
      { email: "sarah.account@taskflow.com", role: "Account Manager" },
      { email: "brian.leader@taskflow.com", role: "Project Leader" }
    ]
  },

  // Academic Team Beta
  {
    teamName: "Academic Team Beta",
    members: [
      { email: "mary.bcdev@taskflow.com", role: "Business Central Developer" },
      { email: "kevin.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "nancy.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "emma.portal@taskflow.com", role: "Portal Developer" },
      { email: "michael.account@taskflow.com", role: "Account Manager" },
      { email: "rachel.leader@taskflow.com", role: "Project Leader" }
    ]
  },

  // Parastals Team Alpha
  {
    teamName: "Parastals Team Alpha",
    members: [
      { email: "peter.bcdev@taskflow.com", role: "Business Central Developer" },
      { email: "robert.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "susan.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "daniel.portal@taskflow.com", role: "Portal Developer" },
      { email: "jennifer.account@taskflow.com", role: "Account Manager" },
      { email: "brian.leader@taskflow.com", role: "Project Leader" }
    ]
  },

  // Parastals Team Beta
  {
    teamName: "Parastals Team Beta",
    members: [
      { email: "faith.bcdev@taskflow.com", role: "Business Central Developer" },
      { email: "david.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "lisa.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "alex.portal@taskflow.com", role: "Portal Developer" },
      { email: "sarah.account@taskflow.com", role: "Account Manager" },
      { email: "rachel.leader@taskflow.com", role: "Project Leader" }
    ]
  },

  // Private Team Alpha
  {
    teamName: "Private Team Alpha",
    members: [
      { email: "john.bcdev@taskflow.com", role: "Business Central Developer" },
      { email: "kevin.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "nancy.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "emma.portal@taskflow.com", role: "Portal Developer" },
      { email: "michael.account@taskflow.com", role: "Account Manager" },
      { email: "brian.leader@taskflow.com", role: "Project Leader" }
    ]
  },

  // Private Team Beta
  {
    teamName: "Private Team Beta",
    members: [
      { email: "mary.bcdev@taskflow.com", role: "Business Central Developer" },
      { email: "robert.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "susan.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "daniel.portal@taskflow.com", role: "Portal Developer" },
      { email: "jennifer.account@taskflow.com", role: "Account Manager" },
      { email: "rachel.leader@taskflow.com", role: "Project Leader" }
    ]
  },

  // Private Team Gamma
  {
    teamName: "Private Team Gamma",
    members: [
      { email: "peter.bcdev@taskflow.com", role: "Business Central Developer" },
      { email: "david.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "lisa.consultant@taskflow.com", role: "Functional Consultant" },
      { email: "alex.portal@taskflow.com", role: "Portal Developer" },
      { email: "sarah.account@taskflow.com", role: "Account Manager" },
      { email: "brian.leader@taskflow.com", role: "Project Leader" }
    ]
  }
];

// Project segment distribution (randomize existing projects)
const PROJECT_SEGMENTS = [
  "academic", "academic", "academic", "academic", "academic", "academic", "academic", "academic",
  "parastals", "parastals", "parastals", "parastals", "parastals", "parastals", "parastals", "parastals",
  "private", "private", "private", "private", "private", "private", "private", "private", "private", "private", "private", "private"
];

// Project status distribution
const PROJECT_STATUSES = [
  "active", "active", "active", "active", "active", "active", "active", "active",
  "planning", "planning", "planning", "planning",
  "on_support", "on_support", "on_support",
  "completed", "completed", "completed",
  "cancelled", "cancelled"
];

// Milestone status distribution
const MILESTONE_STATUSES = [
  "todo", "todo", "todo", "todo", "todo", "todo", "todo", "todo",
  "in_progress", "in_progress", "in_progress", "in_progress", "in_progress", "in_progress",
  "qa", "qa", "qa", "qa",
  "client_review", "client_review", "client_review",
  "done", "done", "done", "done", "done", "done", "done", "done", "done", "done",
  "delayed", "delayed", "delayed",
  "on_hold", "on_hold", "on_hold",
  "cancelled", "cancelled"
];

// Billing status distribution
const BILLING_STATUSES = [
  "none", "none", "none", "none", "none", "none", "none", "none", "none", "none",
  "sent", "sent", "sent", "sent", "sent", "sent", "sent", "sent",
  "processing", "processing", "processing", "processing", "processing", "processing",
  "paid", "paid", "paid", "paid", "paid", "paid", "paid", "paid", "paid", "paid"
];

// Priority distribution
const PRIORITIES = [
  "low", "low", "low", "low", "low",
  "medium", "medium", "medium", "medium", "medium", "medium", "medium", "medium", "medium", "medium",
  "high", "high", "high", "high", "high", "high", "high", "high",
  "critical", "critical", "critical", "critical", "critical"
];

async function seedDatabase() {
  console.log('🌱 Starting comprehensive database seeding...');

  try {
    // 1. Seed employee roles
    console.log('📋 Seeding employee roles...');
    for (const role of SEED_DATA.employeeRoles) {
      await db.insert(employeeRoles).values(role).onConflictDoNothing();
    }

    // 2. Seed segment leaders
    console.log('👥 Seeding segment leaders...');
    for (const leader of SEED_DATA.segmentLeaders) {
      await db.insert(segmentLeaders).values(leader).onConflictDoNothing();
    }

    // 3. Seed external notification recipients
    console.log('📧 Seeding external notification recipients...');
    for (const recipient of SEED_DATA.externalNotificationRecipients) {
      await db.insert(externalNotificationRecipients).values(recipient).onConflictDoNothing();
    }

    // 4. Seed users with hashed passwords (skip existing ones)
    console.log('👤 Seeding users...');
    const createdUsers: { [key: string]: any } = {};
    
    for (const user of SEED_DATA.users) {
      try {
        // Check if user already exists
        const existingUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
        
        if (existingUser.length > 0) {
          console.log(`⚠️  User ${user.email} already exists, skipping...`);
          createdUsers[user.email] = existingUser[0];
          continue;
        }
        
        const hashedPassword = await bcrypt.hash(user.password, 12);
        const [createdUser] = await db.insert(users).values({
          ...user,
          password: hashedPassword,
          isActive: true
        }).returning();
        
        if (createdUser) {
          createdUsers[user.email] = createdUser;
          console.log(`✅ Created user: ${user.email}`);
        }
      } catch (error) {
        console.log(`⚠️  Error creating user ${user.email}: ${error}`);
        // Try to get existing user if insert failed
        const existingUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
        if (existingUser.length > 0) {
          createdUsers[user.email] = existingUser[0];
        }
      }
    }

    // 5. Seed teams (skip existing ones)
    console.log('🏢 Seeding teams...');
    const createdTeams: { [key: string]: any } = {};
    
    for (const team of SEED_DATA.teams) {
      try {
        // Check if team already exists
        const existingTeam = await db.select().from(teams).where(eq(teams.name, team.name)).limit(1);
        
        if (existingTeam.length > 0) {
          console.log(`⚠️  Team ${team.name} already exists, skipping...`);
          createdTeams[team.name] = existingTeam[0];
          continue;
        }
        
        const [createdTeam] = await db.insert(teams).values(team).returning();
        if (createdTeam) {
          createdTeams[team.name] = createdTeam;
          console.log(`✅ Created team: ${team.name}`);
        }
      } catch (error) {
        console.log(`⚠️  Error creating team ${team.name}: ${error}`);
        // Try to get existing team if insert failed
        const existingTeam = await db.select().from(teams).where(eq(teams.name, team.name)).limit(1);
        if (existingTeam.length > 0) {
          createdTeams[team.name] = existingTeam[0];
        }
      }
    }

    // 6. Create team members and assign roles
    console.log('👥 Creating team members and assigning roles...');
    
    for (const teamComposition of TEAM_COMPOSITIONS) {
      const team = createdTeams[teamComposition.teamName];
      if (!team) continue;

      for (const member of teamComposition.members) {
        const user = createdUsers[member.email];
        if (!user) continue;

        // Add team member
        const [teamMember] = await db.insert(teamMembers).values({
          teamId: team.id,
          userId: user.id,
          role: member.role
        }).returning();

        if (teamMember) {
          // Find the role ID
          const [roleRecord] = await db.select().from(employeeRoles).where(eq(employeeRoles.roleName, member.role));
          
          if (roleRecord) {
            // Assign role to team member
            await db.insert(teamMemberRoles).values({
              teamMemberId: teamMember.id,
              roleId: roleRecord.id
            }).onConflictDoNothing();
          }
        }
      }
    }

    // 7. Update existing projects with realistic data
    console.log('📊 Updating existing projects with realistic data...');
    const existingProjects = await db.select().from(projects);
    
    for (let i = 0; i < existingProjects.length; i++) {
      const project = existingProjects[i];
      const segment = PROJECT_SEGMENTS[i % PROJECT_SEGMENTS.length];
      const status = PROJECT_STATUSES[i % PROJECT_STATUSES.length];
      const team = Object.values(createdTeams)[i % Object.keys(createdTeams).length];
      
      // Generate realistic dates
      const startDate = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + Math.floor(Math.random() * 6) + 3);
      
             // Set project to on_support only if it has completed milestones
       let finalStatus = status;
       if (status === 'on_support') {
         const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, project.id));
         const allCompleted = projectTasks.every(task => task.status === 'done');
         if (!allCompleted) {
           finalStatus = 'active';
         }
       }
       
       // Ensure we have a valid manager ID
       const managerId = Object.values(createdUsers).find(u => u.role === 'manager')?.id || 
                        Object.values(createdUsers).find(u => u.role === 'admin')?.id || 
                        project.managerId;

      await db.update(projects).set({
        segment: segment as any,
        status: finalStatus as any,
        startDate: startDate,
        endDate: endDate,
        teamId: team?.id || null,
        managerId: Object.values(createdUsers).find(u => u.role === 'manager')?.id || project.managerId,
        contactPerson: `Contact Person ${i + 1}`,
        contactPhone: `+2547${Math.floor(Math.random() * 90000000) + 10000000}`,
        contactEmail: `contact${i + 1}@client${i + 1}.com`
      }).where(eq(projects.id, project.id));
    }

    // 8. Update existing milestones with realistic data
    console.log('📋 Updating existing milestones with realistic data...');
    const existingTasks = await db.select().from(tasks);
    
    for (let i = 0; i < existingTasks.length; i++) {
      const task = existingTasks[i];
      const status = MILESTONE_STATUSES[i % MILESTONE_STATUSES.length];
      const billingStatus = BILLING_STATUSES[i % BILLING_STATUSES.length];
      const priority = PRIORITIES[i % PRIORITIES.length];
      
      // Generate realistic dates
      const dueDate = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
      const expectedInvoiceDate = new Date(dueDate);
      expectedInvoiceDate.setDate(expectedInvoiceDate.getDate() + Math.floor(Math.random() * 30) + 7);
      
      // Set fee amount based on priority
      const feeAmount = priority === 'low' ? 5000 : 
                       priority === 'medium' ? 10000 : 
                       priority === 'high' ? 20000 : 35000;
      
      // Set billing status logic
      let finalBillingStatus = billingStatus;
      if (status === 'done' && billingStatus === 'none') {
        finalBillingStatus = 'sent';
      } else if (status !== 'done' && billingStatus === 'paid') {
        finalBillingStatus = 'none';
      }

      await db.update(tasks).set({
        status: status as any,
        priority: priority as any,
        dueDate: dueDate,
        feeAmount: feeAmount.toString(),
        billingStatus: finalBillingStatus as any,
        expectedInvoiceDate: expectedInvoiceDate,
        weight: priority === 'low' ? 1 : priority === 'medium' ? 2 : priority === 'high' ? 3 : 4,
        assignedUserId: Object.values(createdUsers).find(u => u.role === 'employee')?.id || null
      }).where(eq(tasks.id, task.id));
    }

    // 9. Create notification preferences for all users
    console.log('🔔 Creating notification preferences for users...');
    for (const user of Object.values(createdUsers)) {
      await db.insert(userNotificationPreferences).values({
        userId: user.id,
        emailTaskAssigned: true,
        emailTaskDueSoon: true,
        emailTaskOverdue: true,
        emailProjectDeadline: true,
        emailTeamUpdates: false,
        inAppTaskAssigned: true,
        inAppTaskDueSoon: true,
        inAppTaskOverdue: true,
        inAppProjectDeadline: true,
        inAppTeamUpdates: true,
        dueSoonDays: 2,
        reminderTime: '09:00'
      }).onConflictDoNothing();
    }

    console.log('✅ Comprehensive database seeding completed successfully!');
    console.log(`📊 Created ${Object.keys(createdUsers).length} users`);
    console.log(`🏢 Created ${Object.keys(createdTeams).length} teams`);
    console.log(`📋 Updated ${existingProjects.length} projects`);
    console.log(`📝 Updated ${existingTasks.length} milestones`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

// Run the seeding
seedDatabase()
  .then(() => {
    console.log('🎉 Seeding completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });

export { seedDatabase };
