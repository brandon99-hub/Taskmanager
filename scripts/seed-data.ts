import 'dotenv/config';
import { db } from "../server/db";
import { users, teams, projects, tasks, teamMembers, notifications } from "../shared/schema";
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';

// Seed Data Configuration
const SEED_DATA = {
  // Sample users (admin is excluded since it should already exist)
  users: [
    {
      email: "john.manager@taskflow.com",
      password: "Manager123!",
      firstName: "John",
      lastName: "Manager",
      role: "manager" as const
    },
    {
      email: "jane.dev@taskflow.com",
      password: "Developer123!",
      firstName: "Jane",
      lastName: "Developer",
      role: "employee" as const
    },
    {
      email: "mike.designer@taskflow.com",
      password: "Designer123!",
      firstName: "Mike",
      lastName: "Designer",
      role: "employee" as const
    },
    {
      email: "sarah.qa@taskflow.com",
      password: "QA123!",
      firstName: "Sarah",
      lastName: "QA Engineer",
      role: "employee" as const
    },
    {
      email: "alex.lead@taskflow.com",
      password: "TeamLead123!",
      firstName: "Alex",
      lastName: "Team Lead",
      role: "manager" as const
    }
  ],

  // Sample teams
  teams: [
    {
      name: "Frontend Development",
      description: "Responsible for user interface and user experience development"
    },
    {
      name: "Backend Development", 
      description: "Handles server-side logic, APIs, and database management"
    },
    {
      name: "Design Team",
      description: "Creates UI/UX designs, wireframes, and visual assets"
    },
    {
      name: "Quality Assurance",
      description: "Tests applications, finds bugs, and ensures quality standards"
    }
  ],

  // Sample projects
  projects: [
    {
      name: "TaskFlow Dashboard Redesign",
      description: "Complete redesign of the main dashboard with improved UX and modern design patterns",
      client: "Internal Project",
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-03-30'),
      budget: 25000,
      status: "active" as const
    },
    {
      name: "Mobile App Development",
      description: "Native mobile application for iOS and Android platforms with offline capabilities",
      client: "AppKings Mobile Division",
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-06-15'),
      budget: 75000,
      status: "planning" as const
    },
    {
      name: "API Performance Optimization",
      description: "Optimize existing APIs for better performance and scalability",
      client: "Technical Debt",
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-28'),
      budget: 15000,
      status: "active" as const
    },
    {
      name: "Customer Portal",
      description: "Self-service portal for customers to manage their accounts and view reports",
      client: "External Client - TechCorp",
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-05-31'),
      budget: 45000,
      status: "planning" as const
    }
  ],

  // Sample tasks with various statuses and priorities
  tasks: [
    // TaskFlow Dashboard Redesign tasks
    {
      name: "Create wireframes for new dashboard",
      description: "Design wireframes for the redesigned dashboard layout focusing on improved user flow",
      priority: "high" as const,
      status: "done" as const,
      startDate: new Date('2024-01-15'),
      dueDate: new Date('2024-01-25'),
      estimatedHours: 16,
      actualHours: 18
    },
    {
      name: "Implement responsive grid system",
      description: "Develop a flexible grid system that works across all device sizes",
      priority: "high" as const,
      status: "in_progress" as const,
      startDate: new Date('2024-01-26'),
      dueDate: new Date('2024-02-10'),
      estimatedHours: 32,
      actualHours: 20
    },
    {
      name: "Add dark mode support",
      description: "Implement dark mode theme with proper color contrast and accessibility",
      priority: "medium" as const,
      status: "todo" as const,
      startDate: new Date('2024-02-11'),
      dueDate: new Date('2024-02-25'),
      estimatedHours: 24
    },
    {
      name: "Performance testing and optimization",
      description: "Test dashboard performance and optimize loading times",
      priority: "medium" as const,
      status: "todo" as const,
      startDate: new Date('2024-03-01'),
      dueDate: new Date('2024-03-15'),
      estimatedHours: 20
    },

    // Mobile App Development tasks
    {
      name: "Setup React Native project structure",
      description: "Initialize React Native project with proper folder structure and dependencies",
      priority: "critical" as const,
      status: "done" as const,
      startDate: new Date('2024-02-01'),
      dueDate: new Date('2024-02-05'),
      estimatedHours: 8,
      actualHours: 6
    },
    {
      name: "Design mobile UI components",
      description: "Create reusable UI components following mobile design guidelines",
      priority: "high" as const,
      status: "in_progress" as const,
      startDate: new Date('2024-02-06'),
      dueDate: new Date('2024-02-20'),
      estimatedHours: 40,
      actualHours: 25
    },
    {
      name: "Implement offline data synchronization",
      description: "Develop offline capabilities with data sync when connection is restored",
      priority: "high" as const,
      status: "todo" as const,
      startDate: new Date('2024-02-21'),
      dueDate: new Date('2024-03-15'),
      estimatedHours: 48
    },

    // API Performance Optimization tasks
    {
      name: "Database query optimization",
      description: "Optimize slow database queries and add proper indexing",
      priority: "critical" as const,
      status: "review" as const,
      startDate: new Date('2024-01-01'),
      dueDate: new Date('2024-01-15'),
      estimatedHours: 24,
      actualHours: 28
    },
    {
      name: "Implement API caching strategy",
      description: "Add Redis caching for frequently accessed endpoints",
      priority: "high" as const,
      status: "in_progress" as const,
      startDate: new Date('2024-01-16'),
      dueDate: new Date('2024-02-01'),
      estimatedHours: 32,
      actualHours: 20
    },
    {
      name: "Load testing and monitoring setup",
      description: "Setup load testing and monitoring tools for API performance tracking",
      priority: "medium" as const,
      status: "todo" as const,
      startDate: new Date('2024-02-02'),
      dueDate: new Date('2024-02-20'),
      estimatedHours: 16
    }
  ],

  // Sample notifications
  notifications: [
    {
      title: "Welcome to TaskFlow!",
      message: "Your account has been created successfully. Start by exploring the dashboard.",
      type: "welcome",
      isRead: false
    },
    {
      title: "New Task Assigned",
      message: "You have been assigned a new task: Create wireframes for new dashboard",
      type: "task_assigned",
      isRead: true
    },
    {
      title: "Task Overdue",
      message: "Task 'Database query optimization' is overdue. Please update the status.",
      type: "task_overdue",
      isRead: false
    },
    {
      title: "Project Deadline Approaching",
      message: "Project 'API Performance Optimization' deadline is in 3 days.",
      type: "project_deadline",
      isRead: false
    }
  ]
};

async function hashPassword(password: string): Promise<string> {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
  return bcrypt.hash(password, rounds);
}

async function clearExistingData() {
  console.log("🗑️  Clearing existing data (preserving admin user)...");
  
  // Delete in order to respect foreign key constraints
  await db.delete(notifications);
  await db.delete(tasks);
  await db.delete(teamMembers);
  await db.delete(projects);
  await db.delete(teams);
  
  // Delete non-admin users only
  await db.delete(users).where(sql`role != 'admin'`);
  
  console.log("✅ Existing data cleared (admin user preserved)");
}

async function seedUsers() {
  console.log("👥 Seeding users...");
  
  // Get existing admin user
  const [existingAdmin] = await db.select().from(users).where(eq(users.role, 'admin'));
  if (!existingAdmin) {
    console.log("❌ No admin user found! Please run 'npm run setup:admin' first.");
    process.exit(1);
  }
  
  const createdUsers = [existingAdmin]; // Start with existing admin
  
  // Create sample users
  for (const userData of SEED_DATA.users) {
    // Check if user already exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, userData.email));
    if (existingUser) {
      console.log(`  ⚠️  User already exists: ${userData.email} - skipping`);
      createdUsers.push(existingUser);
      continue;
    }
    
    const hashedPassword = await hashPassword(userData.password);
    
    const [user] = await db.insert(users).values({
      email: userData.email,
      password: hashedPassword,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      isActive: true,
    }).returning();
    
    createdUsers.push(user);
    console.log(`  ✅ Created user: ${user.email}`);
  }
  
  return createdUsers;
}

async function seedTeams() {
  console.log("🏢 Seeding teams...");
  
  const createdTeams = [];
  
  for (const teamData of SEED_DATA.teams) {
    const [team] = await db.insert(teams).values(teamData).returning();
    createdTeams.push(team);
    console.log(`  ✅ Created team: ${team.name}`);
  }
  
  return createdTeams;
}

async function seedTeamMembers(createdUsers: any[], createdTeams: any[]) {
  console.log("👥 Assigning team members...");
  
  // Get non-admin users for team assignment
  const employeeUsers = createdUsers.filter(user => user.role !== 'admin');
  
  // Assign users to teams (round-robin style)
  for (let i = 0; i < employeeUsers.length; i++) {
    const user = employeeUsers[i];
    const team = createdTeams[i % createdTeams.length];
    
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: user.id,
      role: user.role === 'manager' ? 'lead' : 'member'
    });
    
    console.log(`  ✅ Assigned ${user.firstName} ${user.lastName} to ${team.name}`);
  }
}

async function seedProjects(createdUsers: any[], createdTeams: any[]) {
  console.log("📋 Seeding projects...");
  
  const managers = createdUsers.filter(user => user.role === 'manager' || user.role === 'admin');
  const createdProjects = [];
  
  for (let i = 0; i < SEED_DATA.projects.length; i++) {
    const projectData = SEED_DATA.projects[i];
    const manager = managers[i % managers.length];
    const team = createdTeams[i % createdTeams.length];
    
    const [project] = await db.insert(projects).values({
      ...projectData,
      managerId: manager.id,
      teamId: team.id,
      progress: Math.floor(Math.random() * 60) // Random progress 0-60%
    }).returning();
    
    createdProjects.push(project);
    console.log(`  ✅ Created project: ${project.name}`);
  }
  
  return createdProjects;
}

async function seedTasks(createdUsers: any[], createdProjects: any[]) {
  console.log("📝 Seeding tasks...");
  
  const employees = createdUsers.filter(user => user.role === 'employee');
  let taskIndex = 0;
  
  for (let i = 0; i < createdProjects.length; i++) {
    const project = createdProjects[i];
    const tasksPerProject = Math.ceil(SEED_DATA.tasks.length / createdProjects.length);
    
    for (let j = 0; j < tasksPerProject && taskIndex < SEED_DATA.tasks.length; j++) {
      const taskData = SEED_DATA.tasks[taskIndex];
      const assignedUser = employees[taskIndex % employees.length];
      const creator = createdUsers.find(u => u.role === 'manager') || createdUsers[0];
      
      await db.insert(tasks).values({
        ...taskData,
        projectId: project.id,
        assignedUserId: assignedUser.id,
        createdById: creator.id,
        completedAt: taskData.status === 'done' ? new Date() : null
      });
      
      console.log(`  ✅ Created task: ${taskData.name}`);
      taskIndex++;
    }
  }
}

async function seedNotifications(createdUsers: any[]) {
  console.log("🔔 Seeding notifications...");
  
  const nonAdminUsers = createdUsers.filter(user => user.role !== 'admin');
  
  for (let i = 0; i < SEED_DATA.notifications.length; i++) {
    const notificationData = SEED_DATA.notifications[i];
    const user = nonAdminUsers[i % nonAdminUsers.length];
    
    await db.insert(notifications).values({
      ...notificationData,
      userId: user.id
    });
    
    console.log(`  ✅ Created notification: ${notificationData.title}`);
  }
}

async function updateProjectProgress() {
  console.log("📊 Updating project progress...");
  
  const allProjects = await db.select().from(projects);
  
  for (const project of allProjects) {
    const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, project.id));
    
    if (projectTasks.length === 0) continue;
    
    // Calculate progress based on priority weights instead of simple count
    // Weights: low=1, medium=2, high=3, critical=4
    let totalWeight = 0;
    let completedWeight = 0;

    for (const task of projectTasks) {
      // Calculate weight based on priority
      let weight = 2; // default medium weight
      switch (task.priority) {
        case 'low':
          weight = 1;
          break;
        case 'medium':
          weight = 2;
          break;
        case 'high':
          weight = 3;
          break;
        case 'critical':
          weight = 4;
          break;
      }

      totalWeight += weight;
      
      // If task is completed, add its weight to completed total
      if (task.status === 'done') {
        completedWeight += weight;
      }
    }

    // Calculate percentage based on weight completion
    const progress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    
    await db.update(projects)
      .set({ progress })
      .where(eq(projects.id, project.id));
    
    console.log(`  ✅ Updated ${project.name} progress: ${progress}%`);
  }
}

async function seedDatabase() {
  try {
    console.log("🌱 Starting database seeding...");
    console.log("=====================================");
    
    // Clear existing data
    await clearExistingData();
    
    // Seed data in order
    const createdUsers = await seedUsers();
    const createdTeams = await seedTeams();
    await seedTeamMembers(createdUsers, createdTeams);
    const createdProjects = await seedProjects(createdUsers, createdTeams);
    await seedTasks(createdUsers, createdProjects);
    await seedNotifications(createdUsers);
    await updateProjectProgress();
    
    console.log("=====================================");
    console.log("🎉 Database seeding completed successfully!");
    console.log("");
    console.log("📧 Login Credentials:");
    console.log("=====================================");
    console.log("Admin: admin@taskflow.com / Admin123! (existing user)");
    console.log("");
    console.log("👥 Sample Users:");
    SEED_DATA.users.forEach(user => {
      console.log(`${user.role.charAt(0).toUpperCase() + user.role.slice(1)}: ${user.email} / ${user.password}`);
    });
    console.log("");
    console.log("🚀 You can now start the server with: npm run dev");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run the seeder
seedDatabase();
