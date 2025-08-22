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
  subtasks,
  subtaskDependencies,
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
  segmentLeaders,
  type InsertSegmentLeader,
  systemConfig,
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
      role: string;
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
  getTasksByProject(projectId: string): Promise<(Task & { assignedUser: User | null; subtasks: any[] })[]>;
  getTasksByUser(userId: string): Promise<(Task & { project: Project })[]>;
  getOverdueTasks(): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getUpcomingTasks(days: number): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getOverdueTasksForUser(userId: string): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getUpcomingTasksForUser(userId: string, days: number): Promise<(Task & { project: Project; assignedUser: User | null })[]>;

  // Subtask operations
  getSubtasksByMilestone(milestoneId: string): Promise<any[]>;
  createSubtask(subtask: any): Promise<any>;
  updateSubtask(id: string, subtask: any): Promise<any>;
  deleteSubtask(id: string): Promise<void>;
  getSubtaskDependencies(subtaskId: string): Promise<any[]>;

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
  getBestPerformingTeam(): Promise<{
    teamId: string;
    team: Team;
    completionRate: number;
    onTimeDeliveryRate: number;
    efficiencyScore: number;
    priorityBonus: number;
    overallScore: number;
    members: {
      userId: string;
      user: User;
      totalTasks: number;
      completedTasks: number;
      overdueTasks: number;
      highPriorityTasks: number;
      completedHighPriorityTasks: number;
      workloadPercentage: number;
    }[];
  } | null>;
  getTeamsCountForUser(userId: string): Promise<{ count: number }>;
  getSegmentLeader(segment: "academic" | "parastals" | "private"): Promise<any>;
  updateSegmentLeaders(data: {
    academic: { name: string; email: string };
    parastals: { name: string; email: string };
    private: { name: string; email: string };
    financeEmail: string;
    accountManagerEmail: string;
  }): Promise<void>;
  
  // System configuration methods
  getSystemConfig(key: string): Promise<string | null>;
  setSystemConfig(key: string, value: string, description?: string): Promise<void>;
  getFinanceAndAccountManagerEmails(): Promise<{ financeEmail: string; accountManagerEmail: string }>;

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
    const result = await db
      .select({
        id: teamMembers.id,
        teamId: teamMembers.teamId,
        userId: teamMembers.userId,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        user: users
      })
      .from(teamMembers)
      .leftJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, teamId));
    
    return result.map(row => ({
      id: row.id,
      teamId: row.teamId,
      userId: row.userId,
      role: row.role,
      joinedAt: row.joinedAt,
      user: row.user!
    }));
  }

  async getTeamWithWorkload(teamId: string): Promise<{
    team: Team;
    members: {
      userId: string;
      user: User;
      role: string;
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
          role: member.role || 'member', // Ensure role is never null
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
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${tasks.billingStatus} = 'sent' THEN ${tasks.feeAmount} ELSE 0 END), 0)`, // Changed from 'paid' to 'sent'
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
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${tasks.billingStatus} = 'sent' THEN ${tasks.feeAmount} ELSE 0 END), 0)`, // Changed from 'paid' to 'sent'
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



  async getTasksByProject(projectId: string): Promise<(Task & { assignedUser: User | null; subtasks: any[] })[]> {
    // First get all tasks (milestones) for the project
    const projectTasks = await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.createdAt))
      .then(rows => rows.map(row => ({
        ...row.tasks,
        assignedUser: row.users
      })));

    // Then get subtasks for each task
    const tasksWithSubtasks = await Promise.all(
      projectTasks.map(async (task) => {
        const subtasksWithUsers = await db
          .select({
            subtask: subtasks,
            assignedUser: users,
          })
          .from(subtasks)
          .leftJoin(users, eq(subtasks.assignedUserId, users.id))
          .where(eq(subtasks.milestoneId, task.id))
          .orderBy(asc(subtasks.createdAt));

        return {
          ...task,
          subtasks: subtasksWithUsers.map(row => ({
            id: row.subtask.id,
            name: row.subtask.name,
            description: row.subtask.description,
            status: row.subtask.status,
            priority: row.subtask.priority,
            startDate: row.subtask.startDate,
            dueDate: row.subtask.dueDate,
            estimatedHours: row.subtask.estimatedHours,
            estimatedDays: row.subtask.estimatedDays,
            actualHours: row.subtask.actualHours,
            actualDays: row.subtask.actualDays,
            progressPercent: row.subtask.progressPercent,
            assignedUserId: row.subtask.assignedUserId,
            assignedUser: row.assignedUser,
            completedAt: row.subtask.completedAt
          }))
        };
      })
    );

    return tasksWithSubtasks;
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
      // Get milestone data for the year
      const allMilestones = await db
        .select({
          id: tasks.id,
          feeAmount: tasks.feeAmount,
          billingStatus: tasks.billingStatus,
          dueDate: tasks.dueDate,
          projectSegment: projects.segment
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .execute();
      
      // SIMPLE LOGIC: Get revenue based on billing status, not due dates
      
      // 1. Expected Revenue: Sum of all milestone fees for the year
      const expectedRevenue = await db
        .select({
          segment: projects.segment,
          totalAmount: sql<number>`COALESCE(SUM(${tasks.feeAmount}), 0)`
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${tasks.dueDate}) = ${year}`,
            sql`${tasks.feeAmount} IS NOT NULL AND ${tasks.feeAmount} > 0`
          )
        )
        .groupBy(projects.segment)
        .execute();



      // 2. Invoice Sent Revenue: Sum of fees for milestones with billing_status = 'sent'
      const invoiceSentRevenue = await db
        .select({
          segment: projects.segment,
          totalAmount: sql<number>`COALESCE(SUM(${tasks.feeAmount}), 0)`
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(tasks.billingStatus, 'sent'),
            sql`${tasks.feeAmount} IS NOT NULL AND ${tasks.feeAmount} > 0`
          )
        )
        .groupBy(projects.segment)
        .execute();



      // 3. Collected Revenue: Sum of fees for milestones with billing_status = 'paid'
      const collectedRevenue = await db
        .select({
          segment: projects.segment,
          totalAmount: sql<number>`COALESCE(SUM(${tasks.feeAmount}), 0)`
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(tasks.billingStatus, 'paid'),
            sql`${tasks.feeAmount} IS NOT NULL AND ${tasks.feeAmount} > 0`
          )
        )
        .groupBy(projects.segment)
        .execute();



      // Calculate totals by segment
      const segments = ['academic', 'parastals', 'private'];
      const expectedBySegment: any = {};
      const sentBySegment: any = {};
      const paidBySegment: any = {};

      segments.forEach(segment => {
        expectedBySegment[segment] = expectedRevenue.find(r => r.segment === segment)?.totalAmount || 0;
        sentBySegment[segment] = invoiceSentRevenue.find(r => r.segment === segment)?.totalAmount || 0;
        paidBySegment[segment] = collectedRevenue.find(r => r.segment === segment)?.totalAmount || 0;
      });

      // Calculate overall totals - FIXED: Convert to numbers before summing
      const totalExpected: number = Object.values(expectedBySegment).reduce((sum: number, amount: any) => sum + Number(amount || 0), 0);
      const totalSent: number = Object.values(sentBySegment).reduce((sum: number, amount: any) => sum + Number(amount || 0), 0);
      const totalPaid: number = Object.values(paidBySegment).reduce((sum: number, amount: any) => sum + Number(amount || 0), 0);

      // Monthly trend with REAL data (12 months) - FIXED: Show actual monthly performance
      const monthlyTrend = [];
      for (let m = 1; m <= 12; m++) {
        // Get ALL milestones due in this month (regardless of completion status)
        const monthExpected = await db
          .select({
            academic: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'academic' THEN ${tasks.feeAmount} ELSE 0 END), 0)`,
            parastals: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'parastals' THEN ${tasks.feeAmount} ELSE 0 END), 0)`,
            private: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'private' THEN ${tasks.feeAmount} ELSE 0 END), 0)`,
            total: sql<number>`COALESCE(SUM(${tasks.feeAmount}), 0)`
          })
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(
            and(
              sql`EXTRACT(YEAR FROM ${tasks.dueDate}) = ${year}`,
              sql`EXTRACT(MONTH FROM ${tasks.dueDate}) = ${m}`,
              sql`${tasks.feeAmount} IS NOT NULL AND ${tasks.feeAmount} > 0`
              // NO status filter - include ALL milestones for the month
            )
          )
          .execute();

        // Get milestones due this month with 'sent' billing status
        const monthSent = await db
          .select({
            academic: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'academic' THEN ${tasks.feeAmount} ELSE 0 END), 0)`,
            parastals: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'parastals' THEN ${tasks.feeAmount} ELSE 0 END), 0)`,
            private: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'private' THEN ${tasks.feeAmount} ELSE 0 END), 0)`,
            total: sql<number>`COALESCE(SUM(${tasks.feeAmount}), 0)`
          })
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(
            and(
              sql`EXTRACT(YEAR FROM ${tasks.dueDate}) = ${year}`,
              sql`EXTRACT(MONTH FROM ${tasks.dueDate}) = ${m}`,
              eq(tasks.billingStatus, 'sent'),
              sql`${tasks.feeAmount} IS NOT NULL AND ${tasks.feeAmount} > 0`
              // NO status filter - include ALL milestones for the month
            )
          )
          .execute();

        // Get milestones due this month with 'paid' billing status
        const monthPaid = await db
          .select({
            academic: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'academic' THEN ${tasks.feeAmount} ELSE 0 END), 0)`,
            parastals: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'parastals' THEN ${tasks.feeAmount} ELSE 0 END), 0)`,
            private: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'private' THEN ${tasks.feeAmount} ELSE 0 END), 0)`,
            total: sql<number>`COALESCE(SUM(${tasks.feeAmount}), 0)`
          })
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(
            and(
              sql`EXTRACT(YEAR FROM ${tasks.dueDate}) = ${year}`,
              sql`EXTRACT(MONTH FROM ${tasks.dueDate}) = ${m}`,
              eq(tasks.billingStatus, 'paid'),
              sql`${tasks.feeAmount} IS NOT NULL AND ${tasks.feeAmount} > 0`
              // NO status filter - include ALL milestones for the month
            )
          )
          .execute();

          monthlyTrend.push({
            month: new Date(year, m - 1).toLocaleDateString('en-US', { month: 'long' }),
            expected: Number(monthExpected[0]?.total || 0), // Total milestones due this month
            sent: Number(monthSent[0]?.total || 0),         // Milestones due this month with 'sent' status
            paid: Number(monthPaid[0]?.total || 0),         // Milestones due this month with 'paid' status
            // Segment breakdowns based on due dates (not completion dates)
            academic: Number(monthExpected[0]?.academic || 0),
            parastals: Number(monthExpected[0]?.parastals || 0),
            private: Number(monthExpected[0]?.private || 0)
          });
      }

      const result = {
        year,
        month,
        monthlyTargets: {
          academic: expectedBySegment.academic || 0,
          parastals: expectedBySegment.parastals || 0,
          private: expectedBySegment.private || 0,
          total: totalExpected
        },
        invoiceSent: {
          academic: sentBySegment.academic || 0,
          parastals: sentBySegment.parastals || 0,
          private: sentBySegment.private || 0,
          total: totalSent
        },
        actualCollections: {
          academic: paidBySegment.academic || 0,
          parastals: paidBySegment.parastals || 0,
          private: paidBySegment.private || 0,
          total: totalPaid
        },
        segmentBreakdown: segments.map(segment => ({
          segment: segment.charAt(0).toUpperCase() + segment.slice(1),
          expected: expectedBySegment[segment],
          sent: sentBySegment[segment],
          paid: paidBySegment[segment],
          percentage: expectedBySegment[segment] > 0 ? 
            Math.round((paidBySegment[segment] / expectedBySegment[segment]) * 100) : 0,
          milestones: [] // Simplified for now
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

      // Calculate actual amounts for each month/segment - COUNT REVENUE WHEN SENT, NOT WHEN DONE
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
            eq(tasks.billingStatus, 'sent'), // Changed from 'done' to 'sent' - count revenue when invoice sent
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


    } catch (error) {
      console.error('Error calculating monthly targets:', error);
      throw error;
    }
  }

  async createInvoiceReport(invoice: any): Promise<any> {
    // This method should be implemented when we have the actual invoice_reports table
    // For now, return a placeholder

    return { id: 'placeholder', ...invoice };
  }

  async updateInvoiceStatus(invoiceId: string, status: string): Promise<any> {
    // This method should be implemented when we have the actual invoice_reports table
    // For now, return a placeholder

    return { id: invoiceId, status, updatedAt: new Date() };
  }

  async recordInvoiceCollection(collection: any): Promise<any> {
    // This method should be implemented when we have the actual invoice_collections table
    // For now, return a placeholder

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
      .where(eq(projects.status, 'active'));

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

  // Get monthly progress comparison for projects
  async getMonthlyProgressComparison(): Promise<{
    currentMonth: { month: number; year: number; averageProgress: number };
    previousMonth: { month: number; year: number; averageProgress: number };
    change: number;
  }> {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
    const currentYear = now.getFullYear();
    
    // Calculate previous month
    let previousMonth = currentMonth - 1;
    let previousYear = currentYear;
    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear = currentYear - 1;
    }

    // Get current month progress (using existing project data)
    const currentProjects = await this.getProjects();
    const currentMonthProgress = currentProjects.length > 0 
      ? currentProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / currentProjects.length
      : 0;

    // For previous month, we'll use a simple calculation based on current data
    // In a real system, you might want to store historical progress data
    const previousMonthProgress = Math.max(0, currentMonthProgress - Math.random() * 20); // Placeholder calculation

    const change = currentMonthProgress - previousMonthProgress;

    return {
      currentMonth: { month: currentMonth, year: currentYear, averageProgress: Math.round(currentMonthProgress) },
      previousMonth: { month: previousMonth, year: previousYear, averageProgress: Math.round(previousMonthProgress) },
      change: Math.round(change)
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
    const activeMilestones = projectTasks.filter(t => t.status === 'in_progress' || t.status === 'client_review').length; // Changed from 'review' to 'client_review'

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
    const activeProjects = Object.values(projectMap).filter((s) => s === 'active').length;

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

    // Get client review tasks
    const review = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(eq(tasks.status, 'client_review')) // Changed from 'review' to 'client_review'
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

    // Get high priority tasks (regardless of status)
    const highPriorityTodo = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        or(
          eq(tasks.priority, 'critical'),
          eq(tasks.priority, 'high')
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

    // Get client review tasks
    const review = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
          eq(tasks.status, 'client_review'),
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

    // Get high priority tasks (regardless of status)
    const highPriorityTodo = await db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .where(
        and(
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
    efficiencyScore: number;
    priorityBonus: number;
    overallScore: number;
    members: {
      userId: string;
      user: User;
      totalTasks: number;
      completedTasks: number;
      overdueTasks: number;
      highPriorityTasks: number;
      completedHighPriorityTasks: number;
      workloadPercentage: number;
    }[];
  } | null> {
    // Get all teams with their task performance metrics - FIXED: More accurate calculations
    const teamMetrics = await db
      .select({
        teamId: teams.id,
        team: teams,
        totalTasks: count(tasks.id),
        completedTasks: sql<number>`SUM(CASE WHEN ${tasks.status} IN ('done', 'finished') THEN 1 ELSE 0 END)`,
        onTimeTasks: sql<number>`SUM(CASE WHEN ${tasks.status} IN ('done', 'finished') AND ${tasks.dueDate} >= ${tasks.completedAt} THEN 1 ELSE 0 END)`,
        overdueTasks: sql<number>`SUM(CASE WHEN ${tasks.status} NOT IN ('done', 'finished', 'cancelled') AND ${tasks.dueDate} < CURRENT_DATE THEN 1 ELSE 0 END)`,
        highPriorityTasks: sql<number>`SUM(CASE WHEN ${tasks.priority} IN ('high', 'critical') THEN 1 ELSE 0 END)`,
        completedHighPriorityTasks: sql<number>`SUM(CASE WHEN ${tasks.status} IN ('done', 'finished') AND ${tasks.priority} IN ('high', 'critical') THEN 1 ELSE 0 END)`,
      })
      .from(teams)
      .leftJoin(projects, eq(teams.id, projects.teamId))
      .leftJoin(tasks, eq(projects.id, tasks.projectId))
      .where(
        and(
          sql`${tasks.id} IS NOT NULL`, // Only teams with actual tasks
          sql`${tasks.status} NOT IN ('cancelled', 'on_hold')` // Exclude cancelled/on-hold tasks
        )
      )
      .groupBy(teams.id)
      .execute();

    if (teamMetrics.length === 0) {
      return null;
    }

    // Calculate performance scores with improved metrics - FIXED: Better scoring algorithm
    const teamsWithScores = teamMetrics.map(team => {
      const totalTasks = Number(team.totalTasks);
      const completedTasks = Number(team.completedTasks);
      const onTimeTasks = Number(team.onTimeTasks);
      const overdueTasks = Number(team.overdueTasks);
      const highPriorityTasks = Number(team.highPriorityTasks);
      const completedHighPriorityTasks = Number(team.completedHighPriorityTasks);

      // Completion Rate: Weighted by priority (high priority tasks count more)
      const completionRate = totalTasks > 0 
        ? ((completedTasks * 1.0) + (completedHighPriorityTasks * 0.5)) / (totalTasks + (highPriorityTasks * 0.5)) * 100
        : 0;

      // On-Time Delivery Rate: Completed tasks that were on time
      const onTimeDeliveryRate = completedTasks > 0 
        ? (onTimeTasks / completedTasks) * 100 
        : 0;

      // Efficiency Score: Penalty for overdue tasks
      const efficiencyScore = totalTasks > 0 
        ? Math.max(0, 100 - (overdueTasks / totalTasks) * 50) // Max 50% penalty for overdue tasks
        : 100;

      // Priority Completion Bonus: Extra points for completing high-priority tasks
      const priorityBonus = highPriorityTasks > 0 
        ? (completedHighPriorityTasks / highPriorityTasks) * 20 
        : 0;

      // Overall Score: Weighted combination of all metrics
      const overallScore = Math.min(100, 
        (completionRate * 0.4) +           // 40% completion rate
        (onTimeDeliveryRate * 0.3) +       // 30% on-time delivery
        (efficiencyScore * 0.2) +          // 20% efficiency (no overdue penalty)
        (priorityBonus * 0.1)              // 10% priority completion bonus
      );

      return {
        teamId: team.teamId,
        team: team.team,
        totalTasks,
        completedTasks,
        completionRate: Math.round(completionRate),
        onTimeDeliveryRate: Math.round(onTimeDeliveryRate),
        efficiencyScore: Math.round(efficiencyScore),
        priorityBonus: Math.round(priorityBonus),
        overallScore: Math.round(overallScore),
      };
    });

    // Get the best performing team
    const bestTeam = teamsWithScores.reduce((best, current) => 
      current.overallScore > best.overallScore ? current : best
    );

    // Get members of the best team with improved workload calculation - FIXED: Better member metrics
    const members = await this.getTeamMembers(bestTeam.teamId);
    const memberWorkload = await Promise.all(
      members.map(async (member) => {
        const memberTasks = await db
          .select({
            totalTasks: count(tasks.id),
            completedTasks: sql<number>`SUM(CASE WHEN ${tasks.status} IN ('done', 'finished') THEN 1 ELSE 0 END)`,
            overdueTasks: sql<number>`SUM(CASE WHEN ${tasks.status} NOT IN ('done', 'finished', 'cancelled') AND ${tasks.dueDate} < CURRENT_DATE THEN 1 ELSE 0 END)`,
            highPriorityTasks: sql<number>`SUM(CASE WHEN ${tasks.priority} IN ('high', 'critical') THEN 1 ELSE 0 END)`,
            completedHighPriorityTasks: sql<number>`SUM(CASE WHEN ${tasks.status} IN ('done', 'finished') AND ${tasks.priority} IN ('high', 'critical') THEN 1 ELSE 0 END)`,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.assignedUserId, member.userId),
              sql`${tasks.status} NOT IN ('cancelled', 'on_hold')`
            )
          )
          .execute();

        const taskData = memberTasks[0] || { 
          totalTasks: 0, 
          completedTasks: 0, 
          overdueTasks: 0, 
          highPriorityTasks: 0, 
          completedHighPriorityTasks: 0 
        };

        // Calculate weighted workload percentage - FIXED: Better workload calculation
        const totalWeightedTasks = Number(taskData.totalTasks) + (Number(taskData.highPriorityTasks) * 0.5);
        const completedWeightedTasks = Number(taskData.completedTasks) + (Number(taskData.completedHighPriorityTasks) * 0.5);
        
        const workloadPercentage = totalWeightedTasks > 0 
          ? Math.round((completedWeightedTasks / totalWeightedTasks) * 100)
          : 0;

        return {
          userId: member.userId,
          user: member.user,
          role: member.role || 'member',
          totalTasks: Number(taskData.totalTasks),
          completedTasks: Number(taskData.completedTasks),
          overdueTasks: Number(taskData.overdueTasks),
          highPriorityTasks: Number(taskData.highPriorityTasks),
          completedHighPriorityTasks: Number(taskData.completedHighPriorityTasks),
          workloadPercentage,
        };
      })
    );

    return {
      teamId: bestTeam.teamId,
      team: bestTeam.team,
      completionRate: bestTeam.completionRate,
      onTimeDeliveryRate: bestTeam.onTimeDeliveryRate,
      efficiencyScore: bestTeam.efficiencyScore,
      priorityBonus: bestTeam.priorityBonus,
      overallScore: bestTeam.overallScore,
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

  async getSegmentLeader(segment: "academic" | "parastals" | "private"): Promise<any> {
    try {
      // Get segment leader from the segmentLeaders table
      const [leader] = await db
        .select({
          segment: segmentLeaders.segment,
          leaderEmail: segmentLeaders.leaderEmail,
          leaderName: segmentLeaders.leaderName
        })
        .from(segmentLeaders)
        .where(eq(segmentLeaders.segment, segment));
      
      if (!leader) {
        return null;
      }
      
      return leader;
    } catch (error) {
      console.error('Error fetching segment leader:', error);
      return null;
    }
  }

  async updateSegmentLeaders(data: {
    academic: { name: string; email: string };
    parastals: { name: string; email: string };
    private: { name: string; email: string };
    financeEmail: string;
    accountManagerEmail: string;
  }): Promise<void> {
    try {
      // Update academic segment leader
      await db
        .insert(segmentLeaders)
        .values({
          segment: 'academic',
          leaderName: data.academic.name,
          leaderEmail: data.academic.email,
        })
        .onConflictDoUpdate({
          target: segmentLeaders.segment,
          set: {
            leaderName: data.academic.name,
            leaderEmail: data.academic.email,
            updatedAt: new Date(),
          },
        });

      // Update parastals segment leader
      await db
        .insert(segmentLeaders)
        .values({
          segment: 'parastals',
          leaderName: data.parastals.name,
          leaderEmail: data.parastals.email,
        })
        .onConflictDoUpdate({
          target: segmentLeaders.segment,
          set: {
            leaderName: data.parastals.name,
            leaderEmail: data.parastals.email,
            updatedAt: new Date(),
          },
        });

      // Update private segment leader
      await db
        .insert(segmentLeaders)
        .values({
          segment: 'private',
          leaderName: data.private.name,
          leaderEmail: data.private.email,
        })
        .onConflictDoUpdate({
          target: segmentLeaders.segment,
          set: {
            leaderName: data.private.name,
            leaderEmail: data.private.email,
            updatedAt: new Date(),
          },
        });

      // Save finance and account manager emails to system configuration
      await this.setSystemConfig('financeEmail', data.financeEmail, 'Finance department email for notifications');
      await this.setSystemConfig('accountManagerEmail', data.accountManagerEmail, 'Account manager email for project forecasts');
      

    } catch (error) {
      console.error('Error updating segment leaders:', error);
      throw error;
    }
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

  // System configuration methods
  async getSystemConfig(key: string): Promise<string | null> {
    const [config] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, key));
    return config?.value || null;
  }

  async setSystemConfig(key: string, value: string, description?: string): Promise<void> {
    await db
      .insert(systemConfig)
      .values({ key, value, description })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value,
          description,
          updatedAt: new Date(),
        },
      });
  }

  async getFinanceAndAccountManagerEmails(): Promise<{ financeEmail: string; accountManagerEmail: string }> {
    const financeEmail = await this.getSystemConfig('financeEmail');
    const accountManagerEmail = await this.getSystemConfig('accountManagerEmail');
    return {
      financeEmail: financeEmail || '',
      accountManagerEmail: accountManagerEmail || '',
    };
  }

  // Subtask operations
  async getSubtasksByMilestone(milestoneId: string): Promise<any[]> {
    const result = await db
      .select({
        subtask: subtasks,
        assignedUser: users,
      })
      .from(subtasks)
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(eq(subtasks.milestoneId, milestoneId))
      .orderBy(asc(subtasks.createdAt));

    // Get dependencies for each subtask
    const subtasksWithDeps = await Promise.all(
      result.map(async (row) => {
        const deps = await this.getSubtaskDependencies(row.subtask.id);
        return {
          ...row.subtask,
          assignedUser: row.assignedUser,
          dependencies: deps.map(d => d.dependsOnSubtaskId)
        };
      })
    );

    return subtasksWithDeps;
  }

  async createSubtask(subtask: any): Promise<any> {
    const [newSubtask] = await db
      .insert(subtasks)
      .values({
        name: subtask.name,
        description: subtask.description || null,
        status: subtask.status || 'not_started',
        priority: subtask.priority || 'medium',
        startDate: subtask.startDate || null,
        dueDate: subtask.dueDate || null,
        estimatedHours: subtask.estimatedHours || null,
        estimatedDays: subtask.estimatedDays || null,
        actualHours: subtask.actualHours || 0,
        actualDays: subtask.actualDays || 0,
        progressPercent: subtask.progressPercent || 0,
        milestoneId: subtask.milestoneId,
        assignedUserId: subtask.assignedUserId || null,
        createdById: subtask.createdById,
      })
      .returning();
    return newSubtask;
  }

  async updateSubtask(id: string, subtask: any): Promise<any> {
    const updateData: any = { updatedAt: new Date() };
    
    if (subtask.name !== undefined) updateData.name = subtask.name;
    if (subtask.description !== undefined) updateData.description = subtask.description;
    if (subtask.status !== undefined) updateData.status = subtask.status;
    if (subtask.priority !== undefined) updateData.priority = subtask.priority;
    if (subtask.startDate !== undefined) updateData.startDate = subtask.startDate;
    if (subtask.dueDate !== undefined) updateData.dueDate = subtask.dueDate;
    if (subtask.estimatedHours !== undefined) updateData.estimatedHours = subtask.estimatedHours;
    if (subtask.estimatedDays !== undefined) updateData.estimatedDays = subtask.estimatedDays;
    if (subtask.actualHours !== undefined) updateData.actualHours = subtask.actualHours;
    if (subtask.actualDays !== undefined) updateData.actualDays = subtask.actualDays;
    if (subtask.progressPercent !== undefined) updateData.progressPercent = subtask.progressPercent;
    if (subtask.assignedUserId !== undefined) updateData.assignedUserId = subtask.assignedUserId;
    if (subtask.completedAt !== undefined) updateData.completedAt = subtask.completedAt;

    const [updatedSubtask] = await db
      .update(subtasks)
      .set(updateData)
      .where(eq(subtasks.id, id))
      .returning();
      
    // Update milestone progress after subtask update
    if (updatedSubtask && updatedSubtask.milestoneId) {
      await this.updateMilestoneProgressFromSubtasks(updatedSubtask.milestoneId);
    }
    
    return updatedSubtask;
  }

  async deleteSubtask(id: string): Promise<void> {
    // Get subtask info before deletion to update milestone progress
    const [subtask] = await db
      .select({ milestoneId: subtasks.milestoneId })
      .from(subtasks)
      .where(eq(subtasks.id, id));
    
    // Delete dependencies first
    await db
      .delete(subtaskDependencies)
      .where(or(
        eq(subtaskDependencies.subtaskId, id),
        eq(subtaskDependencies.dependsOnSubtaskId, id)
      ));
    
    // Delete the subtask
    await db
      .delete(subtasks)
      .where(eq(subtasks.id, id));
    
    // Update milestone progress
    if (subtask?.milestoneId) {
      await this.updateMilestoneProgressFromSubtasks(subtask.milestoneId);
    }
  }

  async getSubtaskDependencies(subtaskId: string): Promise<any[]> {
    return await db
      .select()
      .from(subtaskDependencies)
      .where(eq(subtaskDependencies.subtaskId, subtaskId));
  }

  async updateMilestoneProgressFromSubtasks(milestoneId: string): Promise<void> {
    // Get all subtasks for this milestone
    const result = await db
      .select({
        total: count(),
        completed: sql<number>`COUNT(*) FILTER (WHERE ${subtasks.status} = 'finished')`,
      })
      .from(subtasks)
      .where(eq(subtasks.milestoneId, milestoneId));

    const stats = result[0];
    if (stats && Number(stats.total) > 0) {
      const progress = Math.round((Number(stats.completed) / Number(stats.total)) * 100);
      
      // Update the milestone's progress
      await db
        .update(tasks)
        .set({ progressPercent: progress, updatedAt: new Date() })
        .where(eq(tasks.id, milestoneId));
    }
  }
}

export const storage = new DatabaseStorage();
