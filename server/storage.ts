import {
  users,
  teams,
  projects,
  tasks,
  teamMembers,
  projectAttachments,
  taskDependencies,
  notifications,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, sql, count, avg, inArray } from "drizzle-orm";

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
  deleteTeam(id: string): Promise<void>;
  getTeamMembers(teamId: string): Promise<(TeamMember & { user: User })[]>;
  addTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;
  isUserInTeam(teamId: string, userId: string): Promise<boolean>;

  // Project operations
  getProjects(): Promise<(Project & { manager: User; team: Team | null; milestoneCount: number; completedMilestoneCount: number; paidAmount: number })[]>;
  getProject(id: string): Promise<(Project & { manager: User; team: Team | null; tasks: Task[] }) | undefined>;
  getProjectsForUser(userId: string): Promise<(Project & { manager: User; team: Team | null })[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  updateProjectProgress(id: string): Promise<void>;
  getProjectsByManager(managerId: string): Promise<Project[]>;
  getProjectsByTeam(teamId: string): Promise<Project[]>;
  recalculateProjectBudget(projectId: string): Promise<void>;
  updateProjectStatusBasedOnMilestones(projectId: string): Promise<void>;

  // Task operations
  getTasks(): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getTask(id: string): Promise<(Task & { project: Project; assignedUser: User | null }) | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  getTasksByProject(projectId: string): Promise<(Task & { assignedUser: User | null })[]>;
  getTasksByUser(userId: string): Promise<(Task & { project: Project })[]>;
  getOverdueTasks(): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getUpcomingTasks(days: number): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getOverdueTasksForUser(userId: string): Promise<(Task & { project: Project; assignedUser: User | null })[]>;
  getUpcomingTasksForUser(userId: string, days: number): Promise<(Task & { project: Project; assignedUser: User | null })[]>;

  // Dashboard analytics
  getDashboardMetrics(): Promise<{
    activeProjects: number;
    completedTasks: number;
    overdueTasks: number;
    teamMembers: number;
  }>;
  getDashboardMetricsForUser(userId: string): Promise<{
    activeProjects: number;
    completedTasks: number;
    overdueTasks: number;
    teamMembers: number;
  }>;
  
  // Enhanced dashboard methods
  getDashboardKanbanTasks(): Promise<{
    overdue: (Task & { project: Project; assignedUser: User | null })[];
    review: (Task & { project: Project; assignedUser: User | null })[];
    recentlyDone: (Task & { project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Task & { project: Project; assignedUser: User | null })[];
  }>;
  getDashboardKanbanTasksForUser(userId: string): Promise<{
    overdue: (Task & { project: Project; assignedUser: User | null })[];
    review: (Task & { project: Project; assignedUser: User | null })[];
    recentlyDone: (Task & { project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Task & { project: Project; assignedUser: User | null })[];
  }>;
  getBestPerformingTeam(): Promise<{
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
  } | null>;
  getTeamsCountForUser(userId: string): Promise<number>;
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

  // Notification operations
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // File operations
  getProjectAttachments(projectId: string): Promise<(ProjectAttachment & { uploadedBy: User })[]>;
  createProjectAttachment(attachment: InsertProjectAttachment): Promise<ProjectAttachment>;
  deleteProjectAttachment(id: string): Promise<void>;

  // Task dependency operations
  getTaskDependencies(taskId: string): Promise<(TaskDependency & { dependsOnTask: Task })[]>;
  createTaskDependency(dependency: InsertTaskDependency): Promise<TaskDependency>;
  deleteTaskDependency(id: string): Promise<void>;
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

  async deleteTeam(id: string): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
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

  async getProjectsForUser(userId: string): Promise<(Project & { manager: User; team: Team | null })[]> {
    // By membership
    const byMembership = await db
      .select()
      .from(projects)
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .leftJoin(users, eq(projects.managerId, users.id))
      .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId));

    // By assigned tasks
    const byTasks = await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(projects.managerId, users.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .where(eq(tasks.assignedUserId, userId));

    const combined: Record<string, Project & { manager: User; team: Team | null }> = {};
    for (const r of byMembership) {
      if (r.projects) combined[r.projects.id] = { ...r.projects, manager: r.users!, team: r.teams } as any;
    }
    for (const r of byTasks) {
      if (r.projects) combined[r.projects.id] = { ...r.projects, manager: r.users!, team: r.teams } as any;
    }
    return Object.values(combined);
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

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
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

  async deleteTask(id: string): Promise<void> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    await db.delete(tasks).where(eq(tasks.id, id));
    
    if (task) {
      await this.updateProjectProgress(task.projectId);
      await this.recalculateProjectBudget(task.projectId);
      await this.updateProjectStatusBasedOnMilestones(task.projectId);
    }
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

  // Dashboard analytics
  async getDashboardMetrics(): Promise<{
    activeProjects: number;
    completedTasks: number;
    overdueTasks: number;
    teamMembers: number;
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
      teamMembers: teamMembersResult.count,
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
    teamMembers: number;
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
      teamMembers: teamMembersCount,
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

    return workloadData.map((data) => ({
      userId: data.userId,
      user: data.user,
      totalTasks: data.totalTasks,
      completedTasks: Number(data.completedTasks),
      workloadPercentage:
        data.totalTasks > 0
          ? Math.round((Number(data.completedTasks) / data.totalTasks) * 100)
          : 0,
    }));
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

  // File operations
  async getProjectAttachments(projectId: string): Promise<(ProjectAttachment & { uploadedBy: User })[]> {
    return await db
      .select()
      .from(projectAttachments)
      .leftJoin(users, eq(projectAttachments.uploadedById, users.id))
      .where(eq(projectAttachments.projectId, projectId))
      .orderBy(desc(projectAttachments.uploadedAt))
      .then(rows => rows.map(row => ({
        ...row.project_attachments,
        uploadedBy: row.users!
      })));
  }

  async createProjectAttachment(attachment: InsertProjectAttachment): Promise<ProjectAttachment> {
    const [newAttachment] = await db.insert(projectAttachments).values(attachment).returning();
    return newAttachment;
  }

  async deleteProjectAttachment(id: string): Promise<void> {
    await db.delete(projectAttachments).where(eq(projectAttachments.id, id));
  }

  // Task dependency operations
  async getTaskDependencies(taskId: string): Promise<(TaskDependency & { dependsOnTask: Task })[]> {
    return await db
      .select()
      .from(taskDependencies)
      .leftJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
      .where(eq(taskDependencies.taskId, taskId))
      .then(rows => rows.map(row => ({
        ...row.task_dependencies,
        dependsOnTask: row.tasks!
      })));
  }

  async createTaskDependency(dependency: InsertTaskDependency): Promise<TaskDependency> {
    const [newDependency] = await db.insert(taskDependencies).values(dependency).returning();
    return newDependency;
  }

  async deleteTaskDependency(id: string): Promise<void> {
    await db.delete(taskDependencies).where(eq(taskDependencies.id, id));
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

  async getTeamsCountForUser(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .execute();

    return result[0]?.count || 0;
  }
}

export const storage = new DatabaseStorage();
