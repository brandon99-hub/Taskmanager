import {
  users,
  teams,
  projects,
  tasks,
  teamMembers,
  projectAttachments,
  taskDependencies,
  notifications,
  userNotificationPreferences,
  userCalendarSettings,
  invoiceReports,
  monthlyTargets,
  invoiceCollections,
  type User,
  type UpsertUser,
  type Team,
  type InsertTeam,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type TeamMember,
  type InsertTeamMember,
  type ProjectAttachment,
  type InsertProjectAttachment,
  type TaskDependency,
  type InsertTaskDependency,
  type Notification,
  type InsertNotification,
  type UserNotificationPreferences,
  type InsertUserNotificationPreferences,
  type UserCalendarSettings,
  type InsertUserCalendarSettings,
  type InvoiceReport,
  type InsertInvoiceReport,
  type MonthlyTarget,
  type InsertMonthlyTarget,
  type InvoiceCollection,
  type InsertInvoiceCollection,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, sql, count, avg, inArray, gt } from "drizzle-orm";

export interface IStorage {
  // User operations (updated for local auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByRole(role?: string): Promise<User[]>;
  getUsers(options?: { role?: string; q?: string; limit?: number; offset?: number }): Promise<User[]>;
  createUser(user: UpsertUser): Promise<User>;
  updateUserLastLogin(id: string): Promise<void>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Team operations
  getTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  getTeamsForUser(userId: string): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team>;
  getTeamMembers(teamId: string): Promise<(TeamMember & { user: User })[]>;
  getTeamWithWorkload(teamId: string): Promise<{
    team: Team;
    members: {
      userId: string;
      user: User;
      totalTasks: number;
      completedTasks: number;
      workloadPercentage: number;
    }[];
    projects: any[];
    totalTasks: number;
  }>;
  addTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;
  isUserInTeam(teamId: string, userId: string): Promise<boolean>;

  // Project operations
  getProjects(): Promise<(Project & { manager: User; team: Team | null; milestoneCount: number; completedMilestoneCount: number; paidAmount: number })[]>;
  getProject(id: string): Promise<(Project & { manager: User; team: Team | null; tasks: Task[] }) | undefined>;
  getProjectsForUser(userId: string): Promise<(Project & { manager: User; team: Team | null; milestoneCount: number; completedMilestoneCount: number; paidAmount: number })[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project>;
  terminateProject(id: string): Promise<Project>; // Method for terminating projects
  updateProjectProgress(id: string): Promise<void>;
  getProjectsByManager(managerId: string): Promise<Project[]>;
  getProjectsByTeam(teamId: string): Promise<Project[]>;
  getProjectsBySegment(segment: string): Promise<Project[]>; // New method for segment filtering
  recalculateProjectBudget(projectId: string): Promise<void>;
  updateProjectStatusBasedOnMilestones(projectId: string): Promise<void>;

  // Task operations
  getTasks(): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getTask(id: string): Promise<(Task & { project: Project; assignedUser: User | null }) | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task>;
  getTasksByProject(projectId: string): Promise<(Task & { assignedUser: User | null })[]>;
  getTasksByUser(userId: string): Promise<(Task & { project: Project })[]>;
  getOverdueTasks(): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getUpcomingTasks(days: number): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getOverdueTasksForUser(userId: string): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getUpcomingTasksForUser(userId: string, days: number): Promise<(Task & { project: Project; assignedUser: User | null })[]>;

  // Invoice and reporting operations
  getInvoiceReport(year: number, month?: number): Promise<any>; // New method for invoice reports
  getMonthlyTargets(year: number): Promise<any[]>; // New method for monthly targets
  calculateMonthlyTargets(year: number): Promise<void>; // New method for auto-calculating targets
  createInvoiceReport(invoice: any): Promise<any>; // New method for creating invoice reports
  updateInvoiceStatus(invoiceId: string, status: string): Promise<any>; // New method for updating invoice status
  recordInvoiceCollection(collection: any): Promise<any>; // New method for recording payments

  // Dashboard analytics
  getDashboardMetrics(): Promise<{
    activeProjects: number;
    completedTasks: number;
    overdueTasks: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
  }>;
  getDashboardMetricsForUser(userId: string): Promise<{
    activeProjects: number;
    completedTasks: number;
    overdueTasks: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
  }>;
  getTeamWorkload(): Promise<{
    userId: string;
    user: User;
    totalTasks: number;
    completedTasks: number;
    workloadPercentage: number;
  }[]>;
  getTeamWorkloadForUserTeams(userId: string): Promise<{
    userId: string;
    user: User;
    totalTasks: number;
    completedTasks: number;
    workloadPercentage: number;
  }[]>;
  getDashboardKanbanTasks(): Promise<{
    overdue: any[];
    review: any[];
    recentlyDone: any[];
    highPriorityTodo: any[];
  }>;
  getDashboardKanbanTasksForUser(userId: string): Promise<{
    overdue: any[];
    review: any[];
    recentlyDone: any[];
    highPriorityTodo: any[];
  }>;
  getUpcomingTasks(days: number): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getUpcomingTasksForUser(userId: string, days: number): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getOverdueTasks(): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getOverdueTasksForUser(userId: string): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getBestPerformingTeam(): Promise<any>;
  getTeamsCountForUser(userId: string): Promise<{ count: number }>;

  // Notification operations
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // User preferences and settings
  getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences>;
  updateUserNotificationPreferences(userId: string, preferences: Partial<UserNotificationPreferences>): Promise<void>;
  getUserCalendarSettings(userId: string): Promise<UserCalendarSettings>;
  updateUserCalendarSettings(userId: string, settings: Partial<UserCalendarSettings>): Promise<void>;

  // Password reset operations
  updateUserResetToken(userId: string, resetToken: string | null, resetTokenExpiry: Date | null): Promise<void>;
  getUserByResetToken(resetToken: string): Promise<User | undefined>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsersByRole(role?: string): Promise<User[]> {
    if (role) {
      return await db.select().from(users).where(eq(users.role, role));
    }
    return await db.select().from(users);
  }

  async getUsers(options?: { role?: string; q?: string; limit?: number; offset?: number }): Promise<User[]> {
    const { role, q, limit, offset } = options ?? {};
    const conditions: any[] = [];
    if (role) conditions.push(eq(users.role, role));
    if (q && q.trim().length > 0) {
      const term = `%${q.trim()}%`;
      conditions.push(
        or(
          sql`${users.email} ILIKE ${term}`,
          sql`${users.firstName} ILIKE ${term}`,
          sql`${users.lastName} ILIKE ${term}`,
        )
      );
    }

    let query = db.select().from(users) as any;
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    query = query.orderBy(asc(users.firstName));
    if (typeof limit === 'number') query = query.limit(limit);
    if (typeof offset === 'number') query = query.offset(offset);
    return await query;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Team operations
  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams).orderBy(asc(teams.name));
  }

  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async getTeamsForUser(userId: string): Promise<Team[]> {
    const rows = await db
      .select()
      .from(teamMembers)
      .leftJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId));
    return rows.map(r => r.teams!).filter(Boolean);
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  async updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team> {
    const [updatedTeam] = await db
      .update(teams)
      .set(team)
      .where(eq(teams.id, id))
      .returning();
    return updatedTeam;
  }



  async getTeamMembers(teamId: string): Promise<(TeamMember & { user: User })[]> {
    return await db
      .select()
      .from(teamMembers)
      .leftJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, teamId))
      .then(rows => rows.map(row => ({
        ...row.team_members,
        user: row.users!
      })));
  }

  async getTeamWithWorkload(teamId: string): Promise<{
    team: Team;
    members: {
      userId: string;
      user: User;
      totalTasks: number;
      completedTasks: number;
      workloadPercentage: number;
    }[];
    projects: any[];
    totalTasks: number;
  }> {
    // Get team info
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Get team members
    const members = await this.getTeamMembers(teamId);
    
    // Get projects for this team
    const teamProjects = await this.getProjectsByTeam(teamId);
    
    // Calculate workload for each member
    const membersWithWorkload = await Promise.all(
      members.map(async (member) => {
        // Count total tasks assigned to this user in projects under this team
        const totalTasksResult = await db
          .select({ count: count() })
          .from(tasks)
          .leftJoin(projects, eq(tasks.projectId, projects.id))
          .where(
            and(
              eq(tasks.assignedUserId, member.userId),
              eq(projects.teamId, teamId)
            )
          );
        
        const totalTasks = Number(totalTasksResult[0]?.count || 0);
        
        // Count completed tasks
        const completedTasksResult = await db
          .select({ count: count() })
          .from(tasks)
          .leftJoin(projects, eq(tasks.projectId, projects.id))
          .where(
            and(
              eq(tasks.assignedUserId, member.userId),
              eq(projects.teamId, teamId),
              eq(tasks.status, 'done')
            )
          );
        
        const completedTasks = Number(completedTasksResult[0]?.count || 0);
        
        // Calculate workload percentage
        const workloadPercentage = totalTasks > 0 
          ? Math.round((completedTasks / totalTasks) * 100) 
          : 0;
        
        return {
          userId: member.userId,
          user: member.user,
          totalTasks,
          completedTasks,
          workloadPercentage
        };
      })
    );
    
    // Calculate total tasks for the team
    const totalTasksResult = await db
      .select({ count: count() })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(projects.teamId, teamId));
    
    const totalTasks = Number(totalTasksResult[0]?.count || 0);
    
    return {
      team,
      members: membersWithWorkload,
      projects: teamProjects,
      totalTasks
    };
  }

  async addTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const [newMember] = await db.insert(teamMembers).values(member).returning();
    return newMember;
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    await db.delete(teamMembers).where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))
    );
  }

  async isUserInTeam(teamId: string, userId: string): Promise<boolean> {
    const existing = await db
      .select({ count: count() })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    return Number(existing[0]?.count ?? 0) > 0;
  }

  // Project operations
  async getProjects(): Promise<(Project & { 
    manager: User; 
    team: Team | null; 
    milestoneCount: number; 
    completedMilestoneCount: number;
    paidAmount: number;
  })[]> {
    const result = await db
      .select({
        project: projects,
        manager: users,
        team: teams,
        milestoneCount: sql<number>`COUNT(${tasks.id})`,
        completedMilestoneCount: sql<number>`SUM(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END)`,
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${tasks.billingStatus} = 'paid' THEN ${tasks.feeAmount} ELSE 0 END), 0)`,
      })
      .from(projects)
      .leftJoin(users, eq(projects.managerId, users.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .leftJoin(tasks, eq(tasks.projectId, projects.id))
      .groupBy(projects.id, users.id, teams.id)
      .orderBy(desc(projects.createdAt));

    return result.map(r => ({
      ...r.project,
      manager: r.manager!,
      team: r.team ?? null,
      milestoneCount: Number(r.milestoneCount || 0),
      completedMilestoneCount: Number(r.completedMilestoneCount || 0),
      paidAmount: Number(r.paidAmount || 0),
    }));
  }

  async getProjectsForUser(userId: string): Promise<(Project & { manager: User; team: Team | null; milestoneCount: number; completedMilestoneCount: number; paidAmount: number })[]> {
    // Get unique project IDs that the user has access to
    const userProjectIds = new Set<string>();
    
    // By membership
    const byMembership = await db
      .select({ projectId: projects.id })
      .from(projects)
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId));
    
    byMembership.forEach(r => {
      if (r.projectId) userProjectIds.add(r.projectId);
    });

    // By assigned tasks
    const byTasks = await db
      .select({ projectId: projects.id })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.assignedUserId, userId));
    
    byTasks.forEach(r => {
      if (r.projectId) userProjectIds.add(r.projectId);
    });

    if (userProjectIds.size === 0) {
      return [];
    }

    // Now fetch complete project data with milestone counts and payment data
    const result = await db
      .select({
        project: projects,
        manager: users,
        team: teams,
        milestoneCount: sql<number>`COUNT(${tasks.id})`,
        completedMilestoneCount: sql<number>`SUM(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END)`,
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${tasks.billingStatus} = 'paid' THEN ${tasks.feeAmount} ELSE 0 END), 0)`,
      })
      .from(projects)
      .leftJoin(users, eq(projects.managerId, users.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .leftJoin(tasks, eq(tasks.projectId, projects.id))
      .where(inArray(projects.id, Array.from(userProjectIds)))
      .groupBy(projects.id, users.id, teams.id)
      .orderBy(desc(projects.createdAt));

    return result.map(r => ({
      ...r.project,
      manager: r.manager!,
      team: r.team ?? null,
      milestoneCount: Number(r.milestoneCount || 0),
      completedMilestoneCount: Number(r.completedMilestoneCount || 0),
      paidAmount: Number(r.paidAmount || 0),
    }));
  }

  async getProject(id: string): Promise<(Project & { manager: User; team: Team | null; tasks: Task[] }) | undefined> {
    const projectData = await db
      .select()
      .from(projects)
      .leftJoin(users, eq(projects.managerId, users.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .where(eq(projects.id, id));

    if (!projectData.length) return undefined;

    const project = {
      ...projectData[0].projects,
      manager: projectData[0].users!,
      team: projectData[0].teams
    };

    const projectTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, id))
      .orderBy(asc(tasks.createdAt));

    return {
      ...project,
      tasks: projectTasks
    };
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: string, project: Partial<InsertProject>): Promise<Project> {
    const [updatedProject] = await db
      .update(projects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  async terminateProject(id: string): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({ status: 'terminated' as const, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async updateProjectProgress(id: string): Promise<void> {
    const projectTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, id));

    if (projectTasks.length === 0) {
      await db.update(projects).set({ progress: 0 }).where(eq(projects.id, id));
      return;
    }

    const completedTasks = projectTasks.filter(task => task.status === 'done').length;
    const progress = Math.round((completedTasks / projectTasks.length) * 100);

    await db.update(projects).set({ progress }).where(eq(projects.id, id));
  }

  async getProjectsByManager(managerId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.managerId, managerId))
      .orderBy(desc(projects.createdAt));
  }

  async getProjectsByTeam(teamId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.teamId, teamId))
      .orderBy(desc(projects.createdAt));
  }

  async getProjectsBySegment(segment: "academic" | "parastals" | "private"): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.segment, segment))
      .orderBy(desc(projects.createdAt));
  }

  // Task operations
  async getTasks(): Promise<(Task & { project: Project; assignedUser: User | null })[]> {
    return await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .orderBy(desc(tasks.createdAt))
      .then(rows => rows.map(row => ({
        ...row.tasks,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getTask(id: string): Promise<(Task & { project: Project; assignedUser: User | null }) | undefined> {
    const [taskData] = await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(eq(tasks.id, id));

    if (!taskData) return undefined;

    return {
      ...taskData.tasks,
      project: taskData.projects!,
      assignedUser: taskData.users
    };
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    
    // Update project progress
    await this.updateProjectProgress(task.projectId);
    // Recalculate project budget when fees exist
    await this.recalculateProjectBudget(task.projectId);
    // Auto-update project status based on milestone progress
    await this.updateProjectStatusBasedOnMilestones(task.projectId);
    
    return newTask;
  }

  async updateTask(id: string, task: Partial<InsertTask>): Promise<Task> {
    const [updatedTask] = await db
      .update(tasks)
      .set({ 
        ...task, 
        updatedAt: new Date(),
        completedAt: task.status === 'done' ? new Date() : undefined
      })
      .where(eq(tasks.id, id))
      .returning();

    // Update project progress
    await this.updateProjectProgress(updatedTask.projectId);
    // Recalculate project budget when fees change
    await this.recalculateProjectBudget(updatedTask.projectId);
    // Auto-update project status based on milestone progress
    await this.updateProjectStatusBasedOnMilestones(updatedTask.projectId);

    return updatedTask;
  }



  async getTasksByProject(projectId: string): Promise<(Task & { assignedUser: User | null })[]> {
    return await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.createdAt))
      .then(rows => rows.map(row => ({
        ...row.tasks,
        assignedUser: row.users
      })));
  }

  async getTasksByUser(userId: string): Promise<(Task & { project: Project })[]> {
    return await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.assignedUserId, userId))
      .orderBy(desc(tasks.createdAt))
      .then(rows => rows.map(row => ({
        ...row.tasks,
        project: row.projects!
      })));
  }

  async getOverdueTasks(): Promise<(Task & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    return await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          sql`${tasks.dueDate} < ${now}`,
          sql`${tasks.status} != 'done'`
        )
      )
      .orderBy(asc(tasks.dueDate))
      .then(rows => rows.map(row => ({
        ...row.tasks,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getOverdueTasksForUser(userId: string): Promise<(Task & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    return await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          eq(tasks.assignedUserId, userId),
          sql`${tasks.dueDate} < ${now}`,
          sql`${tasks.status} != 'done'`
        )
      )
      .orderBy(asc(tasks.dueDate))
      .then(rows => rows.map(row => ({
        ...row.tasks,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getUpcomingTasks(days: number): Promise<(Task & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    return await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          sql`${tasks.dueDate} BETWEEN ${now} AND ${futureDate}`,
          sql`${tasks.status} != 'done'`
        )
      )
      .orderBy(asc(tasks.dueDate))
      .then(rows => rows.map(row => ({
        ...row.tasks,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getUpcomingTasksForUser(userId: string, days: number): Promise<(Task & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    return await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          eq(tasks.assignedUserId, userId),
          sql`${tasks.dueDate} BETWEEN ${now} AND ${futureDate}`,
          sql`${tasks.status} != 'done'`
        )
      )
      .orderBy(asc(tasks.dueDate))
      .then(rows => rows.map(row => ({
        ...row.tasks,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  // Invoice and reporting operations
    async getInvoiceReport(year: number, month?: number): Promise<any> {
    try {
      // Get monthly targets for the year
      const targets = await this.getMonthlyTargets(year);
      
      // Get actual collections based on PAID milestones only (not just completed)
      // Use the same approach as the working completed-milestones endpoint
      const allTasks = await db
        .select({
          id: tasks.id,
          name: tasks.name,
          feeAmount: tasks.feeAmount,
          billingStatus: tasks.billingStatus,
          completedAt: tasks.completedAt,
          projectId: tasks.projectId,
          projectSegment: projects.segment,
          projectName: projects.name
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(tasks.status, 'done'),
            eq(tasks.billingStatus, 'paid'),
            sql`${tasks.feeAmount} IS NOT NULL AND ${tasks.feeAmount} > 0`
          )
        )
        .execute();

      // Process the tasks to get actual collections by month and segment
      const actualCollections = allTasks.reduce((acc: any[], task: any) => {
        if (task.completedAt) {
          const taskDate = new Date(task.completedAt);
          const taskYear = taskDate.getFullYear();
          const taskMonth = taskDate.getMonth() + 1;
          
          if (taskYear === year && (!month || taskMonth === month)) {
            acc.push({
              segment: task.projectSegment || 'private',
              month: taskMonth,
              totalAmount: task.feeAmount,
              milestonesCount: 1,
              projectName: task.projectName,
              milestoneName: task.name
            });
          }
        }
        return acc;
      }, []);

      // Calculate segment breakdown
      const segmentTotals = actualCollections.reduce((acc: any, row: any) => {
        const segment = row.segment || 'private';
        if (!acc[segment]) {
          acc[segment] = { actual: 0, target: 0, milestones: [] };
        }
        // Convert string amount to number and add properly
        const amount = parseFloat(row.totalAmount || '0');
        acc[segment].actual += amount;
        acc[segment].milestones.push({
          name: row.milestoneName,
          project: row.projectName,
          amount: amount,
          month: row.month
        });
        return acc;
      }, {});

      // Add targets to segment breakdown
      targets.forEach((target: any) => {
        const segment = target.segment;
        if (!segmentTotals[segment]) {
          segmentTotals[segment] = { actual: 0, target: 0, milestones: [] };
        }
        // Convert string target amount to number
        const targetAmount = parseFloat(target.targetAmount || '0');
        segmentTotals[segment].target += targetAmount;
      });
      
      // Calculate monthly trend with segment breakdowns
      const monthlyTrend = [];
      for (let m = 1; m <= 12; m++) {
        const monthTargets = targets.filter((t: any) => t.month === m);
        const monthActuals = actualCollections.filter((a: any) => a.month === m);
        
        // Calculate targets per segment for this month
        const monthTargetsBySegment = monthTargets.reduce((acc: any, target: any) => {
          const segment = target.segment;
          if (!acc[segment]) acc[segment] = 0;
          acc[segment] += parseFloat(target.targetAmount) || 0;
          return acc;
        }, {});
        
        // Calculate actuals per segment for this month
        const monthActualsBySegment = monthActuals.reduce((acc: any, actual: any) => {
          const segment = actual.segment;
          if (!acc[segment]) acc[segment] = 0;
          acc[segment] += parseFloat(actual.totalAmount) || 0;
          return acc;
        }, {});
        
        // Ensure all segments have values (default to 0)
        const academic = monthActualsBySegment.academic || 0;
        const parastals = monthActualsBySegment.parastals || 0;
        const private_ = monthActualsBySegment.private || 0;
        const target = monthTargets.reduce((sum: number, t: any) => sum + (parseFloat(t.targetAmount) || 0), 0);
        const actual = academic + parastals + private_;
        
        if (month === undefined || m <= (month || 12)) {
          monthlyTrend.push({
            month: new Date(year, m - 1).toLocaleDateString('en-US', { month: 'long' }),
            target,
            actual,
            academic,
            parastals,
            private: private_
          });
        }
      }

      // Calculate overall totals
      const totalTarget = targets.reduce((sum: number, t: any) => sum + (parseFloat(t.targetAmount) || 0), 0);
      const totalActual = actualCollections.reduce((sum: number, a: any) => sum + (parseFloat(a.totalAmount) || 0), 0);

      const result = {
        year,
        month,
        monthlyTargets: {
          academic: segmentTotals.academic?.target || 0,
          parastals: segmentTotals.parastals?.target || 0,
          private: segmentTotals.private?.target || 0,
          total: totalTarget
        },
        actualCollections: {
          academic: segmentTotals.academic?.actual || 0,
          parastals: segmentTotals.parastals?.actual || 0,
          private: segmentTotals.private?.actual || 0,
          total: totalActual
        },
        segmentBreakdown: Object.keys(segmentTotals).map(segment => ({
          segment: segment.charAt(0).toUpperCase() + segment.slice(1),
          target: segmentTotals[segment].target,
          actual: segmentTotals[segment].actual,
          percentage: segmentTotals[segment].target > 0 ? 
            Math.round((segmentTotals[segment].actual / segmentTotals[segment].target) * 100) : 0,
          milestones: segmentTotals[segment].milestones
        })),
        monthlyTrend
      };

      return result;
    } catch (error) {
      console.error('Error generating invoice report:', error);
      throw error;
    }
  }

  async getMonthlyTargets(year: number): Promise<any[]> {
    try {
      // First, try to get existing targets from the monthly_targets table
      const existingTargets = await db
        .select()
        .from(monthlyTargets)
        .where(eq(monthlyTargets.year, year))
        .execute();

      if (existingTargets.length > 0) {
        return existingTargets;
      }

      // If no targets exist, calculate them based on milestone due dates and fees
      const milestonesByMonth = await db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${tasks.dueDate})`,
          segment: projects.segment,
          totalFees: sql<number>`COALESCE(SUM(${tasks.feeAmount}), 0)`,
          milestoneCount: sql<number>`COUNT(${tasks.id})`
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${tasks.dueDate}) = ${year}`,
            sql`${tasks.feeAmount} IS NOT NULL AND ${tasks.feeAmount} > 0`
          )
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${tasks.dueDate})`, projects.segment)
        .execute();

      // Convert to monthly targets format
      const targets: any[] = [];
      for (let month = 1; month <= 12; month++) {
        ['academic', 'parastals', 'private'].forEach(segment => {
          const monthData = milestonesByMonth.find(m => 
            Number(m.month) === month && m.segment === segment
          );
          
          // Convert fees to numbers and sum them properly
          const targetAmount = monthData?.totalFees ? Number(monthData.totalFees) : 0;
          
          targets.push({
            year,
            month,
            segment,
            targetAmount: targetAmount.toString(),
            actualAmount: '0', // Will be calculated separately
            milestoneCount: monthData?.milestoneCount || 0
          });
        });
      }

      return targets;
    } catch (error) {
      console.error('Error getting monthly targets:', error);
      return [];
    }
  }

  async calculateMonthlyTargets(year: number): Promise<void> {
    try {
      // Calculate targets based on milestone due dates and fees for the year
      const milestonesByMonth = await db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${tasks.dueDate})`,
          segment: projects.segment,
          totalFees: sql<number>`COALESCE(SUM(${tasks.feeAmount}), 0)`,
          milestoneCount: sql<number>`COUNT(${tasks.id})`
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${tasks.dueDate}) = ${year}`,
            sql`${tasks.feeAmount} IS NOT NULL AND ${tasks.feeAmount} > 0`
          )
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${tasks.dueDate})`, projects.segment)
        .execute();

      // Calculate actual amounts for each month/segment
      const actualsByMonth = await db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${tasks.updatedAt})`, // Use updatedAt as fallback
          segment: projects.segment,
          actualAmount: sql<number>`COALESCE(SUM(${tasks.feeAmount}), 0)`
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${tasks.updatedAt}) = ${year}`, // Use updatedAt as fallback
            eq(tasks.status, 'done'),
            sql`${tasks.feeAmount} IS NOT NULL AND ${tasks.feeAmount} > 0`
          )
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${tasks.updatedAt})`, projects.segment)
        .execute();

      // Delete existing targets for this year
      await db
        .delete(monthlyTargets)
        .where(eq(monthlyTargets.year, year))
        .execute();

      // Insert new calculated targets
      const targetsToInsert = [];
      for (let month = 1; month <= 12; month++) {
        for (const segment of ['academic', 'parastals', 'private']) {
          const milestoneData = milestonesByMonth.find(m => 
            m.month === month && m.segment === segment
          );
          const actualData = actualsByMonth.find(a => 
            a.month === month && a.segment === segment
          );
          
          if (milestoneData || actualData) {
                      targetsToInsert.push({
            year,
            month,
            segment: segment as 'academic' | 'parastals' | 'private',
            targetAmount: milestoneData?.totalFees?.toString() || '0',
            actualAmount: actualData?.actualAmount?.toString() || '0',
            calculatedAt: new Date(),
            updatedAt: new Date()
          });
          }
        }
      }

      if (targetsToInsert.length > 0) {
        await db.insert(monthlyTargets).values(targetsToInsert).execute();
      }

      console.log(`Monthly targets calculated and saved for year ${year}. ${targetsToInsert.length} targets created.`);
    } catch (error) {
      console.error('Error calculating monthly targets:', error);
      throw error;
    }
  }

  async createInvoiceReport(invoice: any): Promise<any> {
    // This method should be implemented when we have the actual invoice_reports table
    // For now, return a placeholder
    console.log("Creating invoice report:", invoice);
    return { id: 'placeholder', ...invoice };
  }

  async updateInvoiceStatus(invoiceId: string, status: string): Promise<any> {
    // This method should be implemented when we have the actual invoice_reports table
    // For now, return a placeholder
    console.log("Updating invoice status:", invoiceId, status);
    return { id: invoiceId, status, updatedAt: new Date() };
  }

  async recordInvoiceCollection(collection: any): Promise<any> {
    // This method should be implemented when we have the actual invoice_collections table
    // For now, return a placeholder
    console.log("Recording invoice collection:", collection);
    return { id: 'placeholder', ...collection, createdAt: new Date() };
  }

  // Dashboard analytics
  async getDashboardMetrics(): Promise<{
    activeProjects: number;
    completedTasks: number;
    overdueTasks: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
  }> {
    const [activeProjectsResult] = await db
      .select({ count: count() })
      .from(projects)
      .where(sql`${projects.status} IN ('planning', 'active')`);

    const [completedTasksResult] = await db
      .select({ count: count() })
      .from(tasks)
      .where(eq(tasks.status, 'done'));

    const now = new Date();
    const [overdueTasksResult] = await db
      .select({ count: count() })
      .from(tasks)
      .where(
        and(
          sql`${tasks.dueDate} < ${now}`,
          sql`${tasks.status} != 'done'`
        )
      );

    const [teamMembersResult] = await db
      .select({ count: count() })
      .from(users);

    return {
      activeProjects: activeProjectsResult.count,
      completedTasks: completedTasksResult.count,
      overdueTasks: overdueTasksResult.count,
      totalBudget: 0, // Placeholder, needs actual budget calculation
      collectedAmount: 0, // Placeholder, needs actual collection calculation
      pendingAmount: 0, // Placeholder, needs actual pending calculation
    };
  }

  // Recompute project budget as sum of milestone fees
  async recalculateProjectBudget(projectId: string): Promise<void> {
    const feeRows = await db
      .select({ sum: sql`COALESCE(SUM(${tasks.feeAmount}), 0)` })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));
    const total = (feeRows?.[0] as any)?.sum ?? 0;
    await db.update(projects).set({ budget: String(total) }).where(eq(projects.id, projectId));
  }

  async updateProjectStatusBasedOnMilestones(projectId: string): Promise<void> {
    // Get project and its milestones
    const project = await this.getProject(projectId);
    if (!project) return;

    const projectTasks = await this.getTasksByProject(projectId);
    
    if (projectTasks.length === 0) {
      // No milestones, keep as planning
      return;
    }

    const totalMilestones = projectTasks.length;
    const completedMilestones = projectTasks.filter(t => t.status === 'done').length;
    const activeMilestones = projectTasks.filter(t => t.status === 'in_progress' || t.status === 'review').length;

    let newStatus = project.status; // Keep current status by default

    // Automatic status logic
    if (completedMilestones === totalMilestones && totalMilestones > 0) {
      // All milestones completed
      newStatus = 'completed';
    } else if (activeMilestones > 0 || completedMilestones > 0) {
      // At least one milestone is active or completed
      if (project.status === 'planning') {
        newStatus = 'active';
      }
    }

    // Only update if status should change
    if (newStatus !== project.status) {
      await db
        .update(projects)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
    }
  }

  async getDashboardMetricsForUser(userId: string): Promise<{
    activeProjects: number;
    completedTasks: number;
    overdueTasks: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
  }> {
    // Active projects associated via team membership or assigned tasks
    const projectsByMembership = await db
      .select({ id: projects.id, status: projects.status })
      .from(projects)
      .leftJoin(teamMembers, eq(projects.teamId, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId));

    const projectsByAssignedTasks = await db
      .select({ id: projects.id, status: projects.status })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.assignedUserId, userId));

    const projectMap: Record<string, string> = {};
    for (const p of projectsByMembership) if (p.id) projectMap[p.id] = p.status as any;
    for (const p of projectsByAssignedTasks) if (p.id) projectMap[p.id] = p.status as any;
    const activeProjects = Object.values(projectMap).filter((s) => ['planning', 'active'].includes(String(s))).length;

    const [completedTasksResult] = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(eq(tasks.assignedUserId, userId), eq(tasks.status, 'done')));

    const now = new Date();
    const [overdueTasksResult] = await db
      .select({ count: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.assignedUserId, userId),
          sql`${tasks.dueDate} < ${now}`,
          sql`${tasks.status} != 'done'`
        )
      );

    // Team members across user's teams (distinct users)
    const memberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));
    const teamIds = memberships.map((m) => m.teamId);
    let teamMembersCount = 0;
    if (teamIds.length > 0) {
      const distinctMembers = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(inArray(teamMembers.teamId, teamIds))
        .groupBy(teamMembers.userId);
      teamMembersCount = distinctMembers.length;
    }

    return {
      activeProjects,
      completedTasks: completedTasksResult.count,
      overdueTasks: overdueTasksResult.count,
      totalBudget: 0, // Placeholder
      collectedAmount: 0, // Placeholder
      pendingAmount: 0, // Placeholder
    };
  }

  async getTeamWorkload(): Promise<{
    userId: string;
    user: User;
    totalTasks: number;
    completedTasks: number;
    workloadPercentage: number;
  }[]> {
    const workloadData = await db
      .select({
        userId: users.id,
        user: users,
        totalTasks: count(tasks.id),
        completedTasks: sql<number>`SUM(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END)`,
      })
      .from(users)
      .leftJoin(tasks, eq(users.id, tasks.assignedUserId))
      .groupBy(users.id)
      .having(sql`COUNT(${tasks.id}) > 0`);

    return workloadData.map(data => ({
      userId: data.userId,
      user: data.user,
      totalTasks: data.totalTasks,
      completedTasks: Number(data.completedTasks),
      workloadPercentage: data.totalTasks > 0 
        ? Math.round((Number(data.completedTasks) / data.totalTasks) * 100)
        : 0,
    }));
  }

  async getTeamWorkloadForUserTeams(currentUserId: string): Promise<{
    userId: string;
    user: User;
    totalTasks: number;
    completedTasks: number;
    workloadPercentage: number;
  }[]> {
    // Find teams the current user belongs to
    const memberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, currentUserId));

    const teamIds = memberships.map((m) => m.teamId);
    if (teamIds.length === 0) {
      return [];
    }

    // Workload for users who are in these teams, counting only tasks under projects in these teams
    const workloadData = await db
      .select({
        userId: users.id,
        user: users,
        totalTasks: count(tasks.id),
        completedTasks: sql<number>`SUM(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END)`,
      })
      .from(users)
      // limit users to members of these teams
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .leftJoin(tasks, eq(users.id, tasks.assignedUserId))
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          inArray(teamMembers.teamId, teamIds),
          // Only count tasks that belong to projects in these teams
          or(sql`${tasks.id} IS NULL`, inArray(projects.teamId, teamIds))
        )
      )
      .groupBy(users.id)
      .having(sql`COUNT(${tasks.id}) > 0`);

    return workloadData.map((data) => {
      const totalTasks = data.totalTasks;
      const completedTasks = Number(data.completedTasks);
      
      // Calculate workload percentage based on completion rate
      const completionRate = totalTasks > 0 
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;
      
      // For employees, adjust workload calculation to be more realistic
      // Base workload on actual task count, not just completion percentage
      let workloadPercentage = completionRate;
      
      // If someone has very few tasks but high completion, don't show as overloaded
      if (totalTasks <= 2 && completionRate >= 80) {
        workloadPercentage = Math.min(completionRate, 60); // Cap at 60% for low task count
      }
      
      // If someone has many tasks, their workload should reflect that
      if (totalTasks >= 5) {
        workloadPercentage = Math.max(workloadPercentage, 40); // Minimum 40% for high task count
      }
      
      return {
        userId: data.userId,
        user: data.user,
        totalTasks,
        completedTasks,
        workloadPercentage,
      };
    });
  }

  // Enhanced dashboard methods implementations
  async getDashboardKanbanTasks(): Promise<{
    overdue: (Task & { project: Project; assignedUser: User | null })[];
    review: (Task & { project: Project; assignedUser: User | null })[];
    recentlyDone: (Task & { project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Task & { project: Project; assignedUser: User | null })[];
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get overdue tasks
    const overdue = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          sql`${tasks.dueDate} < ${now}`,
          sql`${tasks.status} != 'done'`
        )
      )
      .execute();

    // Get review tasks
    const review = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(eq(tasks.status, 'review'))
      .execute();

    // Get recently done tasks (last 7 days)
    const recentlyDone = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          eq(tasks.status, 'done'),
          sql`${tasks.updatedAt} >= ${sevenDaysAgo}`
        )
      )
      .execute();

    // Get high priority todo tasks
    const highPriorityTodo = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          eq(tasks.status, 'todo'),
          or(
            eq(tasks.priority, 'critical'),
            eq(tasks.priority, 'high')
          )
        )
      )
      .execute();

    return {
      overdue: overdue.map(row => ({ ...row.tasks, project: row.projects, assignedUser: row.users })),
      review: review.map(row => ({ ...row.tasks, project: row.projects, assignedUser: row.users })),
      recentlyDone: recentlyDone.map(row => ({ ...row.tasks, project: row.projects, assignedUser: row.users })),
      highPriorityTodo: highPriorityTodo.map(row => ({ ...row.tasks, project: row.projects, assignedUser: row.users })),
    };
  }

  async getDashboardKanbanTasksForUser(userId: string): Promise<{
    overdue: (Task & { project: Project; assignedUser: User | null })[];
    review: (Task & { project: Project; assignedUser: User | null })[];
    recentlyDone: (Task & { project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Task & { project: Project; assignedUser: User | null })[];
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get user's team IDs to include team-assigned tasks
    const userTeamIds = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .execute();
    
    const teamIds = userTeamIds.map(t => t.teamId);

    // Base condition: tasks assigned to user OR assigned to their teams
    const userTaskCondition = teamIds.length > 0
      ? or(
          eq(tasks.assignedUserId, userId),
          inArray(tasks.assignedTeamId, teamIds)
        )
      : eq(tasks.assignedUserId, userId);

    // Get overdue tasks
    const overdue = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          sql`${tasks.dueDate} < ${now}`,
          sql`${tasks.status} != 'done'`,
          userTaskCondition
        )
      )
      .execute();

    // Get review tasks
    const review = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          eq(tasks.status, 'review'),
          userTaskCondition
        )
      )
      .execute();

    // Get recently done tasks (last 7 days)
    const recentlyDone = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          eq(tasks.status, 'done'),
          sql`${tasks.updatedAt} >= ${sevenDaysAgo}`,
          userTaskCondition
        )
      )
      .execute();

    // Get high priority todo tasks
    const highPriorityTodo = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          eq(tasks.status, 'todo'),
          or(
            eq(tasks.priority, 'critical'),
            eq(tasks.priority, 'high')
          ),
          userTaskCondition
        )
      )
      .execute();

    return {
      overdue: overdue.map(row => ({ ...row.tasks, project: row.projects, assignedUser: row.users })),
      review: review.map(row => ({ ...row.tasks, project: row.projects, assignedUser: row.users })),
      recentlyDone: recentlyDone.map(row => ({ ...row.tasks, project: row.projects, assignedUser: row.users })),
      highPriorityTodo: highPriorityTodo.map(row => ({ ...row.tasks, project: row.projects, assignedUser: row.users })),
    };
  }

  async getBestPerformingTeam(): Promise<{
    teamId: string;
    team: Team;
    completionRate: number;
    onTimeDeliveryRate: number;
    overallScore: number;
    members: {
      userId: string;
      user: User;
      totalTasks: number;
      completedTasks: number;
      workloadPercentage: number;
    }[];
  } | null> {
    // Get all teams with their task performance metrics
    const teamMetrics = await db
      .select({
        teamId: teams.id,
        team: teams,
        totalTasks: count(tasks.id),
        completedTasks: sql<number>`SUM(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END)`,
        onTimeTasks: sql<number>`SUM(CASE WHEN ${tasks.status} = 'done' AND ${tasks.dueDate} >= ${tasks.updatedAt} THEN 1 ELSE 0 END)`,
      })
      .from(teams)
      .leftJoin(projects, eq(teams.id, projects.teamId))
      .leftJoin(tasks, eq(projects.id, tasks.projectId))
      .groupBy(teams.id)
      .having(sql`COUNT(${tasks.id}) > 0`)
      .execute();

    if (teamMetrics.length === 0) {
      return null;
    }

    // Calculate performance scores
    const teamsWithScores = teamMetrics.map(team => {
      const completionRate = team.totalTasks > 0 ? (Number(team.completedTasks) / team.totalTasks) * 100 : 0;
      const onTimeDeliveryRate = Number(team.completedTasks) > 0 ? (Number(team.onTimeTasks) / Number(team.completedTasks)) * 100 : 0;
      const overallScore = (completionRate * 0.6) + (onTimeDeliveryRate * 0.4); // 60% completion, 40% on-time

      return {
        teamId: team.teamId,
        team: team.team,
        totalTasks: team.totalTasks,
        completedTasks: Number(team.completedTasks),
        completionRate,
        onTimeDeliveryRate,
        overallScore,
      };
    });

    // Get the best performing team
    const bestTeam = teamsWithScores.reduce((best, current) => 
      current.overallScore > best.overallScore ? current : best
    );

    // Get members of the best team
    const members = await this.getTeamMembers(bestTeam.teamId);
    const memberWorkload = await Promise.all(
      members.map(async (member) => {
        const memberTasks = await db
          .select({
            totalTasks: count(tasks.id),
            completedTasks: sql<number>`SUM(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END)`,
          })
          .from(tasks)
          .where(eq(tasks.assignedUserId, member.userId))
          .execute();

        const taskData = memberTasks[0] || { totalTasks: 0, completedTasks: 0 };
        return {
          userId: member.userId,
          user: member.user,
          totalTasks: taskData.totalTasks,
          completedTasks: Number(taskData.completedTasks),
          workloadPercentage: taskData.totalTasks > 0 
            ? Math.round((Number(taskData.completedTasks) / taskData.totalTasks) * 100)
            : 0,
        };
      })
    );

    return {
      teamId: bestTeam.teamId,
      team: bestTeam.team,
      completionRate: Math.round(bestTeam.completionRate),
      onTimeDeliveryRate: Math.round(bestTeam.onTimeDeliveryRate),
      overallScore: Math.round(bestTeam.overallScore),
      members: memberWorkload,
    };
  }

  async getTeamsCountForUser(userId: string): Promise<{ count: number }> {
    const result = await db
      .select({ count: count() })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .execute();
    
    return { count: result[0]?.count || 0 };
  }

  // Notification operations
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  // User preferences and settings
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
    const [preferences] = await db
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId));
    return preferences || {
      userId: userId,
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
      reminderTime: "09:00"
    };
  }

  async updateUserNotificationPreferences(userId: string, preferences: Partial<UserNotificationPreferences>): Promise<void> {
    const preferencesWithUserId = { ...preferences, userId };
    await db
      .insert(userNotificationPreferences)
      .values(preferencesWithUserId as InsertUserNotificationPreferences)
      .onConflictDoUpdate({
        target: userNotificationPreferences.userId,
        set: {
          ...preferences,
          updatedAt: new Date(),
        },
      });
  }

  async getUserCalendarSettings(userId: string): Promise<UserCalendarSettings> {
    const [settings] = await db
      .select()
      .from(userCalendarSettings)
      .where(eq(userCalendarSettings.userId, userId));
    return settings || {
      id: '',
      userId: userId,
      isConnected: false,
      syncEnabled: false,
      calendarName: null,
      reminderTime: '09:00',
      syncFrequency: 'daily',
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateUserCalendarSettings(userId: string, settings: Partial<UserCalendarSettings>): Promise<void> {
    const settingsWithUserId = { ...settings, userId };
    await db
      .insert(userCalendarSettings)
      .values(settingsWithUserId as InsertUserCalendarSettings)
      .onConflictDoUpdate({
        target: userCalendarSettings.userId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      });
  }

  // Password reset operations
  async updateUserResetToken(userId: string, resetToken: string | null, resetTokenExpiry: Date | null): Promise<void> {
    await db
      .update(users)
      .set({ resetToken, resetTokenExpiry, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async getUserByResetToken(resetToken: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, resetToken));
    return user;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword, resetToken: null, resetTokenExpiry: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();
