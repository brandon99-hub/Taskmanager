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
import { eq, desc, asc, and, or, sql, count, avg } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Team operations
  getTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team>;
  deleteTeam(id: string): Promise<void>;
  getTeamMembers(teamId: string): Promise<(TeamMember & { user: User })[]>;
  addTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;

  // Project operations
  getProjects(): Promise<(Project & { manager: User; team: Team | null })[]>;
  getProject(id: string): Promise<(Project & { manager: User; team: Team | null; tasks: Task[] }) | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  updateProjectProgress(id: string): Promise<void>;
  getProjectsByManager(managerId: string): Promise<Project[]>;
  getProjectsByTeam(teamId: string): Promise<Project[]>;

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

  // Dashboard analytics
  getDashboardMetrics(): Promise<{
    activeProjects: number;
    completedTasks: number;
    overdueTasks: number;
    teamMembers: number;
  }>;
  getTeamWorkload(): Promise<{
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

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
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

  // Project operations
  async getProjects(): Promise<(Project & { manager: User; team: Team | null })[]> {
    return await db
      .select()
      .from(projects)
      .leftJoin(users, eq(projects.managerId, users.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .orderBy(desc(projects.createdAt))
      .then(rows => rows.map(row => ({
        ...row.projects,
        manager: row.users!,
        team: row.teams
      })));
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

    return updatedTask;
  }

  async deleteTask(id: string): Promise<void> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    await db.delete(tasks).where(eq(tasks.id, id));
    
    if (task) {
      await this.updateProjectProgress(task.projectId);
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
}

export const storage = new DatabaseStorage();
