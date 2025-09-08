import {
  users,
  teams,
  projects,
  modules,
  milestones,
  moduleMilestones,
  teamMembers,
  projectAttachments,
  moduleDependencies,
  notifications,
  userNotificationPreferences,
  userCalendarSettings,
  invoiceReports,
  monthlyTargets,
  invoiceCollections,
  subtasks,
  subtaskDependencies,
  projectPhases,
  contracts,
  type User,
  type UpsertUser,
  type Team,
  type InsertTeam,
  type Project,
  type InsertProject,
  type Module,
  type InsertModule,
  type Milestone,
  type InsertMilestone,
  type Subtask,
  type InsertSubtask,
  type TeamMember,
  type InsertTeamMember,
  type ProjectAttachment,
  type InsertProjectAttachment,
  type ModuleDependency,
  type InsertModuleDependency,
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
  adminRoles,
  type AdminRole,
  type InsertAdminRole,
  type AdminRoleType,
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, sql, count, avg, inArray, gt, lte, ne } from "drizzle-orm";

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
  getTeams(): Promise<(Team & { projects: Project[] })[]>;
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
  getProject(id: string): Promise<(Project & { manager: User; team: Team | null; modules: Module[] }) | undefined>;
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

  // Module operations
  getModules(): Promise<(Module & { project: Project; assignedUser: User | null })[]>;
  getModule(id: string): Promise<(Module & { project: Project; assignedUser: User | null }) | undefined>;
  createModule(module: InsertModule): Promise<Module>;
  updateModule(id: string, module: Partial<InsertModule>): Promise<Module>;
  getModulesByProject(projectId: string): Promise<(Module & { assignedUser: User | null; subtasks: any[] })[]>;
  getModulesByUser(userId: string): Promise<(Module & { project: Project })[]>;
  getOverdueModules(): Promise<(Module & { project: Project; assignedUser: User | null })[]>;
  getUpcomingModules(days: number): Promise<(Module & { project: Project; assignedUser: User | null })[]>;
  getOverdueModulesForUser(userId: string): Promise<(Module & { project: Project; assignedUser: User | null })[]>;
  getUpcomingModulesForUser(userId: string, days: number): Promise<(Module & { project: Project; assignedUser: User | null })[]>;

  // Subtask operations
  getSubtask(id: string): Promise<any>;
  getSubtasksByModule(moduleId: string): Promise<any[]>;
  createSubtask(subtask: any): Promise<any>;
  updateSubtask(id: string, subtask: any): Promise<any>;
  deleteSubtask(id: string): Promise<void>;
  getSubtaskDependencies(subtaskId: string): Promise<any[]>;

  // Milestone operations (for invoicable entities)
  getMilestones(): Promise<(Milestone & { project: Project; modules: Module[] })[]>;
  getMilestone(id: string): Promise<(Milestone & { project: Project; modules: Module[] }) | undefined>;
  createMilestone(milestone: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, milestone: Partial<InsertMilestone>): Promise<Milestone>;
  deleteMilestone(id: string): Promise<void>;
  getMilestonesByProject(projectId: string): Promise<(Milestone & { modules: Module[] })[]>;
  addModuleToMilestone(milestoneId: string, moduleId: string): Promise<void>;
  removeModuleFromMilestone(milestoneId: string, moduleId: string): Promise<void>;

  // Invoice and reporting operations
  getInvoiceReport(year: number, month?: number): Promise<any>; // New method for invoice reports
  getMonthlyTargets(year: number): Promise<any[]>; // New method for monthly targets
  calculateMonthlyTargets(year: number): Promise<void>; // New method for auto-calculating targets
  createInvoiceReport(invoice: any): Promise<any>; // New method for creating invoice reports
  updateInvoiceStatus(invoiceId: string, status: string): Promise<any>; // New method for updating invoice status
  recordInvoiceCollection(collection: any): Promise<any>; // New method for recording payments

  // Phase operations (for project phases)
  getProjectPhases(projectId: string): Promise<any[]>;
  createProjectPhases(projectId: string): Promise<any[]>;
  getProjectPhase(phaseId: string): Promise<any>;
  updateProjectPhase(phaseId: string, phase: any): Promise<any>;
  completeProjectPhase(phaseId: string, completionReport: any): Promise<any>;
  getPhaseDeliverables(phaseId: string): Promise<any[]>;
  addPhaseDeliverable(phaseId: string, deliverable: any): Promise<any>;
  updatePhaseDeliverable(deliverableId: string, deliverable: any): Promise<any>;
  completePhaseDeliverable(deliverableId: string): Promise<any>;
  getPhaseReports(phaseId: string): Promise<any[]>;
  createPhaseReport(phaseId: string, report: any): Promise<any>;

  // Contract operations
  getContracts(): Promise<any[]>;
  getContract(contractId: string): Promise<any>;
  createContract(contract: any): Promise<any>;
  updateContract(contractId: string, contract: any): Promise<any>;

  // Project charter operations
  getProjectCharter(projectId: string): Promise<any>;
  createProjectCharter(projectId: string, charter: any): Promise<any>;
  updateProjectCharter(projectId: string, charter: any): Promise<any>;

  // Module deadline and status operations
  checkModuleDeadlines(): Promise<void>;
  updateModuleStatusFromSubtasks(moduleId: string): Promise<void>;
  updatePhaseStatusFromMilestones(phaseId: string): Promise<void>;
  updatePhaseStatusFromModules(projectId: string, phaseNumber: number): Promise<void>;

  // Additional methods needed by routes
  getUpcomingTasksForUser(userId: string, days: number): Promise<(Module & { project: Project; assignedUser: User | null })[]>;
  getOverdueTasksForUser(userId: string, days: number): Promise<(Module & { project: Project; assignedUser: User | null })[]>;
  getTasksByProject(projectId: string): Promise<(Module & { assignedUser: User | null; subtasks: any[] })[]>;
  getTasksByUser(userId: string): Promise<(Module & { project: Project })[]>;
  createTask(task: InsertModule): Promise<Module>;
  updateTask(id: string, task: Partial<InsertModule>): Promise<Module>;
  getTask(id: string): Promise<(Module & { project: Project; assignedUser: User | null }) | undefined>;
  getTasks(): Promise<(Module & { project: Project; assignedUser: User | null })[]>;

  // Task dependency operations (for backward compatibility)
  getTaskDependencies(taskId: string): Promise<any[]>;
  createTaskDependency(dependency: any): Promise<any>;
  deleteTaskDependency(dependencyId: string): Promise<void>;

  // Dashboard analytics
  getDashboardMetrics(): Promise<{
    activeProjects: number;
    completedModules: number;
    overdueModules: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    milestonesCount: number;
    projectsOnSupport: number;
    onSupportProjects: number;
  }>;
  getDashboardMetricsForUser(userId: string): Promise<{
    totalTeamProjects: number;
    activeTeamProjects: number;
    assignedSubtasks: number;
    completedSubtasks: number;
    completedModules: number;
    totalModules: number;
    overdueModules: number;
    overdueSubtasks: number;
    totalOverdue: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    milestonesCount: number;
  }>;
  getDashboardMetricsForSegment(segment: string): Promise<{
    activeProjects: number;
    completedModules: number;
    overdueModules: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    milestonesCount: number;
    projectsOnSupport: number;
    onSupportProjects: number;
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
    totalModules: number;
    completedModules: number;
    workloadPercentage: number;
  }[]>;
  getDashboardKanbanTasks(): Promise<{
    overdue: (Module & { project: Project; assignedUser: User | null })[];
    review: (Module & { project: Project; assignedUser: User | null })[];
    recentlyDone: (Module & { project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Module & { project: Project; assignedUser: User | null })[];
  }>;
  
  // Project Management Dashboard methods
  getProjectPerformanceData(year: number, month?: number): Promise<{
    projects: (Project & { manager: User; team: Team | null; progress: number })[];
    ganttData: any;
    performanceMetrics: {
      totalProjects: number;
      moduleProgress: number;
      teamCapacity: number;
      timelineHealth: number;
    };
  }>;
  
  getRiskQualityData(year: number, month?: number): Promise<{
    supportProjects: any[];
    riskTrends: any[];
  }>;
  getDashboardKanbanTasksForUser(userId: string): Promise<{
    overdue: (Module & { project: Project; assignedUser: User | null })[];
    review: (Module & { project: Project; assignedUser: User | null })[];
    recentlyDone: (Module & { project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Module & { project: Project; assignedUser: User | null })[];
  }>;
  getDashboardKanbanSubtasks(): Promise<{
    overdue: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    review: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    recentlyDone: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    fcReview: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
  }>;
  getDashboardKanbanSubtasksForUser(userId: string): Promise<{
    overdue: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    review: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    recentlyDone: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    fcReview: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
  }>;
  getOverdueBreakdownForUser(userId: string): Promise<{
    overdueModules: (Module & { project: Project; assignedUser: User | null })[];
    overdueSubtasks: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
  }>;

  // Aggregated assignments for a user across all teams/projects
  getUserAssignments(userId: string): Promise<{
    projects: Project[];
    subtasks: (Subtask & { module: Module; project: Project })[];
  }>;

  getBestPerformingTeam(): Promise<{
    teamId: string;
    team: Team;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    onTimeDeliveryRate: number;
    efficiencyScore: number;
    priorityBonus: number;
    overallScore: number;
    members: {
      userId: string;
      user: User;
      role: string;
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
  updateUserPassword(userId: string, newPassword: string, isFirstChange?: boolean): Promise<void>;

  // Admin role management operations
  getAdminRoles(): Promise<(AdminRole & { user: User; assignedByUser: User })[]>;
  getAdminRolesByUser(userId: string): Promise<AdminRole[]>;
  assignAdminRole(roleData: InsertAdminRole): Promise<AdminRole>;
  removeAdminRole(userId: string, roleType: AdminRoleType, segment?: string): Promise<void>;
  getUserDashboardRole(userId: string): Promise<{ role: string; isProjectManager: boolean; isFinanceHead: boolean; assignedSegment?: string }>;
  getSegmentLeaderData(): Promise<{ academic: any; parastals: any; private: any; projectManager: any; financeHead: any }>;
  createUserWithCredentials(userData: { email: string; firstName: string; lastName: string; role: AdminRoleType; segment?: string }, assignedBy: string): Promise<{ user: User; temporaryPassword: string }>;
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
      .set({ lastLoginAt: new Date(), updatedAt: new Date() } as any)
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
          updatedAt: new Date() as any,
        } as any,
      })
      .returning();
    return user;
  }

  // Dashboard analytics
  async getDashboardMetrics(): Promise<{
    totalProjects: number;
    activeProjects: number;
    completedModules: number;
    totalModules: number;
    overdueModules: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    milestonesCount: number;
    projectsOnSupport: number;
    onSupportProjects: number;
  }> {
    const allProjects = await db.select({ count: count() }).from(projects);
    const activeProjects = await db.select({ count: count() }).from(projects).where(eq(projects.status, "active"));
    const completedModules = await db.select({ count: count() }).from(modules).where(eq(modules.status, "completed"));
    const totalModules = await db.select({ count: count() }).from(modules);
    const overdueModules = await db.select({ count: count() }).from(modules).where(and(
      sql`${modules.dueDate} < CURRENT_DATE`,
      sql`${modules.status} NOT IN ('completed', 'cancelled')`
    ));
    const totalBudget = await db.select({ total: sql`SUM(${projects.budget})` }).from(projects);
    const collectedAmount = await db.select({ total: sql`SUM(${invoiceCollections.amount})` }).from(invoiceCollections);
    const pendingAmount = await db.select({ total: sql`SUM(${projects.budget}) - SUM(${invoiceCollections.amount})` }).from(projects).leftJoin(invoiceCollections, eq(projects.id, invoiceCollections.projectId));
    const milestonesCount = await db.select({ count: count() }).from(milestones);
    const projectsOnSupport = await db.select({ count: count() }).from(projects).where(eq(projects.status, "on_support"));
    const onSupportProjects = await db.select({ count: count() }).from(projects).where(eq(projects.status, "on_support"));

    return {
      totalProjects: allProjects[0]?.count || 0,
      activeProjects: activeProjects[0]?.count || 0,
      completedModules: completedModules[0]?.count || 0,
      totalModules: totalModules[0]?.count || 0,
      overdueModules: overdueModules[0]?.count || 0,
      totalBudget: Number(totalBudget[0]?.total) || 0,
      collectedAmount: Number(collectedAmount[0]?.total) || 0,
      pendingAmount: Number(pendingAmount[0]?.total) || 0,
      milestonesCount: milestonesCount[0]?.count || 0,
      projectsOnSupport: projectsOnSupport[0]?.count || 0,
      onSupportProjects: onSupportProjects[0]?.count || 0,
    };
  }

  // Team operations
  async getTeams(): Promise<(Team & { projects: Project[] })[]> {
    const result = await db
      .select({
        team: teams,
        project: projects,
      })
      .from(teams)
      .leftJoin(projects, eq(teams.id, projects.teamId))
      .orderBy(asc(teams.name));

    // Group projects by team
    const teamMap = new Map<string, Team & { projects: Project[] }>();
    
    result.forEach(row => {
      if (!teamMap.has(row.team.id)) {
        teamMap.set(row.team.id, {
          ...row.team,
          projects: []
        });
      }
      
      if (row.project) {
        teamMap.get(row.team.id)!.projects.push(row.project);
      }
    });

    return Array.from(teamMap.values());
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
    const [newTeam] = await db.insert(teams).values(team as any).returning();
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
        // Count total subtasks assigned to this user in projects under this team
        const totalTasksResult = await db
          .select({ count: count() })
          .from(subtasks)
          .leftJoin(modules, eq(subtasks.moduleId, modules.id))
          .leftJoin(projects, eq(modules.projectId, projects.id))
          .where(
            and(
              eq(projects.teamId, teamId),
              or(
                eq(subtasks.assignedUserId, member.userId),
                eq(subtasks.assignedDevId, member.userId),
                eq(subtasks.assignedConsultantId, member.userId)
              )
            )
          );
        
        const totalTasks = Number(totalTasksResult[0]?.count || 0);
        
        // Count completed subtasks
        const completedTasksResult = await db
          .select({ count: count() })
          .from(subtasks)
          .leftJoin(modules, eq(subtasks.moduleId, modules.id))
          .leftJoin(projects, eq(modules.projectId, projects.id))
          .where(
            and(
              eq(projects.teamId, teamId),
              eq(subtasks.status, 'completed'),
              or(
                eq(subtasks.assignedUserId, member.userId),
                eq(subtasks.assignedDevId, member.userId),
                eq(subtasks.assignedConsultantId, member.userId)
              )
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
    
    // Calculate total subtasks for the team
    const totalTasksResult = await db
      .select({ count: count() })
      .from(subtasks)
      .leftJoin(modules, eq(subtasks.moduleId, modules.id))
      .leftJoin(projects, eq(modules.projectId, projects.id))
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
    const [newMember] = await db.insert(teamMembers).values(member as any).returning();
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
    // Step 1: fetch base projects with manager and team
    const baseRows = await db
      .select({
        project: projects,
        manager: users,
        team: teams,
      })
      .from(projects)
      .leftJoin(users, eq(projects.managerId, users.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .orderBy(desc(projects.createdAt));

    const projectIds = baseRows.map(r => r.project.id);
    if (projectIds.length === 0) {
      return [];
    }

    // Step 2: aggregate milestones per project
    const aggRows = await db
      .select({
        projectId: milestones.projectId,
        milestoneCount: count(milestones.id),
        completedMilestoneCount: sql<number>`SUM(CASE WHEN ${milestones.billingStatus} = 'paid' THEN 1 ELSE 0 END)`,
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${milestones.billingStatus} = 'sent' THEN ${milestones.feeAmount} ELSE 0 END), 0)`,
      })
      .from(milestones)
      .where(inArray(milestones.projectId, projectIds))
      .groupBy(milestones.projectId);

    const projectIdToAgg: Record<string, { milestoneCount: number; completedMilestoneCount: number; paidAmount: number }> = {};
    for (const row of aggRows) {
      projectIdToAgg[row.projectId] = {
        milestoneCount: Number(row.milestoneCount || 0),
        completedMilestoneCount: Number(row.completedMilestoneCount || 0),
        paidAmount: Number(row.paidAmount || 0),
      };
    }

    // Step 3: merge
    return baseRows.map(r => {
      const agg = projectIdToAgg[r.project.id] || { milestoneCount: 0, completedMilestoneCount: 0, paidAmount: 0 };
      return {
        ...r.project,
        manager: r.manager!,
        team: r.team ?? null,
        milestoneCount: agg.milestoneCount,
        completedMilestoneCount: agg.completedMilestoneCount,
        paidAmount: agg.paidAmount,
      };
    });
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
    const byModules = await db
      .select({ projectId: projects.id })
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .where(eq(modules.assignedUserId, userId));
    
    byModules.forEach(r => {
      if (r.projectId) userProjectIds.add(r.projectId);
    });

    if (userProjectIds.size === 0) {
      return [];
    }

    // Now fetch complete project data
    const baseRows = await db
      .select({
        project: projects,
        manager: users,
        team: teams,
      })
      .from(projects)
      .leftJoin(users, eq(projects.managerId, users.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .where(inArray(projects.id, Array.from(userProjectIds)))
      .orderBy(desc(projects.createdAt));

    if (baseRows.length === 0) {
      return [];
    }

    const projectIds = baseRows.map(r => r.project.id);
    const aggRows = await db
      .select({
        projectId: milestones.projectId,
        milestoneCount: count(milestones.id),
        completedMilestoneCount: sql<number>`SUM(CASE WHEN ${milestones.billingStatus} = 'paid' THEN 1 ELSE 0 END)`,
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${milestones.billingStatus} = 'sent' THEN ${milestones.feeAmount} ELSE 0 END), 0)`,
      })
      .from(milestones)
      .where(inArray(milestones.projectId, projectIds))
      .groupBy(milestones.projectId);

    const projectIdToAgg: Record<string, { milestoneCount: number; completedMilestoneCount: number; paidAmount: number }> = {};
    for (const row of aggRows) {
      projectIdToAgg[row.projectId] = {
        milestoneCount: Number(row.milestoneCount || 0),
        completedMilestoneCount: Number(row.completedMilestoneCount || 0),
        paidAmount: Number(row.paidAmount || 0),
      };
    }

    return baseRows.map(r => {
      const agg = projectIdToAgg[r.project.id] || { milestoneCount: 0, completedMilestoneCount: 0, paidAmount: 0 };
      return {
        ...r.project,
        manager: r.manager!,
        team: r.team ?? null,
        milestoneCount: agg.milestoneCount,
        completedMilestoneCount: agg.completedMilestoneCount,
        paidAmount: agg.paidAmount,
      };
    });
  }

  async getProject(id: string): Promise<(Project & { manager: User; team: Team | null; modules: Module[] }) | undefined> {
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

    const projectModules = await db
      .select()
      .from(modules)
      .where(eq(modules.projectId, id))
      .orderBy(asc(modules.createdAt));

    return {
      ...project,
      modules: projectModules
    };
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project as any).returning();
    return newProject;
  }

  async updateProject(id: string, project: Partial<InsertProject>): Promise<Project> {
    const [updatedProject] = await db
      .update(projects)
              .set({ ...project, updatedAt: new Date() } as any)
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  async terminateProject(id: string): Promise<Project> {
    const [project] = await db
      .update(projects)
              .set({ status: 'terminated' as const, updatedAt: new Date() } as any)
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async updateProjectProgress(id: string): Promise<void> {
    const projectModules = await db
      .select()
      .from(modules)
      .where(eq(modules.projectId, id));

    if (projectModules.length === 0) {
              await db.update(projects).set({ progress: 0 } as any).where(eq(projects.id, id));
      return;
    }

    // Calculate progress based on priority weights and status progression
    // Weights: low=1, medium=2, high=3, critical=4
    let totalWeight = 0;
    let weightedProgress = 0;

    // Status to progress percentage mapping
    const getStatusProgress = (status: string): number => {
      switch (status) {
        case 'not_started':
          return 0;
        case 'in_progress':
          return 25;
        case 'fc_review':
          return 50;
        case 'qa':
          return 60;
        case 'client_review':
          return 75;
        case 'completed':
        case 'done':
          return 100;
        case 'on_hold':
          return 10; // Minimal progress for on hold items
        case 'cancelled':
          return 0;
        default:
          return 0;
      }
    };

    for (const module of projectModules) {
      // Calculate weight based on priority
      let weight = 2; // default medium weight
      switch (module.priority) {
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
      
      // Calculate weighted progress based on status
      const statusProgress = getStatusProgress(module.status);
      weightedProgress += (statusProgress * weight);
    }

    // Calculate percentage based on weighted progress
    const progress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;

    await db.update(projects).set({ progress } as any).where(eq(projects.id, id));
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
  async getTasks(): Promise<(Module & { project: Project; assignedUser: User | null })[]> {
    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .orderBy(desc(modules.createdAt))
      .then(rows => rows.map(row => ({
        ...row.modules,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getTask(id: string): Promise<(Module & { project: Project; assignedUser: User | null }) | undefined> {
    const [moduleData] = await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(eq(modules.id, id));

    if (!moduleData) return undefined;

    return {
      ...moduleData.modules,
      project: moduleData.projects!,
      assignedUser: moduleData.users
    };
  }

  async createTask(task: InsertModule): Promise<Module> {
    const [newModule] = await db.insert(modules).values(task as any).returning();
    
    // Update project progress
    await this.updateProjectProgress((task as any).projectId);
    // Recalculate project budget when fees exist
    await this.recalculateProjectBudget((task as any).projectId);
    // Auto-update project status based on milestone progress
    await this.updateProjectStatusBasedOnMilestones((task as any).projectId);
    
    return newModule;
  }

  async updateTask(id: string, task: Partial<InsertModule>): Promise<Module> {
    const [updatedModule] = await db
      .update(modules)
      .set({ 
        ...task, 
        updatedAt: new Date() as any,
        completedAt: (task as any).status === 'completed' ? new Date() : undefined
      } as any)
      .where(eq(modules.id, id))
      .returning();

    // Update project progress
    await this.updateProjectProgress(updatedModule.projectId);
    // Recalculate project budget when fees change
    await this.recalculateProjectBudget(updatedModule.projectId);
    // Auto-update project status based on milestone progress
    await this.updateProjectStatusBasedOnMilestones(updatedModule.projectId);

    return updatedModule;
  }



  async getTasksByProject(projectId: string): Promise<(Module & { assignedUser: User | null; subtasks: any[] })[]> {
    // First get all modules for the project
    const projectModules = await db
      .select()
      .from(modules)
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(eq(modules.projectId, projectId))
      .orderBy(asc(modules.phaseNumber), asc(modules.createdAt))
      .then(rows => rows.map(row => ({
        ...row.modules,
        assignedUser: row.users
      })));

    // Then get subtasks for each module
    const modulesWithSubtasks = await Promise.all(
      projectModules.map(async (module) => {
        const subtasksWithUsers = await db
          .select({
            subtask: subtasks,
            assignedUser: users,
          })
          .from(subtasks)
          .leftJoin(users, eq(subtasks.assignedUserId, users.id))
          .where(eq(subtasks.moduleId, module.id))
          .orderBy(asc(subtasks.createdAt));

        return {
          ...module,
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

    return modulesWithSubtasks;
  }

  async getTasksByUser(userId: string): Promise<(Module & { project: Project })[]> {
    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .where(eq(modules.assignedUserId, userId))
      .orderBy(desc(modules.createdAt))
      .then(rows => rows.map(row => ({
        ...row.modules,
        project: row.projects!
      })));
  }

  async getOverdueTasks(): Promise<(Module & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          sql`${modules.dueDate} < ${now}`,
          sql`${modules.status} != 'done'`
        )
      )
      .orderBy(asc(modules.dueDate))
      .then(rows => rows.map(row => ({
        ...row.modules,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getOverdueTasksForUser(userId: string): Promise<(Module & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          eq(modules.assignedUserId, userId),
          sql`${modules.dueDate} < ${now}`,
          sql`${modules.status} != 'done'`
        )
      )
      .orderBy(asc(modules.dueDate))
      .then(rows => rows.map(row => ({
        ...row.modules,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getUpcomingTasks(days: number): Promise<(Module & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          sql`${modules.dueDate} BETWEEN ${now} AND ${futureDate}`,
          sql`${modules.status} != 'done'`
        )
      )
      .orderBy(asc(modules.dueDate))
      .then(rows => rows.map(row => ({
        ...row.modules,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getUpcomingTasksForUser(userId: string, days: number): Promise<(Module & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          eq(modules.assignedUserId, userId),
          sql`${modules.dueDate} BETWEEN ${now} AND ${futureDate}`,
          sql`${modules.status} != 'done'`
        )
      )
      .orderBy(asc(modules.dueDate))
      .then(rows => rows.map(row => ({
        ...row.modules,
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
          id: milestones.id,
          feeAmount: milestones.feeAmount,
          billingStatus: milestones.billingStatus,
          dueDate: milestones.expectedInvoiceDate,
          projectSegment: projects.segment
        })
        .from(milestones)
        .innerJoin(projects, eq(milestones.projectId, projects.id))
        .execute();
      
      // SIMPLE LOGIC: Get revenue based on billing status, not due dates
      
      // 1. Expected Revenue: Sum of all milestone fees for the year
      const expectedRevenue = await db
        .select({
          segment: projects.segment,
          totalAmount: sql<number>`COALESCE(SUM(${milestones.feeAmount}), 0)`
        })
        .from(milestones)
        .innerJoin(projects, eq(milestones.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${milestones.expectedInvoiceDate}) = ${year}`,
            sql`${milestones.feeAmount} IS NOT NULL AND ${milestones.feeAmount} > 0`
          )
        )
        .groupBy(projects.segment)
        .execute();



      // 2. Invoice Sent Revenue: Sum of fees for milestones with billing_status = 'sent'
      const invoiceSentRevenue = await db
        .select({
          segment: projects.segment,
          totalAmount: sql<number>`COALESCE(SUM(${milestones.feeAmount}), 0)`
        })
        .from(milestones)
        .innerJoin(projects, eq(milestones.projectId, projects.id))
        .where(
          and(
            eq(milestones.billingStatus, 'sent'),
            sql`${milestones.feeAmount} IS NOT NULL AND ${milestones.feeAmount} > 0`
          )
        )
        .groupBy(projects.segment)
        .execute();



      // 3. Collected Revenue: Sum of fees for milestones with billing_status = 'paid'
      const collectedRevenue = await db
        .select({
          segment: projects.segment,
          totalAmount: sql<number>`COALESCE(SUM(${milestones.feeAmount}), 0)`
        })
        .from(milestones)
        .innerJoin(projects, eq(milestones.projectId, projects.id))
        .where(
          and(
            eq(milestones.billingStatus, 'paid'),
            sql`${milestones.feeAmount} IS NOT NULL AND ${milestones.feeAmount} > 0`
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
      // Calculate overall totals - FIXED: Convert to numbers before summing
      const totalExpected: number = (Object.values(expectedBySegment) as any[]).reduce((sum: number, amount: any) => sum + Number(amount || 0), 0);
      const totalSent: number = (Object.values(sentBySegment) as any[]).reduce((sum: number, amount: any) => sum + Number(amount || 0), 0);
      const totalPaid: number = (Object.values(paidBySegment) as any[]).reduce((sum: number, amount: any) => sum + Number(amount || 0), 0);

      // Monthly trend with REAL data (12 months) - FIXED: Show actual monthly performance
      const monthlyTrend = [];
      for (let m = 1; m <= 12; m++) {
        // Get ALL milestones due in this month (regardless of completion status)
        const monthExpected = await db
          .select({
            academic: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'academic' THEN ${milestones.feeAmount} ELSE 0 END), 0)`,
            parastals: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'parastals' THEN ${milestones.feeAmount} ELSE 0 END), 0)`,
            private: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'private' THEN ${milestones.feeAmount} ELSE 0 END), 0)`,
            total: sql<number>`COALESCE(SUM(${milestones.feeAmount}), 0)`
          })
          .from(milestones)
          .innerJoin(projects, eq(milestones.projectId, projects.id))
          .where(
            and(
              sql`EXTRACT(YEAR FROM ${milestones.expectedInvoiceDate}) = ${year}`,
              sql`EXTRACT(MONTH FROM ${milestones.expectedInvoiceDate}) = ${m}`,
              sql`${milestones.feeAmount} IS NOT NULL AND ${milestones.feeAmount} > 0`
              // NO status filter - include ALL milestones for the month
            )
          )
          .execute();

        // Get milestones due this month with 'sent' billing status
        const monthSent = await db
          .select({
            academic: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'academic' THEN ${milestones.feeAmount} ELSE 0 END), 0)`,
            parastals: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'parastals' THEN ${milestones.feeAmount} ELSE 0 END), 0)`,
            private: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'private' THEN ${milestones.feeAmount} ELSE 0 END), 0)`,
            total: sql<number>`COALESCE(SUM(${milestones.feeAmount}), 0)`
          })
          .from(milestones)
          .innerJoin(projects, eq(milestones.projectId, projects.id))
          .where(
            and(
              sql`EXTRACT(YEAR FROM ${milestones.expectedInvoiceDate}) = ${year}`,
              sql`EXTRACT(MONTH FROM ${milestones.expectedInvoiceDate}) = ${m}`,
              eq(milestones.billingStatus, 'sent'),
              sql`${milestones.feeAmount} IS NOT NULL AND ${milestones.feeAmount} > 0`
              // NO status filter - include ALL milestones for the month
            )
          )
          .execute();

        // Get milestones due this month with 'paid' billing status
        const monthPaid = await db
          .select({
            academic: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'academic' THEN ${milestones.feeAmount} ELSE 0 END), 0)`,
            parastals: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'parastals' THEN ${milestones.feeAmount} ELSE 0 END), 0)`,
            private: sql<number>`COALESCE(SUM(CASE WHEN ${projects.segment} = 'private' THEN ${milestones.feeAmount} ELSE 0 END), 0)`,
            total: sql<number>`COALESCE(SUM(${milestones.feeAmount}), 0)`
          })
          .from(milestones)
          .innerJoin(projects, eq(milestones.projectId, projects.id))
          .where(
            and(
              sql`EXTRACT(YEAR FROM ${milestones.expectedInvoiceDate}) = ${year}`,
              sql`EXTRACT(MONTH FROM ${milestones.expectedInvoiceDate}) = ${m}`,
              eq(milestones.billingStatus, 'paid'),
              sql`${milestones.feeAmount} IS NOT NULL AND ${milestones.feeAmount} > 0`
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
          month: sql<number>`EXTRACT(MONTH FROM ${milestones.expectedInvoiceDate})`,
          segment: projects.segment,
          totalFees: sql<number>`COALESCE(SUM(${milestones.feeAmount}), 0)`,
          milestoneCount: sql<number>`COUNT(${milestones.id})`
        })
        .from(milestones)
        .innerJoin(projects, eq(milestones.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${milestones.expectedInvoiceDate}) = ${year}`,
            sql`${milestones.feeAmount} IS NOT NULL AND ${milestones.feeAmount} > 0`
          )
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${milestones.expectedInvoiceDate})`, projects.segment)
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
          month: sql<number>`EXTRACT(MONTH FROM ${milestones.expectedInvoiceDate})`,
          segment: projects.segment,
          totalFees: sql<number>`COALESCE(SUM(${milestones.feeAmount}), 0)`,
          milestoneCount: sql<number>`COUNT(${milestones.id})`
        })
        .from(milestones)
        .innerJoin(projects, eq(milestones.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${milestones.expectedInvoiceDate}) = ${year}`,
            sql`${milestones.feeAmount} IS NOT NULL AND ${milestones.feeAmount} > 0`
          )
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${milestones.expectedInvoiceDate})`, projects.segment)
        .execute();

      // Calculate actual amounts for each month/segment - COUNT REVENUE WHEN SENT, NOT WHEN DONE
      const actualsByMonth = await db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${milestones.invoiceSentAt})`, // Use invoiceSentAt for billing
          segment: projects.segment,
          actualAmount: sql<number>`COALESCE(SUM(${milestones.feeAmount}), 0)`
        })
        .from(milestones)
        .innerJoin(projects, eq(milestones.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${milestones.invoiceSentAt}) = ${year}`, // Use invoiceSentAt for billing
            eq(milestones.billingStatus, 'sent'), // Changed from 'done' to 'sent' - count revenue when invoice sent
            sql`${milestones.feeAmount} IS NOT NULL AND ${milestones.feeAmount} > 0`
          )
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${milestones.invoiceSentAt})`, projects.segment)
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
      .select({ sum: sql`COALESCE(SUM(${milestones.feeAmount}), 0)` })
      .from(milestones)
      .where(eq(milestones.projectId, projectId));
    const total = (feeRows?.[0] as any)?.sum ?? 0;
    await db.update(projects).set({ budget: String(total) } as any).where(eq(projects.id, projectId));
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
        .set({ status: newStatus, updatedAt: new Date() } as any)
        .where(eq(projects.id, projectId));
    }
  }

  async getDashboardMetricsForUser(userId: string): Promise<{
    totalTeamProjects: number;
    activeTeamProjects: number;
    assignedSubtasks: number;
    completedSubtasks: number;
    completedModules: number;
    totalModules: number;
    overdueModules: number;
    overdueSubtasks: number;
    totalOverdue: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    milestonesCount: number;
  }> {
    // Get user's team IDs
    const memberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));
    const teamIds = memberships.map((m) => m.teamId);

    // Calculate total and active team projects
    let totalTeamProjects = 0;
    let activeTeamProjects = 0;
    
    if (teamIds.length > 0) {
      const teamProjects = await db
        .select({ id: projects.id, status: projects.status })
        .from(projects)
        .where(inArray(projects.teamId, teamIds));
      
      totalTeamProjects = teamProjects.length;
      activeTeamProjects = teamProjects.filter(p => p.status === 'active').length;
    }

    // Calculate completed modules through user's completed subtasks
    const [completedModulesResult] = await db
      .select({ count: count() })
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .where(
        and(
          or(
            eq(subtasks.assignedUserId, userId),
            eq(subtasks.assignedDevId, userId),
            eq(subtasks.assignedConsultantId, userId)
          ),
          eq(subtasks.status, 'completed')
        )
      );

    // Calculate total unique modules through user's assigned subtasks
    const [totalModulesResult] = await db
      .select({ count: count() })
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .where(
        or(
          eq(subtasks.assignedUserId, userId),
          eq(subtasks.assignedDevId, userId),
          eq(subtasks.assignedConsultantId, userId)
        )
      );
    
    // Get unique module count (distinct modules)
    const uniqueModulesResult = await db
      .selectDistinct({ moduleId: subtasks.moduleId })
      .from(subtasks)
      .where(
        or(
          eq(subtasks.assignedUserId, userId),
          eq(subtasks.assignedDevId, userId),
          eq(subtasks.assignedConsultantId, userId)
        )
      );

    const now = new Date();
    // Calculate overdue modules through user's overdue subtasks
    const [overdueModulesResult] = await db
      .select({ count: count() })
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .where(
        and(
          or(
            eq(subtasks.assignedUserId, userId),
            eq(subtasks.assignedDevId, userId),
            eq(subtasks.assignedConsultantId, userId)
          ),
          sql`${subtasks.dueDate} < ${now}`,
          sql`${subtasks.status} != 'completed'`
        )
      );

    // Calculate overdue subtasks
    const [overdueSubtasksResult] = await db
      .select({ count: count() })
      .from(subtasks)
      .where(
        and(
          or(
            eq(subtasks.assignedUserId, userId),
            eq(subtasks.assignedDevId, userId),
            eq(subtasks.assignedConsultantId, userId)
          ),
          sql`${subtasks.dueDate} < ${now}`,
          sql`${subtasks.status} != 'completed'`
        )
      );

    // Get milestones count for projects this user is associated with
    const [milestonesCountResult] = teamIds.length > 0 ?
      await db
        .select({ count: count() })
        .from(milestones)
        .leftJoin(projects, eq(milestones.projectId, projects.id))
        .where(inArray(projects.teamId, teamIds)) :
      [{ count: 0 }];

    // Get subtask metrics for user
    const [assignedSubtasksResult] = await db
      .select({ count: count() })
      .from(subtasks)
      .where(
        or(
          eq(subtasks.assignedUserId, userId),
          eq(subtasks.assignedDevId, userId),
          eq(subtasks.assignedConsultantId, userId)
        )
      );

    const [completedSubtasksResult] = await db
      .select({ count: count() })
      .from(subtasks)
      .where(
        and(
          or(
            eq(subtasks.assignedUserId, userId),
            eq(subtasks.assignedDevId, userId),
            eq(subtasks.assignedConsultantId, userId)
          ),
          eq(subtasks.status, 'completed')
        )
      );

    const [totalSubtasksResult] = await db
      .select({ count: count() })
      .from(subtasks)
      .where(
        or(
          eq(subtasks.assignedUserId, userId),
          eq(subtasks.assignedDevId, userId),
          eq(subtasks.assignedConsultantId, userId)
        )
      );

    return {
      totalTeamProjects,
      activeTeamProjects,
      assignedSubtasks: assignedSubtasksResult.count,
      completedSubtasks: completedSubtasksResult.count,
      completedModules: completedModulesResult.count,
      totalModules: uniqueModulesResult.length, // Use unique module count
      overdueModules: overdueModulesResult.count,
      overdueSubtasks: overdueSubtasksResult.count,
      totalOverdue: overdueModulesResult.count + overdueSubtasksResult.count,
      totalBudget: 0, // Placeholder
      collectedAmount: 0, // Placeholder
      pendingAmount: 0, // Placeholder
      milestonesCount: milestonesCountResult.count,
    };
  }

  async getDashboardMetricsForSegment(segment: string): Promise<{
    activeProjects: number;
    completedModules: number;
    overdueModules: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    milestonesCount: number;
    projectsOnSupport: number;
    onSupportProjects: number;
  }> {
    // Filter projects by segment
    const [activeProjectsResult] = await db
      .select({ count: count() })
      .from(projects)
      .where(and(
        eq(projects.status, 'active'),
        eq(projects.segment, segment as any)
      ));

    // Get modules from segment projects
    const segmentProjects = await db
      .select({ id: projects.id, budget: projects.budget })
      .from(projects)
      .where(and(
        eq(projects.status, 'active'),
        eq(projects.segment, segment as any)
      ));

    // Get completed modules count for segment projects
    const [completedModulesResult] = await db
      .select({ count: count() })
      .from(modules)
      .where(and(
        inArray(modules.projectId, segmentProjects.map(p => p.id)),
        eq(modules.status, 'completed')
      ));

    // Get overdue modules count for segment projects
    const [overdueModulesResult] = await db
      .select({ count: count() })
      .from(modules)
      .where(and(
        inArray(modules.projectId, segmentProjects.map(p => p.id)),
        eq(modules.status, 'pending'),
        lte(modules.dueDate, new Date())
      ));

    // Sum total budget for segment projects
    const totalBudget = segmentProjects
      .map(p => Number(p.budget) || 0)
      .reduce((acc: number, curr: number) => acc + curr, 0);

    // Get milestones count for this segment
    const [milestonesCountResult] = await db
      .select({ count: count() })
      .from(milestones)
      .leftJoin(projects, eq(milestones.projectId, projects.id))
      .where(eq(projects.segment, segment as any));

    // Get on_support projects count for this segment
    const [onSupportProjectsResult] = await db
      .select({ count: count() })
      .from(projects)
      .where(and(
        eq(projects.status, 'on_support'),
        eq(projects.segment, segment as any)
      ));

    return {
      activeProjects: activeProjectsResult.count,
      completedModules: completedModulesResult.count,
      overdueModules: overdueModulesResult.count,
      totalBudget,
      collectedAmount: 0, // Placeholder
      pendingAmount: 0, // Placeholder
      milestonesCount: milestonesCountResult.count,
      projectsOnSupport: onSupportProjectsResult.count,
      onSupportProjects: onSupportProjectsResult.count,
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
        totalTasks: count(subtasks.id),
        completedTasks: sql<number>`SUM(CASE WHEN ${subtasks.status} = 'completed' THEN 1 ELSE 0 END)`,
      })
      .from(users)
      .leftJoin(subtasks, or(
        eq(users.id, subtasks.assignedUserId),
        eq(users.id, subtasks.assignedDevId),
        eq(users.id, subtasks.assignedConsultantId)
      ))
      .groupBy(users.id)
      .having(sql`COUNT(${subtasks.id}) > 0`);

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
    totalModules: number;
    completedModules: number;
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

    // Workload for users who are in these teams, counting only modules under projects in these teams
    const workloadData = await db
      .select({
        userId: users.id,
        user: users,
        totalModules: count(modules.id),
        completedModules: sql<number>`SUM(CASE WHEN ${modules.status} = 'done' THEN 1 ELSE 0 END)`,
      })
      .from(users)
      // limit users to members of these teams
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .leftJoin(modules, eq(users.id, modules.assignedUserId))
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .where(
        and(
          inArray(teamMembers.teamId, teamIds),
          // Only count modules that belong to projects in these teams
          or(sql`${modules.id} IS NULL`, inArray(projects.teamId, teamIds))
        )
      )
      .groupBy(users.id)
      .having(sql`COUNT(${modules.id}) > 0`);

    return workloadData.map((data) => {
      const totalModules = data.totalModules;
      const completedModules = Number(data.completedModules);
      
      // Calculate workload percentage based on completion rate
      const completionRate = totalModules > 0 
        ? Math.round((completedModules / totalModules) * 100)
        : 0;
      
      // For employees, adjust workload calculation to be more realistic
      // Base workload on actual module count, not just completion percentage
      let workloadPercentage = completionRate;
      
      // If someone has very few modules but high completion, don't show as overloaded
      if (totalModules <= 2 && completionRate >= 80) {
        workloadPercentage = Math.min(completionRate, 60); // Cap at 60% for low module count
      }
      
      // If someone has many modules, their workload should reflect that
      if (totalModules >= 5) {
        workloadPercentage = Math.max(workloadPercentage, 40); // Minimum 40% for high module count
      }
      
      return {
        userId: data.userId,
        user: data.user,
        totalModules,
        completedModules,
        workloadPercentage,
      };
    });
  }

  // Enhanced dashboard methods implementations
  async getDashboardKanbanTasks(): Promise<{
    overdue: (Module & { project: Project; assignedUser: User | null })[];
    review: (Module & { project: Project; assignedUser: User | null })[];
    recentlyDone: (Module & { project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Module & { project: Project; assignedUser: User | null })[];
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);



    // Get overdue modules
    const overdue = await db
      .select()
      .from(modules)
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          sql`${modules.dueDate} < ${now}`,
          sql`${modules.status} != 'done'`
        )
      )
      .execute();

    // Get client review modules (both QA and Client Review statuses)
    const review = await db
      .select()
      .from(modules)
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        or(
          eq(modules.status, 'qa'),
          eq(modules.status, 'client_review')
        )
      )
      .execute();



    // Get recently done modules (last 7 days)
    const recentlyDone = await db
      .select()
      .from(modules)
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          eq(modules.status, 'done'),
          sql`${modules.updatedAt} >= ${sevenDaysAgo}`
        )
      )
      .execute();

    // Get high priority modules (regardless of status)
    const highPriorityTodo = await db
      .select()
      .from(modules)
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        or(
          eq(modules.priority, 'critical'),
          eq(modules.priority, 'high')
        )
      )
      .execute();



    return {
      overdue: overdue.map(row => ({ ...row.modules, project: row.projects, assignedUser: row.users })),
      review: review.map(row => ({ ...row.modules, project: row.projects, assignedUser: row.users })),
      recentlyDone: recentlyDone.map(row => ({ ...row.modules, project: row.projects, assignedUser: row.users })),
      highPriorityTodo: highPriorityTodo.map(row => ({ ...row.modules, project: row.projects, assignedUser: row.users })),
    };
  }

  async getDashboardKanbanTasksForUser(userId: string): Promise<{
    overdue: (Module & { project: Project; assignedUser: User | null })[];
    review: (Module & { project: Project; assignedUser: User | null })[];
    recentlyDone: (Module & { project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Module & { project: Project; assignedUser: User | null })[];
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

    // Get modules through user's assigned subtasks
    const userSubtaskModules = await db
      .select({ moduleId: subtasks.moduleId })
      .from(subtasks)
      .where(
        or(
          eq(subtasks.assignedUserId, userId),
          eq(subtasks.assignedDevId, userId),
          eq(subtasks.assignedConsultantId, userId)
        )
      );
    
    const userModuleIds = userSubtaskModules.map(s => s.moduleId);
    
    // Base condition: modules that have subtasks assigned to user
    const userModuleCondition = userModuleIds.length > 0
      ? inArray(modules.id, userModuleIds)
      : sql`1 = 0`; // No modules if no subtasks assigned

    // Get overdue modules
    const overdue = await db
      .select()
      .from(modules)
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          sql`${modules.dueDate} < ${now}`,
          sql`${modules.status} != 'done'`,
          userModuleCondition
        )
      )
      .execute();

    // Get client review modules (both QA and Client Review statuses)
    const review = await db
      .select()
      .from(modules)
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          or(
            eq(modules.status, 'qa'),
            eq(modules.status, 'client_review')
          ),
          userModuleCondition
        )
      )
      .execute();

    // Get recently done modules (last 7 days)
    const recentlyDone = await db
      .select()
      .from(modules)
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          eq(modules.status, 'done'),
          sql`${modules.updatedAt} >= ${sevenDaysAgo}`,
          userModuleCondition
        )
      )
      .execute();

    // Get high priority modules (regardless of status)
    const highPriorityTodo = await db
      .select()
      .from(modules)
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          or(
            eq(modules.priority, 'critical'),
            eq(modules.priority, 'high')
          ),
          userModuleCondition
        )
      )
      .execute();

    return {
      overdue: overdue.map(row => ({ ...row.modules, project: row.projects, assignedUser: row.users })),
      review: review.map(row => ({ ...row.modules, project: row.projects, assignedUser: row.users })),
      recentlyDone: recentlyDone.map(row => ({ ...row.modules, project: row.projects, assignedUser: row.users })),
      highPriorityTodo: highPriorityTodo.map(row => ({ ...row.modules, project: row.projects, assignedUser: row.users })),
    };
  }

  // Kanban subtasks methods
  async getDashboardKanbanSubtasks(): Promise<{
    overdue: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    review: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    recentlyDone: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    fcReview: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get overdue subtasks
    const overdue = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(
        and(
          sql`${subtasks.dueDate} < ${now}`,
          sql`${subtasks.status} != 'completed'`
        )
      )
      .execute();

    // Get client review subtasks
    const review = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(eq(subtasks.status, 'client_review'))
      .execute();

    // Get FC review subtasks
    const fcReview = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(eq(subtasks.status, 'fc_review'))
      .execute();

    // Get recently done subtasks (last 7 days)
    const recentlyDone = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(
        and(
          eq(subtasks.status, 'completed'),
          sql`${subtasks.updatedAt} >= ${sevenDaysAgo}`
        )
      )
      .execute();

    // Get high priority subtasks (regardless of status)
    const highPriorityTodo = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(
        or(
          eq(subtasks.priority, 'critical'),
          eq(subtasks.priority, 'high')
        )
      )
      .execute();

    return {
      overdue: overdue.map(row => ({ ...row.subtasks, module: row.modules, project: row.projects, assignedUser: row.users })),
      review: review.map(row => ({ ...row.subtasks, module: row.modules, project: row.projects, assignedUser: row.users })),
      fcReview: fcReview.map(row => ({ ...row.subtasks, module: row.modules, project: row.projects, assignedUser: row.users })),
      recentlyDone: recentlyDone.map(row => ({ ...row.subtasks, module: row.modules, project: row.projects, assignedUser: row.users })),
      highPriorityTodo: highPriorityTodo.map(row => ({ ...row.subtasks, module: row.modules, project: row.projects, assignedUser: row.users })),
    };
  }

  async getDashboardKanbanSubtasksForUser(userId: string): Promise<{
    overdue: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    review: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    recentlyDone: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    highPriorityTodo: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
    fcReview: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get user's team IDs to include team-assigned subtasks
    const userTeamIds = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .execute();
    
    const teamIds = userTeamIds.map(t => t.teamId);

    // User subtask condition: assigned to user OR assigned to user's teams
    const userSubtaskCondition = or(
      eq(subtasks.assignedUserId, userId),
      eq(subtasks.assignedDevId, userId),
      eq(subtasks.assignedConsultantId, userId),
      teamIds.length > 0 ? sql`${modules.assignedTeamId} IN (${teamIds.join(',')})` : sql`false`
    );

    // Get overdue subtasks
    const overdue = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(
        and(
          sql`${subtasks.dueDate} < ${now}`,
          sql`${subtasks.status} != 'completed'`,
          userSubtaskCondition
        )
      )
      .execute();

    // Get client review subtasks
    const review = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(
        and(
          eq(subtasks.status, 'client_review'),
          userSubtaskCondition
        )
      )
      .execute();

    // Get FC review subtasks
    const fcReview = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(
        and(
          eq(subtasks.status, 'fc_review'),
          userSubtaskCondition
        )
      )
      .execute();

    // Get recently done subtasks (last 7 days)
    const recentlyDone = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(
        and(
          eq(subtasks.status, 'completed'),
          sql`${subtasks.updatedAt} >= ${sevenDaysAgo}`,
          userSubtaskCondition
        )
      )
      .execute();

    // Get high priority subtasks (regardless of status)
    const highPriorityTodo = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(
        and(
          or(
            eq(subtasks.priority, 'critical'),
            eq(subtasks.priority, 'high')
          ),
          userSubtaskCondition
        )
      )
      .execute();

    return {
      overdue: overdue.map(row => ({ ...row.subtasks, module: row.modules, project: row.projects, assignedUser: row.users })),
      review: review.map(row => ({ ...row.subtasks, module: row.modules, project: row.projects, assignedUser: row.users })),
      fcReview: fcReview.map(row => ({ ...row.subtasks, module: row.modules, project: row.projects, assignedUser: row.users })),
      recentlyDone: recentlyDone.map(row => ({ ...row.subtasks, module: row.modules, project: row.projects, assignedUser: row.users })),
      highPriorityTodo: highPriorityTodo.map(row => ({ ...row.subtasks, module: row.modules, project: row.projects, assignedUser: row.users })),
    };
  }

  async getBestPerformingTeam(): Promise<{
    teamId: string;
    team: Team;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    onTimeDeliveryRate: number;
    efficiencyScore: number;
    priorityBonus: number;
    overallScore: number;
    members: {
      userId: string;
      user: User;
      role: string;
      totalTasks: number;
      completedTasks: number;
      overdueTasks: number;
      highPriorityTasks: number;
      completedHighPriorityTasks: number;
      workloadPercentage: number;
    }[];
  } | null> {
        // Get all teams with their subtask performance metrics - FIXED: Use subtasks instead of modules
    const teamMetrics = await db
      .select({
        teamId: teams.id,
        team: teams,
        totalTasks: count(subtasks.id),
        completedTasks: sql<number>`SUM(CASE WHEN ${subtasks.status} = 'completed' THEN 1 ELSE 0 END)`,
        onTimeTasks: sql<number>`SUM(CASE WHEN ${subtasks.status} = 'completed' AND ${subtasks.dueDate} >= CURRENT_DATE THEN 1 ELSE 0 END)`,
        overdueTasks: sql<number>`SUM(CASE WHEN ${subtasks.status} NOT IN ('completed', 'cancelled') AND ${subtasks.dueDate} < CURRENT_DATE THEN 1 ELSE 0 END)`,
        highPriorityTasks: sql<number>`SUM(CASE WHEN ${subtasks.priority} IN ('high', 'critical') THEN 1 ELSE 0 END)`,
        completedHighPriorityTasks: sql<number>`SUM(CASE WHEN ${subtasks.status} = 'completed' AND ${subtasks.priority} IN ('high', 'critical') THEN 1 ELSE 0 END)`,
      })
      .from(teams)
      .leftJoin(projects, eq(teams.id, projects.teamId))
      .leftJoin(modules, eq(projects.id, modules.projectId))
      .leftJoin(subtasks, eq(modules.id, subtasks.moduleId))
      .where(
        and(
          sql`${subtasks.id} IS NOT NULL`, // Only teams with actual subtasks
          sql`${subtasks.status} NOT IN ('cancelled', 'on_hold')` // Exclude cancelled/on-hold subtasks
        )
      )
      .groupBy(teams.id)
      .execute();

    if (teamMetrics.length === 0) {
      return null;
    }

    // Calculate performance scores with improved metrics
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

    if (!bestTeam) {
      return null;
    }

    // Get members of the best team with improved workload calculation
    const members = await this.getTeamMembers(bestTeam.teamId);
    const memberWorkload = await Promise.all(
      members.map(async (member) => {
        const memberTasks = await db
          .select({
            totalTasks: count(subtasks.id),
            completedTasks: sql<number>`SUM(CASE WHEN ${subtasks.status} = 'completed' THEN 1 ELSE 0 END)`,
            overdueTasks: sql<number>`SUM(CASE WHEN ${subtasks.status} NOT IN ('completed', 'cancelled') AND ${subtasks.dueDate} < CURRENT_DATE THEN 1 ELSE 0 END)`,
            highPriorityTasks: sql<number>`SUM(CASE WHEN ${subtasks.priority} IN ('high', 'critical') THEN 1 ELSE 0 END)`,
            completedHighPriorityTasks: sql<number>`SUM(CASE WHEN ${subtasks.status} = 'completed' AND ${subtasks.priority} IN ('high', 'critical') THEN 1 ELSE 0 END)`,
          })
          .from(subtasks)
            .where(
              and(
              or(
                eq(subtasks.assignedUserId, member.userId),
                eq(subtasks.assignedDevId, member.userId),
                eq(subtasks.assignedConsultantId, member.userId)
              ),
              sql`${subtasks.status} NOT IN ('cancelled', 'on_hold')`
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

        // Calculate weighted workload percentage
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
      totalTasks: bestTeam.totalTasks,
      completedTasks: bestTeam.completedTasks,
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
      // Delete existing segment leaders first
      await db.delete(segmentLeaders);

      // Insert new segment leaders
      await db.insert(segmentLeaders).values([
        {
          segment: 'academic',
          leaderName: data.academic.name,
          leaderEmail: data.academic.email,
        },
        {
          segment: 'parastals',
          leaderName: data.parastals.name,
          leaderEmail: data.parastals.email,
        },
        {
          segment: 'private',
          leaderName: data.private.name,
          leaderEmail: data.private.email,
        }
      ]);

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
    const [newNotification] = await db.insert(notifications).values(notification as any).returning();
    return newNotification;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true } as any).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true } as any).where(eq(notifications.userId, userId));
  }

  // User preferences and settings
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
    const [preferences] = await db
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId));
    return preferences || {
      id: '',
      userId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
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
          updatedAt: new Date() as any,
        } as any,
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
          updatedAt: new Date() as any,
        } as any,
      });
  }

  // Password reset operations
  async updateUserResetToken(userId: string, resetToken: string | null, resetTokenExpiry: Date | null): Promise<void> {
    await db
      .update(users)
      .set({ resetToken, resetTokenExpiry, updatedAt: new Date() } as any)
      .where(eq(users.id, userId));
  }

  async getUserByResetToken(resetToken: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, resetToken));
    return user;
  }

  // Phase operations (for project phases)
  async getProjectPhases(projectId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, projectId))
      .orderBy(asc(projectPhases.phaseNumber));
    
    return result;
  }

  async createProjectPhases(projectId: string): Promise<any[]> {
    // Check if phases already exist for this project
    const existingPhases = await this.getProjectPhases(projectId);
    if (existingPhases.length > 0) {
      return existingPhases; // Return existing phases instead of creating duplicates
    }
    
    // Import phase constants for default phases
    const { PROJECT_PHASES } = await import('../shared/phaseConstants');
    
    // Create default project phases
    const phasesToCreate = PROJECT_PHASES.map(phase => ({
      projectId,
      phaseNumber: phase.phaseNumber,
      phaseType: phase.phaseType,
      phaseName: phase.phaseName,
      description: phase.description,
      status: 'not_started' as const,
      progress: 0,
      deliverables: phase.defaultDeliverables,
    }));
    
    const createdPhases = await db
      .insert(projectPhases)
      .values(phasesToCreate as any)
      .returning();
    
    return createdPhases;
  }

  async getProjectPhase(phaseId: string): Promise<any> {
    const [phase] = await db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.id, phaseId));
    
    return phase;
  }

  // Project Management Dashboard implementation
  async getProjectPerformanceData(year: number, month?: number): Promise<{
    projects: (Project & { manager: User; team: Team | null; progress: number })[];
    ganttData: any;
    performanceMetrics: {
      totalProjects: number;
      moduleProgress: number;
      teamCapacity: number;
      timelineHealth: number;
    };
  }> {
    try {
      // Get all projects with progress calculation
      const projectsQuery = db
        .select({
          project: projects,
          manager: users,
          team: teams,
          totalModules: sql<number>`COUNT(${modules.id})`,
          completedModules: sql<number>`SUM(CASE WHEN ${modules.status} = 'done' THEN 1 ELSE 0 END)`,
        })
        .from(projects)
        .leftJoin(users, eq(projects.managerId, users.id))
        .leftJoin(teams, eq(projects.teamId, teams.id))
        .leftJoin(modules, eq(modules.projectId, projects.id))
        .groupBy(projects.id, users.id, teams.id);

      // Add year filter
      let whereConditions = sql`EXTRACT(YEAR FROM ${projects.createdAt}) = ${year}`;
      
      // Add month filter if provided
      if (month) {
        whereConditions = sql`${whereConditions} AND EXTRACT(MONTH FROM ${projects.createdAt}) = ${month}`;
      }

      const projectResults = await projectsQuery.where(whereConditions);

      const projectsWithProgress = projectResults.map(result => {
        const totalModules = Number(result.totalModules || 0);
        const completedModules = Number(result.completedModules || 0);
        const progress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
        
        return {
          ...result.project,
          manager: result.manager!,
          team: result.team,
          progress
        };
      });

      // Calculate performance metrics
      const totalProjects = projectsWithProgress.length;
      const moduleProgress = totalProjects > 0 
        ? Math.round(projectsWithProgress.reduce((sum, p) => sum + p.progress, 0) / totalProjects)
        : 0;

      // Calculate team capacity (average workload percentage)
      const teamWorkload = await this.getTeamWorkload();
      const teamCapacity = teamWorkload.length > 0
        ? Math.round(teamWorkload.reduce((sum, member) => sum + member.workloadPercentage, 0) / teamWorkload.length)
        : 0;

      // Calculate timeline health (projects on schedule)
      const now = new Date();
      const projectsOnTime = projectsWithProgress.filter(project => {
        if (!project.endDate) return true;
        const endDate = new Date(project.endDate);
        const isOverdue = endDate < now && project.status !== 'completed';
        return !isOverdue;
      }).length;
      
      const timelineHealth = totalProjects > 0
        ? Math.round((projectsOnTime / totalProjects) * 100)
        : 100;

      return {
        projects: projectsWithProgress,
        ganttData: null, // TODO: Implement Gantt data structure
        performanceMetrics: {
          totalProjects,
          moduleProgress,
          teamCapacity,
          timelineHealth
        }
      };
    } catch (error) {
      console.error('Error fetching project performance data:', error);
      throw error;
    }
  }

  async getRiskQualityData(year: number, month?: number): Promise<{
    supportProjects: any[];
    riskTrends: any[];
  }> {
    try {
      // Get projects that are on support status
      const supportProjectsQuery = db
        .select({
          project: projects,
          manager: users,
          team: teams,
          totalModules: sql<number>`COUNT(${modules.id})`,
          completedModules: sql<number>`SUM(CASE WHEN ${modules.status} = 'done' THEN 1 ELSE 0 END)`,
          criticalIssues: sql<number>`SUM(CASE WHEN ${modules.priority} = 'critical' AND ${modules.status} != 'done' THEN 1 ELSE 0 END)`,
          resolvedIssues: sql<number>`SUM(CASE WHEN ${modules.priority} IN ('critical', 'high') AND ${modules.status} = 'done' THEN 1 ELSE 0 END)`,
        })
        .from(projects)
        .leftJoin(users, eq(projects.managerId, users.id))
        .leftJoin(teams, eq(projects.teamId, teams.id))
        .leftJoin(modules, eq(modules.projectId, projects.id))
        .where(eq(projects.status, 'on_support'))
        .groupBy(projects.id, users.id, teams.id);

      const supportResults = await supportProjectsQuery;

      const supportProjects = supportResults.map(result => {
        const totalModules = Number(result.totalModules || 0);
        const completedModules = Number(result.completedModules || 0);
        const progress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
        const criticalIssues = Number(result.criticalIssues || 0);
        const resolvedIssues = Number(result.resolvedIssues || 0);
        
        // Calculate basic metrics for this project
        const slaCompliance = criticalIssues === 0 ? 100 : Math.max(0, 100 - (criticalIssues * 10)); // Rough calculation
        const responseTime = criticalIssues > 0 ? Math.random() * 4 + 1 : Math.random() * 2 + 0.5; // Simulated response time
        const qualityRating = Math.min(5, 3 + (progress / 25)); // Quality based on progress
        
        // Determine SLA status
        let slaStatus = 'compliant';
        if (responseTime > 4) slaStatus = 'breach';
        else if (responseTime > 2.5 || criticalIssues > 3) slaStatus = 'warning';
        
        // Determine risk level
        let riskLevel = 'low';
        if (criticalIssues > 5 || progress < 50) riskLevel = 'high';
        else if (criticalIssues > 2 || progress < 75) riskLevel = 'medium';

        return {
          id: result.project.id,
          name: result.project.name,
          client: result.project.client,
          slaStatus,
          responseTime: `${responseTime.toFixed(1)} hrs`,
          issuesOpen: criticalIssues,
          issuesResolved: resolvedIssues,
          qualityRating,
          riskLevel,
          progress
        };
      });

      // Generate risk trends (monthly data for the year)
      const riskTrends = [];
      for (let m = 1; m <= 12; m++) {
        const monthName = new Date(year, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
        riskTrends.push({
          month: monthName,
          risks: Math.floor(Math.random() * 20) + 10, // Simulated data
          resolved: Math.floor(Math.random() * 18) + 8,
          quality: Math.floor(Math.random() * 15) + 80
        });
      }

      return {
        supportProjects,
        riskTrends
      };
    } catch (error) {
      console.error('Error fetching risk quality data:', error);
      throw error;
    }
  }

  async updateProjectPhase(phaseId: string, phase: any): Promise<any> {
    const [updatedPhase] = await db
      .update(projectPhases)
      .set({
        ...phase,
        updatedAt: new Date() as any
      } as any)
      .where(eq(projectPhases.id, phaseId))
      .returning();
    
    return updatedPhase;
  }

  async completeProjectPhase(phaseId: string, completionReport: any): Promise<any> {
    const [completedPhase] = await db
      .update(projectPhases)
      .set({
        status: 'completed' as any,
        completedAt: new Date() as any,
        completionReport: completionReport,
        updatedAt: new Date() as any
      } as any)
      .where(eq(projectPhases.id, phaseId))
      .returning();
    
    return completedPhase;
  }

  async getPhaseDeliverables(phaseId: string): Promise<any[]> {
    // TODO: Implement when phases table is created
    return [];
  }

  async addPhaseDeliverable(phaseId: string, deliverable: any): Promise<any> {
    // TODO: Implement when phases table is created
    return null;
  }

  async updatePhaseDeliverable(deliverableId: string, deliverable: any): Promise<any> {
    // TODO: Implement when phases table is created
    return null;
  }

  async completePhaseDeliverable(deliverableId: string): Promise<any> {
    // TODO: Implement when phases table is created
    return null;
  }

  async getPhaseReports(phaseId: string): Promise<any[]> {
    // TODO: Implement when phases table is created
    return [];
  }

  async createPhaseReport(phaseId: string, report: any): Promise<any> {
    // TODO: Implement when phases table is created
    return null;
  }

  // Project charter operations
  async getProjectCharter(projectId: string): Promise<any> {
    // TODO: Implement when project charter table is created
    return null;
  }

  async createProjectCharter(projectId: string, charter: any): Promise<any> {
    // TODO: Implement when project charter table is created
    return null;
  }

  async updateProjectCharter(projectId: string, charter: any): Promise<any> {
    // TODO: Implement when project charter table is created
    return null;
  }

  // Contract operations
  async getContracts(): Promise<any[]> {
    const result = await db
      .select({
        contract: contracts,
        project: projects,
        creator: users,
      })
      .from(contracts)
      .leftJoin(projects, eq(contracts.projectId, projects.id))
      .leftJoin(users, eq(contracts.createdBy, users.id))
      .orderBy(desc(contracts.createdAt));
    
    return result.map(row => ({
      ...row.contract,
      projectName: row.project?.name || 'Unknown Project',
      createdBy: row.creator?.firstName + ' ' + row.creator?.lastName || 'Unknown User',
    }));
  }

  async getContract(contractId: string): Promise<any> {
    const [result] = await db
      .select({
        contract: contracts,
        project: projects,
        creator: users,
      })
      .from(contracts)
      .leftJoin(projects, eq(contracts.projectId, projects.id))
      .leftJoin(users, eq(contracts.createdBy, users.id))
      .where(eq(contracts.id, contractId));
    
    if (!result) return null;
    
    return {
      ...result.contract,
      projectName: result.project?.name || 'Unknown Project',
      createdBy: result.creator?.firstName + ' ' + result.creator?.lastName || 'Unknown User',
    };
  }

  async createContract(contractData: any): Promise<any> {
    // Generate contract number if not provided
    if (!contractData.contractNumber) {
      const year = new Date().getFullYear();
      const count = await db.select({ count: sql<number>`count(*)` }).from(contracts);
      const contractNumber = `CON-${year}-${String(count[0].count + 1).padStart(4, '0')}`;
      contractData.contractNumber = contractNumber;
    }

    const [createdContract] = await db
      .insert(contracts)
      .values({
        ...contractData,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      } as any)
      .returning();
    
    return createdContract;
  }

  async updateContract(contractId: string, contractData: any): Promise<any> {
    const [updatedContract] = await db
      .update(contracts)
      .set({
        ...contractData,
        updatedAt: new Date() as any,
      } as any)
      .where(eq(contracts.id, contractId))
      .returning();
    
    return updatedContract;
  }

  // Contract expiration monitoring
  async checkContractExpirations(): Promise<void> {
    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Get contracts expiring in the next 30 days
      const expiringContracts = await db
        .select({
          contract: contracts,
          project: projects,
          manager: users
        })
        .from(contracts)
        .innerJoin(projects, eq(contracts.projectId, projects.id))
        .innerJoin(users, eq(projects.managerId, users.id))
        .where(
          and(
            eq(contracts.status, 'active'),
            sql`${contracts.endDate} <= ${thirtyDaysFromNow}`,
            sql`${contracts.endDate} > ${now}`
          )
        )
        .execute();

      // Get contracts expiring in the next 7 days
      const urgentExpiringContracts = await db
        .select({
          contract: contracts,
          project: projects,
          manager: users
        })
        .from(contracts)
        .innerJoin(projects, eq(contracts.projectId, projects.id))
        .innerJoin(users, eq(projects.managerId, users.id))
        .where(
          and(
            eq(contracts.status, 'active'),
            sql`${contracts.endDate} <= ${sevenDaysFromNow}`,
            sql`${contracts.endDate} > ${now}`
          )
        )
        .execute();

      // Send notifications for contracts expiring in 30 days
      for (const row of expiringContracts) {
        const contract = row.contract;
        const project = row.project;
        const manager = row.manager;
        
        if (contract && project && manager) {
          const daysUntilExpiry = Math.ceil((new Date(contract.endDate!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          
          // Check if notification already exists for this contract
          const existingNotification = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, manager.id),
                eq(notifications.type, 'contract_expiring'),
                eq(notifications.relatedId, contract.id),
                sql`${notifications.createdAt} >= ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}` // Within last 7 days
              )
            );

          if (existingNotification.length === 0) {
            await this.createNotification({
              userId: manager.id,
              type: 'contract_expiring',
              title: `Contract Expiring Soon: ${contract.contractNumber}`,
              message: `Contract "${contract.contractNumber}" for project "${project.name}" expires in ${daysUntilExpiry} days. Please review and take necessary action.`,
              relatedId: contract.id
            } as any);
          }
        }
      }

      // Send urgent notifications for contracts expiring in 7 days
      for (const row of urgentExpiringContracts) {
        const contract = row.contract;
        const project = row.project;
        const manager = row.manager;
        
        if (contract && project && manager) {
          const daysUntilExpiry = Math.ceil((new Date(contract.endDate!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          
          // Check if urgent notification already exists for this contract
          const existingUrgentNotification = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, manager.id),
                eq(notifications.type, 'contract_expiring_urgent'),
                eq(notifications.relatedId, contract.id),
                sql`${notifications.createdAt} >= ${new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)}` // Within last 3 days
              )
            );

          if (existingUrgentNotification.length === 0) {
            await this.createNotification({
              userId: manager.id,
              type: 'contract_expiring_urgent',
              title: `URGENT: Contract Expiring Soon: ${contract.contractNumber}`,
              message: `URGENT: Contract "${contract.contractNumber}" for project "${project.name}" expires in ${daysUntilExpiry} days. Immediate action required!`,
              relatedId: contract.id
            } as any);
          }
        }
      }

      // Contract expiration check completed
    } catch (error) {
      console.error('Error checking contract expirations:', error);
      throw error;
    }
  }

  // Module deadline and status operations
  async checkModuleDeadlines(): Promise<void> {
    try {
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      // Find modules that are overdue (past due date and not completed)
      const overdueModules = await db
        .select()
        .from(modules)
        .leftJoin(projects, eq(modules.projectId, projects.id))
        .leftJoin(users, eq(modules.assignedUserId, users.id))
        .where(
          and(
            sql`${modules.dueDate} < ${now}`,
            sql`${modules.status} != 'done'`
          )
        );

      // Find modules due within the next 24 hours
      const dueSoonModules = await db
        .select()
        .from(modules)
        .leftJoin(projects, eq(modules.projectId, projects.id))
        .leftJoin(users, eq(modules.assignedUserId, users.id))
        .where(
          and(
            sql`${modules.dueDate} >= ${now}`,
            sql`${modules.dueDate} <= ${oneDayFromNow}`,
            sql`${modules.status} != 'done'`
          )
        );

      // Find modules due within the next 3 days
      const upcomingModules = await db
        .select()
        .from(modules)
        .leftJoin(projects, eq(modules.projectId, projects.id))
        .leftJoin(users, eq(modules.assignedUserId, users.id))
        .where(
          and(
            sql`${modules.dueDate} >= ${oneDayFromNow}`,
            sql`${modules.dueDate} <= ${threeDaysFromNow}`,
            sql`${modules.status} != 'done'`
          )
        );

      // Find modules due in 1 week (for finance notification)
      const oneWeekNoticeModules = await db
        .select()
        .from(modules)
        .leftJoin(projects, eq(modules.projectId, projects.id))
        .leftJoin(teams, eq(projects.teamId, teams.id))
        .where(
          and(
            sql`${modules.dueDate} >= ${oneWeekFromNow}`,
            sql`${modules.dueDate} <= ${new Date(oneWeekFromNow.getTime() + 24 * 60 * 60 * 1000)}`,
            sql`${modules.status} != 'done'`
          )
        );

      // Find modules due in 2 weeks (for finance notification)
      const twoWeekNoticeModules = await db
        .select()
        .from(modules)
        .leftJoin(projects, eq(modules.projectId, projects.id))
        .leftJoin(teams, eq(projects.teamId, teams.id))
        .where(
          and(
            sql`${modules.dueDate} >= ${twoWeeksFromNow}`,
            sql`${modules.dueDate} <= ${new Date(twoWeeksFromNow.getTime() + 24 * 60 * 60 * 1000)}`,
            sql`${modules.status} != 'done'`
          )
        );

      // Update overdue modules status to 'overdue' if not already
      for (const row of overdueModules) {
        const module = row.modules;
        if (module && module.status !== 'overdue') {
          await db
            .update(modules)
            .set({ 
              status: 'overdue' as any,
              updatedAt: new Date() as any 
            } as any)
            .where(eq(modules.id, module.id));
        }
      }

      // Create notifications for overdue modules
      for (const row of overdueModules) {
        const module = row.modules;
        const project = row.projects;
        const assignedUser = row.users;
        
        if (module && project && assignedUser) {
          // Check if notification already exists for this overdue module
          const existingNotification = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, assignedUser.id),
                eq(notifications.type, 'module_overdue'),
                eq(notifications.relatedId, module.id),
                sql`${notifications.createdAt} >= ${new Date(now.getTime() - 24 * 60 * 60 * 1000)}` // Within last 24 hours
              )
            );

          if (existingNotification.length === 0) {
            await this.createNotification({
              userId: assignedUser.id,
              type: 'module_overdue',
              title: `Module Overdue: ${module.name}`,
              message: `Module "${module.name}" in project "${project.name}" is overdue. Due date was ${module.dueDate ? new Date(module.dueDate).toLocaleDateString() : 'not set'}.`,
              relatedId: module.id
            } as any);
          }
        }
      }

      // Create notifications for modules due soon (within 24 hours)
      for (const row of dueSoonModules) {
        const module = row.modules;
        const project = row.projects;
        const assignedUser = row.users;
        
        if (module && project && assignedUser) {
          // Check if notification already exists for this due-soon module
          const existingNotification = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, assignedUser.id),
                eq(notifications.type, 'module_due_soon'),
                eq(notifications.relatedId, module.id),
                sql`${notifications.createdAt} >= ${new Date(now.getTime() - 24 * 60 * 60 * 1000)}` // Within last 24 hours
              )
            );

          if (existingNotification.length === 0) {
            await this.createNotification({
              userId: assignedUser.id,
              type: 'module_due_soon',
              title: `Module Due Soon: ${module.name}`,
              message: `Module "${module.name}" in project "${project.name}" is due within 24 hours. Due date: ${module.dueDate ? new Date(module.dueDate).toLocaleDateString() : 'not set'}.`,
              relatedId: module.id
            } as any);
          }
        }
      }

      // Create notifications for upcoming modules (within 3 days)
      for (const row of upcomingModules) {
        const module = row.modules;
        const project = row.projects;
        const assignedUser = row.users;
        
        if (module && project && assignedUser) {
          // Check if notification already exists for this upcoming module
          const existingNotification = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, assignedUser.id),
                eq(notifications.type, 'module_upcoming'),
                eq(notifications.relatedId, module.id),
                sql`${notifications.createdAt} >= ${new Date(now.getTime() - 72 * 60 * 60 * 1000)}` // Within last 72 hours
              )
            );

          if (existingNotification.length === 0) {
            await this.createNotification({
              userId: assignedUser.id,
              type: 'module_upcoming',
              title: `Upcoming Module: ${module.name}`,
              message: `Module "${module.name}" in project "${project.name}" is due in ${Math.ceil((new Date(module.dueDate!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))} days.`,
              relatedId: module.id
            } as any);
          }
        }
      }

      // Send finance email notifications for modules due in 1 week
      if (oneWeekNoticeModules.length > 0) {
        await this.sendFinanceModuleDeadlineNotification(oneWeekNoticeModules, '1 week');
      }

      // Send finance email notifications for modules due in 2 weeks
      if (twoWeekNoticeModules.length > 0) {
        await this.sendFinanceModuleDeadlineNotification(twoWeekNoticeModules, '2 weeks');
      }

      // Module deadline check completed
    } catch (error) {
      console.error('Error checking module deadlines:', error);
      throw error;
    }
  }

  async updateModuleStatusFromSubtasks(moduleId: string): Promise<void> {
    try {
      // Get all subtasks for this module
      const moduleSubtasks = await db
        .select()
        .from(subtasks)
        .where(eq(subtasks.moduleId, moduleId));

      if (moduleSubtasks.length === 0) {
        return; // No subtasks, nothing to update
      }

      // Check if all subtasks are finished (using 'completed' status)
      const allFinished = moduleSubtasks.every(subtask => subtask.status === 'completed');
      
      // Check if any subtask is in progress
      const anyInProgress = moduleSubtasks.some(subtask => subtask.status === 'in_progress');

      // Get current module status and phase info
      const [currentModule] = await db
        .select({ 
          status: modules.status,
          phaseNumber: modules.phaseNumber,
          projectId: modules.projectId
        })
        .from(modules)
        .where(eq(modules.id, moduleId));

      if (!currentModule) {
        return; // Module not found
      }

      let newStatus = currentModule.status;

      // Auto-complete module when all subtasks are done (using 'completed' status)
      if (allFinished && currentModule.status !== 'completed') {
        newStatus = 'qa'; // Change to QA status instead of completed
      }
      // Auto-set module to in_progress when any subtask becomes in_progress
      else if (anyInProgress && currentModule.status === 'not_started') {
        newStatus = 'in_progress';
      }

      // Update module status if it needs to change
      if (newStatus !== currentModule.status) {
        await db
          .update(modules)
          .set({ 
            status: newStatus as any,
            completedAt: newStatus === 'completed' ? new Date() : undefined,
            updatedAt: new Date() as any
          } as any)
          .where(eq(modules.id, moduleId));

        // Send notification when module moves to QA status
        if (newStatus === 'qa' && currentModule.status !== 'qa') {
          await this.sendFinanceNotificationForModuleQA(moduleId);
        }

        // Handle Phase 3 specific logic: Update milestone status when module changes
        if (currentModule.phaseNumber === 3) {
          await this.updateMilestoneStatusFromModules(moduleId);
        }

        // Update project progress after module status change
        await this.updateProjectProgress(currentModule.projectId);
        await this.updateProjectStatusBasedOnMilestones(currentModule.projectId);
        
        // Update phase status based on module changes
        if (currentModule.phaseNumber) {
          await this.updatePhaseStatusFromModules(currentModule.projectId, currentModule.phaseNumber);
        }
      }
    } catch (error) {
      console.error('Error updating module status from subtasks:', error);
      throw error;
    }
  }

  // New function to update milestone billing status for Phases 1,2,4,5,6
  async updateMilestoneStatusFromSubtasks(subtaskId: string): Promise<void> {
    try {
      // Get the subtask and its module to determine phase
      const [subtaskWithModule] = await db
        .select({
          subtask: subtasks,
          module: modules
        })
        .from(subtasks)
        .innerJoin(modules, eq(subtasks.moduleId, modules.id))
        .where(eq(subtasks.id, subtaskId));

      if (!subtaskWithModule?.module) return;

      const module = subtaskWithModule.module;
      
      // Only handle Phases 1,2,4,5,6 (not Phase 3)
      if (module.phaseNumber === 3) return;

      // Get all subtasks for this module
      const moduleSubtasks = await db
        .select({ status: subtasks.status })
        .from(subtasks)
        .where(eq(subtasks.moduleId, module.id));

      if (moduleSubtasks.length === 0) return;

      // Check if any subtask is in progress or all are completed
      const anyInProgress = moduleSubtasks.some(subtask => 
        ['in_progress', 'fc_review', 'qa', 'client_review'].includes(subtask.status)
      );
      const allCompleted = moduleSubtasks.every(subtask => 
        ['completed', 'finished'].includes(subtask.status)
      );

      // Find the milestone for this module (for Phases 1,2,4,5,6, modules are milestones)
      const [milestone] = await db
        .select()
        .from(milestones)
        .where(and(
          eq(milestones.projectId, module.projectId),
          eq(milestones.name, module.name) // Assuming module name matches milestone name
        ));

      if (!milestone) return;

      let newBillingStatus = milestone.billingStatus;

      // Update milestone billing status based on subtask status
      if (allCompleted && milestone.billingStatus === 'none') {
        newBillingStatus = 'to_send';
      } else if (anyInProgress && milestone.billingStatus === 'none') {
        newBillingStatus = 'to_send';
      }

      // Update milestone billing status if it needs to change
      if (newBillingStatus !== milestone.billingStatus) {
        await db
          .update(milestones)
          .set({ 
            billingStatus: newBillingStatus as any,
            updatedAt: new Date() as any
          } as any)
          .where(eq(milestones.id, milestone.id));

        // Update project progress after milestone status change
        await this.updateProjectProgress(module.projectId);
        await this.updateProjectStatusBasedOnMilestones(module.projectId);
      }
    } catch (error) {
      console.error('Error updating milestone status from subtasks:', error);
      throw error;
    }
  }

  // New function to update milestone status from modules in Phase 3
  async updateMilestoneStatusFromModules(moduleId: string): Promise<void> {
    try {
      // Get the module to find which milestone it belongs to
      const [moduleInfo] = await db
        .select({
          moduleId: modules.id,
          moduleStatus: modules.status,
          projectId: modules.projectId,
          milestoneId: moduleMilestones.milestoneId
        })
        .from(modules)
        .leftJoin(moduleMilestones, eq(modules.id, moduleMilestones.moduleId))
        .where(eq(modules.id, moduleId));

      if (!moduleInfo?.milestoneId) {
        return; // Module doesn't belong to a milestone
      }

      // Get all modules under this milestone
      const milestoneModules = await db
        .select({ status: modules.status })
        .from(modules)
        .innerJoin(moduleMilestones, eq(modules.id, moduleMilestones.moduleId))
        .where(eq(moduleMilestones.milestoneId, moduleInfo.milestoneId));

      if (milestoneModules.length === 0) {
        return; // No modules under this milestone
      }

      // Check if all modules are completed (qa status)
      const allCompleted = milestoneModules.every(module => module.status === 'qa');
      
      // Check if any module is in progress
      const anyInProgress = milestoneModules.some(module => module.status === 'in_progress');

      // Get current milestone billing status
      const [currentMilestone] = await db
        .select({ billingStatus: milestones.billingStatus })
        .from(milestones)
        .where(eq(milestones.id, moduleInfo.milestoneId));

      if (!currentMilestone) {
        return; // Milestone not found
      }

      let newBillingStatus = currentMilestone.billingStatus;

      // Auto-set milestone to 'to_send' when all modules are in QA
      if (allCompleted && currentMilestone.billingStatus === 'none') {
        newBillingStatus = 'to_send';
      }
      // Auto-set milestone to 'to_send' when any module becomes in_progress (milestone starts)
      else if (anyInProgress && currentMilestone.billingStatus === 'none') {
        newBillingStatus = 'to_send';
      }

      // Update milestone billing status if it needs to change
      if (newBillingStatus !== currentMilestone.billingStatus) {
        await db
          .update(milestones)
          .set({ 
            billingStatus: newBillingStatus as any,
            updatedAt: new Date() as any
          } as any)
          .where(eq(milestones.id, moduleInfo.milestoneId));

        // Update project progress after milestone status change
        await this.updateProjectProgress(moduleInfo.projectId);
        await this.updateProjectStatusBasedOnMilestones(moduleInfo.projectId);
      }
    } catch (error) {
      console.error('Error updating milestone status from modules:', error);
      throw error;
    }
  }

  // New function to send finance notification when module goes to QA
  async sendFinanceNotificationForModuleQA(moduleId: string): Promise<void> {
    try {
      // Get module and project info
          const [moduleWithProject] = await db
            .select({
              module: modules,
              project: projects,
              manager: users
            })
            .from(modules)
            .innerJoin(projects, eq(modules.projectId, projects.id))
            .innerJoin(users, eq(projects.managerId, users.id))
            .where(eq(modules.id, moduleId));

      if (!moduleWithProject?.module || !moduleWithProject?.project || !moduleWithProject?.manager) {
        return;
      }

      // Send internal notification to project manager
            await this.createNotification({
              userId: moduleWithProject.manager.id,
              type: 'module_completed',
              title: `Module Ready for QA: ${moduleWithProject.module.name}`,
              message: `Module "${moduleWithProject.module.name}" in project "${moduleWithProject.project.name}" has been completed and is ready for QA review. All subtasks have been finished.`,
              relatedId: moduleId
            } as any);

      // Send email notification to finance team
      const financeEmail = await this.getSystemConfig('financeEmail');
      if (financeEmail) {
        try {
          const { emailService } = await import('./services/emailService');
          
          const emailContent = `
Dear Finance Team,

A module has been completed and is ready for QA review:

Project: ${moduleWithProject.project.name}
Module: ${moduleWithProject.module.name}
Project Manager: ${moduleWithProject.manager.firstName} ${moduleWithProject.manager.lastName}
Status: Ready for QA Review
Completion Date: ${new Date().toLocaleDateString()}

Please review the module and proceed with QA processes.

Best regards,
TaskFlow System
          `;

          await emailService.sendEmail({
            to: financeEmail,
            subject: `Module Ready for QA: ${moduleWithProject.module.name}`,
            text: emailContent
          });
        } catch (emailError) {
          console.error('Error sending finance email notification:', emailError);
        }
      }
    } catch (error) {
      console.error('Error sending finance notification for module QA:', error);
    }
  }

  async updatePhaseStatusFromModules(projectId: string, phaseNumber: number): Promise<void> {
    try {
      // For Phase 3, check milestone billing status instead of module status
      if (phaseNumber === 3) {
        // Get all milestones for this phase
        const phaseMilestones = await db
          .select({ billingStatus: milestones.billingStatus })
          .from(milestones)
          .where(eq(milestones.projectId, projectId));

        if (phaseMilestones.length === 0) {
          return; // No milestones in this phase
        }

        // Check milestone billing status distribution
        // Phase is completed when all milestones are 'sent' or 'paid'
        const allCompleted = phaseMilestones.every(milestone => 
          ['sent', 'paid', 'processing'].includes(milestone.billingStatus)
        );
        // Phase is in progress when any milestone is 'to_send' or beyond
        const anyInProgress = phaseMilestones.some(milestone => 
          ['to_send', 'sent', 'paid', 'processing'].includes(milestone.billingStatus)
        );

        // Get current phase
        const [currentPhase] = await db
          .select({ status: projectPhases.status })
          .from(projectPhases)
          .where(
            and(
              eq(projectPhases.projectId, projectId),
              eq(projectPhases.phaseNumber, phaseNumber)
            )
          );

        if (!currentPhase) {
          return; // Phase not found
        }

        let newStatus = currentPhase.status;

        // Auto-complete phase when all milestones are sent/paid
        if (allCompleted && currentPhase.status !== 'completed') {
          newStatus = 'completed';
        }
        // Auto-set phase to in_progress when any milestone is to_send or beyond
        else if (anyInProgress && currentPhase.status === 'not_started') {
          newStatus = 'in_progress';
        }

        // Update phase status if it needs to change
        if (newStatus !== currentPhase.status) {
          await db
            .update(projectPhases)
            .set({ 
              status: newStatus as any,
              completedAt: newStatus === 'completed' ? new Date() : undefined,
              updatedAt: new Date() as any
            } as any)
            .where(
              and(
                eq(projectPhases.projectId, projectId),
                eq(projectPhases.phaseNumber, phaseNumber)
              )
            );
        }
        return;
      }

      // For other phases (1,2,4,5,6), check module status directly
      const phaseModules = await db
        .select({ status: modules.status })
        .from(modules)
        .where(
          and(
            eq(modules.projectId, projectId),
            eq(modules.phaseNumber, phaseNumber)
          )
        );

      if (phaseModules.length === 0) {
        return; // No modules in this phase
      }

      // Check module status distribution (using 'completed' status)
      const allCompleted = phaseModules.every(module => module.status === 'completed');
      const anyInProgress = phaseModules.some(module => module.status === 'in_progress');

      // Get current phase
      const [currentPhase] = await db
        .select({ status: projectPhases.status })
        .from(projectPhases)
        .where(
          and(
            eq(projectPhases.projectId, projectId),
            eq(projectPhases.phaseNumber, phaseNumber)
          )
        );

      if (!currentPhase) {
        return; // Phase not found
      }

      let newStatus = currentPhase.status;

      // Auto-complete phase when all modules are completed
      if (allCompleted && currentPhase.status !== 'completed') {
        newStatus = 'completed';
      }
      // Auto-set phase to in_progress when any module is in_progress
      else if (anyInProgress && currentPhase.status === 'not_started') {
        newStatus = 'in_progress';
      }

      // Update phase status if it needs to change
      if (newStatus !== currentPhase.status) {
        await db
          .update(projectPhases)
          .set({
            status: newStatus as any,
            completedAt: newStatus === 'completed' ? new Date() : undefined,
            updatedAt: new Date() as any
          } as any)
          .where(
            and(
              eq(projectPhases.projectId, projectId),
              eq(projectPhases.phaseNumber, phaseNumber)
            )
          );

        // Phase status updated
      }
    } catch (error) {
      console.error('Error updating phase status from modules:', error);
      throw error;
    }
  }

  // Implementation for updatePhaseStatusFromMilestones - updates phase based on milestone status
  async updatePhaseStatusFromMilestones(phaseId: string): Promise<void> {
    try {
      // Get phase information
      const [phase] = await db
        .select({
          id: projectPhases.id,
          projectId: projectPhases.projectId,
          phaseNumber: projectPhases.phaseNumber,
          status: projectPhases.status
        })
        .from(projectPhases)
        .where(eq(projectPhases.id, phaseId));

      if (!phase) {
        // Phase not found
        return;
      }

      let allCompleted = false;
      let anyInProgress = false;

      // For Phase 3, check milestone billing status
      if (phase.phaseNumber === 3) {
      const phaseMilestones = await db
          .select({ billingStatus: milestones.billingStatus })
          .from(milestones)
          .where(eq(milestones.projectId, phase.projectId));

        if (phaseMilestones.length === 0) {
          return; // No milestones in this phase
        }

        // Phase is completed when all milestones are 'sent' or 'paid'
        allCompleted = phaseMilestones.every(milestone => 
          ['sent', 'paid', 'processing'].includes(milestone.billingStatus)
        );
        // Phase is in progress when any milestone is 'to_send' or beyond
        anyInProgress = phaseMilestones.some(milestone => 
          ['to_send', 'sent', 'paid', 'processing'].includes(milestone.billingStatus)
        );
      } else {
        // For other phases, check module status
        const phaseModules = await db
        .select({ status: modules.status })
        .from(modules)
        .where(
          and(
            eq(modules.projectId, phase.projectId),
            eq(modules.phaseNumber, phase.phaseNumber)
          )
        );

        if (phaseModules.length === 0) {
          return; // No modules in this phase
        }

        // Check module status distribution
        allCompleted = phaseModules.every(module => module.status === 'completed');
        anyInProgress = phaseModules.some(module => 
          ['in_progress', 'ongoing', 'started'].includes(module.status)
        );
      }

      let newStatus = phase.status;

      // Auto-complete phase when all milestones/modules are done
      if (allCompleted && phase.status !== 'completed') {
        newStatus = 'completed';
      }
      // Auto-set phase to in_progress when any milestone/module is in_progress
      else if (anyInProgress && phase.status === 'not_started') {
        newStatus = 'in_progress';
      }

      // Update phase status if it needs to change
      if (newStatus !== phase.status) {
        await db
          .update(projectPhases)
          .set({
            status: newStatus as any,
            completedAt: newStatus === 'completed' ? new Date() : undefined,
            updatedAt: new Date() as any
          } as any)
          .where(eq(projectPhases.id, phaseId));

        // Phase status updated
      }
    } catch (error) {
      console.error('Error updating phase status from milestones:', error);
      throw error;
    }
  }

  private async sendFinanceModuleDeadlineNotification(
    moduleRows: any[], 
    timeframe: '1 week' | '2 weeks'
  ): Promise<void> {
    try {
      // Get finance email from system config
      const financeEmail = await this.getSystemConfig('financeEmail');
      if (!financeEmail) {
        console.warn('Finance email not configured in system settings. Skipping finance deadline notifications.');
        return;
      }

      // Group modules by project for better email formatting
      const modulesByProject = moduleRows.reduce((acc: any, row) => {
        const module = row.modules;
        const project = row.projects;
        const team = row.teams;
        
        if (module && project) {
          if (!acc[project.id]) {
            acc[project.id] = {
              project,
              team,
              modules: []
            };
          }
          acc[project.id].modules.push(module);
        }
        return acc;
      }, {});

      // Import emailService dynamically to avoid circular dependency
      const { emailService } = await import('./services/emailService');

      // Send email to finance team
      const projectCount = Object.keys(modulesByProject).length;
      const totalModules = moduleRows.length;

      let emailContent = `
Dear Finance Team,\n\nThe following ${totalModules} module(s) from ${projectCount} project(s) are due in ${timeframe}:\n\n`;

      Object.values(modulesByProject).forEach((projectGroup: any) => {
        const { project, team, modules } = projectGroup;
        emailContent += `PROJECT: ${project.name}\n`;
        emailContent += `Team: ${team?.name || 'Unassigned'}\n`;
        emailContent += `Segment: ${project.segment || 'Not specified'}\n`;
        emailContent += `\nModules due in ${timeframe}:\n`;
        
        modules.forEach((module: any) => {
          const dueDate = module.dueDate ? new Date(module.dueDate).toLocaleDateString() : 'Not set';
          emailContent += `  • ${module.name} - Due: ${dueDate} (Priority: ${module.priority || 'medium'})\n`;
        });
        
        emailContent += `\n${'='.repeat(50)}\n\n`;
      });

      emailContent += `Please ensure adequate budget allocation and resource planning for these upcoming module deadlines.\n\nBest regards,\nTaskFlow System`;

      await emailService.sendEmail({
        to: financeEmail,
        subject: `Module Deadline Alert: ${totalModules} module(s) due in ${timeframe}`,
        text: emailContent
      });

      // Finance notification sent

    } catch (error) {
      console.error(`Error sending finance notification for modules due in ${timeframe}:`, error);
    }
  }

  // Milestone operations (for invoicable entities)
  async getMilestones(): Promise<(Milestone & { project: Project; modules: Module[] })[]> {
    try {
      // Get all milestones with their projects
      const milestonesWithProjects = await db
        .select({
          milestone: milestones,
          project: projects
        })
        .from(milestones)
        .leftJoin(projects, eq(milestones.projectId, projects.id))
        .orderBy(asc(milestones.createdAt));

      // For each milestone, get associated modules (when the relationship is added later)
      const milestonesWithProjectsAndModules = await Promise.all(
        milestonesWithProjects.map(async (row) => {
          // For now, return empty modules array since milestone-module relationship isn't implemented yet
          // When implemented, this will query the moduleMilestones table
          const modules: Module[] = [];
          
          return {
            ...row.milestone,
            project: row.project!,
            modules
          };
        })
      );

      return milestonesWithProjectsAndModules;
    } catch (error) {
      console.error('Error fetching milestones:', error);
      return [];
    }
  }

  async getMilestone(id: string): Promise<(Milestone & { project: Project; modules: Module[] }) | undefined> {
    try {
      // Get milestone with its project
      const [result] = await db
        .select({
          milestone: milestones,
          project: projects
        })
        .from(milestones)
        .leftJoin(projects, eq(milestones.projectId, projects.id))
        .where(eq(milestones.id, id));

      if (!result) {
        return undefined;
      }

      // For now, return empty modules array since milestone-module relationship isn't implemented yet
      // When implemented, this will query the moduleMilestones table
      const modules: Module[] = [];

      return {
        ...result.milestone,
        project: result.project!,
        modules
      };
    } catch (error) {
      console.error('Error fetching milestone:', error);
      return undefined;
    }
  }

  async createMilestone(milestone: InsertMilestone): Promise<Milestone> {
    try {
      const [newMilestone] = await db.insert(milestones).values(milestone as any).returning();
      return newMilestone;
    } catch (error) {
      console.error('Error creating milestone:', error);
      throw error;
    }
  }

  async updateMilestone(id: string, milestone: Partial<InsertMilestone>): Promise<Milestone> {
    try {
      const [updatedMilestone] = await db
        .update(milestones)
        .set({ 
          ...milestone, 
          updatedAt: new Date() as any
        } as any)
        .where(eq(milestones.id, id))
        .returning();
      
      return updatedMilestone;
    } catch (error) {
      console.error('Error updating milestone:', error);
      throw error;
    }
  }

  async deleteMilestone(id: string): Promise<void> {
    try {
      // First delete any related records in moduleMilestones table (when implemented)
      // For now, we skip this since milestone-module relationship isn't active yet
      
      // Delete the milestone
      await db
        .delete(milestones)
        .where(eq(milestones.id, id));
        
      // Milestone deleted successfully
    } catch (error) {
      console.error('Error deleting milestone:', error);
      throw error;
    }
  }

  async getMilestonesByProject(projectId: string): Promise<(Milestone & { modules: Module[] })[]> {
    try {
      // Get all milestones for the project
      const projectMilestones = await db
        .select()
        .from(milestones)
        .where(eq(milestones.projectId, projectId))
        .orderBy(asc(milestones.createdAt));

      // For each milestone, get the associated modules
      const milestonesWithModules = await Promise.all(
        projectMilestones.map(async (milestone) => {
          // Get modules that belong to this milestone
          const milestoneModuleIds = await db
            .select({ moduleId: moduleMilestones.moduleId })
            .from(moduleMilestones)
            .where(eq(moduleMilestones.milestoneId, milestone.id));

          const moduleIds = milestoneModuleIds.map(m => m.moduleId);

          let milestoneModules: Module[] = [];
          if (moduleIds.length > 0) {
            // Get the actual module data
            milestoneModules = await db
              .select()
              .from(modules)
              .where(inArray(modules.id, moduleIds))
              .orderBy(asc(modules.createdAt));
          }

          return {
            ...milestone,
            modules: milestoneModules
          };
        })
      );

      return milestonesWithModules;
    } catch (error) {
      console.error('Error fetching milestones by project:', error);
      return [];
    }
  }

  async addModuleToMilestone(milestoneId: string, moduleId: string): Promise<void> {
    try {
      // Check if milestone exists
      const milestone = await this.getMilestone(milestoneId);
      if (!milestone) {
        throw new Error('Milestone not found');
      }

      // Check if module exists
      const module = await this.getModule(moduleId);
      if (!module) {
        throw new Error('Module not found');
      }

      // Check if relationship already exists
      const existingRelation = await db
        .select()
        .from(moduleMilestones)
        .where(
          and(
            eq(moduleMilestones.milestoneId, milestoneId),
            eq(moduleMilestones.moduleId, moduleId)
          )
        );

      if (existingRelation.length > 0) {
        throw new Error('Module is already associated with this milestone');
      }

      // Create the relationship
      await db
        .insert(moduleMilestones)
        .values({
          milestoneId,
          moduleId
        } as any);

      // Module added to milestone
    } catch (error) {
      console.error('Error adding module to milestone:', error);
      throw error;
    }
  }

  async removeModuleFromMilestone(milestoneId: string, moduleId: string): Promise<void> {
    try {
      // Remove the relationship
      const result = await db
        .delete(moduleMilestones)
        .where(
          and(
            eq(moduleMilestones.milestoneId, milestoneId),
            eq(moduleMilestones.moduleId, moduleId)
          )
        )
        .returning();

      if (result.length === 0) {
        throw new Error('Module-milestone relationship not found');
      }

      // Module removed from milestone
    } catch (error) {
      console.error('Error removing module from milestone:', error);
      throw error;
    }
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
      .values({ key, value, description: description as any } as any)
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value,
          description: description as any,
          updatedAt: new Date() as any,
        } as any,
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
  async getSubtask(id: string): Promise<any> {
    const [result] = await db
      .select()
      .from(subtasks)
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(eq(subtasks.id, id));
    
    if (!result) return null;
    
    const subtask = {
      ...result.subtasks,
      assignedUser: result.users
    };
    
    
    return subtask;
  }

  async getSubtasksByModule(moduleId: string): Promise<any[]> {
    return await db
      .select()
      .from(subtasks)
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(eq(subtasks.moduleId, moduleId))
      .orderBy(asc(subtasks.createdAt))
      .then(rows => rows.map(row => ({
        ...row.subtasks,
        assignedUser: row.users
      })));
  }

  async getSubtasksByMilestone(milestoneId: string): Promise<any[]> {
    // Get all modules that belong to this milestone
    const milestoneModules = await db
      .select({ moduleId: moduleMilestones.moduleId })
      .from(moduleMilestones)
      .where(eq(moduleMilestones.milestoneId, milestoneId))
      .execute();

    if (milestoneModules.length === 0) {
      return [];
    }

    const moduleIds = milestoneModules.map(m => m.moduleId);

    // Get all subtasks for these modules
    const result = await db
      .select({
        subtask: subtasks,
        assignedUser: users,
      })
      .from(subtasks)
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(inArray(subtasks.moduleId, moduleIds))
      .orderBy(asc(subtasks.createdAt));

    // Get dependencies and populate assignments for each subtask
    const subtasksWithDeps = await Promise.all(
      result.map(async (row) => {
        const deps = await this.getSubtaskDependencies(row.subtask.id);
        
        const subtask = {
          ...row.subtask,
          assignedUser: row.assignedUser,
          dependencies: deps.map(d => d.dependsOnSubtaskId)
        };

        // Populate assignedDev
        if (subtask.assignedDevId) {
          try {
            const assignedDev = await this.getUser(subtask.assignedDevId);
            if (assignedDev) {
              (subtask as any).assignedDev = {
                id: assignedDev.id,
                firstName: assignedDev.firstName,
                lastName: assignedDev.lastName,
                email: assignedDev.email
              };
            }
          } catch (error) {
            // Silently handle error
          }
        }

        // Populate assignedConsultant
        if (subtask.assignedConsultantId) {
          try {
            const assignedConsultant = await this.getUser(subtask.assignedConsultantId);
            if (assignedConsultant) {
              (subtask as any).assignedConsultant = {
                id: assignedConsultant.id,
                firstName: assignedConsultant.firstName,
                lastName: assignedConsultant.lastName,
                email: assignedConsultant.email
              };
            }
          } catch (error) {
            // Silently handle error
          }
        }

        return subtask;
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
        moduleId: subtask.moduleId,
        assignedUserId: subtask.assignedUserId || null,
        assignedDevId: subtask.assignedDevId || null,
        assignedConsultantId: subtask.assignedConsultantId || null,
        createdById: subtask.createdById,
      } as any)
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
    if (subtask.assignedDevId !== undefined) updateData.assignedDevId = subtask.assignedDevId;
    if (subtask.assignedConsultantId !== undefined) updateData.assignedConsultantId = subtask.assignedConsultantId;
    if (subtask.completedAt !== undefined) updateData.completedAt = subtask.completedAt;

    const [updatedSubtask] = await db
      .update(subtasks)
      .set(updateData)
      .where(eq(subtasks.id, id))
      .returning();
      
    // Update module progress after subtask update
    if (updatedSubtask && updatedSubtask.moduleId) {
      await this.updateModuleProgressFromSubtasks(updatedSubtask.moduleId);
      // Trigger module status automation
      await this.updateModuleStatusFromSubtasks(updatedSubtask.moduleId);
      
      // For Phases 1,2,4,5,6, also update milestone billing status
      const [module] = await db
        .select({ phaseNumber: modules.phaseNumber })
        .from(modules)
        .where(eq(modules.id, updatedSubtask.moduleId));
      
      if (module && module.phaseNumber !== 3) {
        await this.updateMilestoneStatusFromSubtasks(updatedSubtask.id);
      }
    }
    
    return updatedSubtask;
  }

  async deleteSubtask(id: string): Promise<void> {
    // Get subtask info before deletion to update module progress
    const [subtask] = await db
      .select({ moduleId: subtasks.moduleId })
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
    
    // Update module progress
    if (subtask?.moduleId) {
      await this.updateModuleProgressFromSubtasks(subtask.moduleId);
      // Trigger module status automation
      await this.updateModuleStatusFromSubtasks(subtask.moduleId);
    }
  }

  async getSubtaskDependencies(subtaskId: string): Promise<any[]> {
    return await db
      .select()
      .from(subtaskDependencies)
      .where(eq(subtaskDependencies.subtaskId, subtaskId));
  }

  async updateModuleProgressFromSubtasks(moduleId: string): Promise<void> {
    // Get all subtasks for this module
    const result = await db
      .select({
        total: count(),
        completed: sql<number>`COUNT(*) FILTER (WHERE ${subtasks.status} = 'finished')`,
      })
      .from(subtasks)
      .where(eq(subtasks.moduleId, moduleId));

    const stats = result[0];
    if (stats && Number(stats.total) > 0) {
      const progress = Math.round((Number(stats.completed) / Number(stats.total)) * 100);
      
      // Update the module's progress
      await db
        .update(modules)
        .set({ progressPercent: progress as any } as any)
        .where(eq(modules.id, moduleId));
    }
  }

  // Module operations
  async getModules(): Promise<(Module & { project: Project; assignedUser: User | null })[]> {
    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .orderBy(asc(modules.createdAt))
      .then(rows => rows.map(row => ({
        ...row.modules,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getModule(id: string): Promise<(Module & { project: Project; assignedUser: User | null }) | undefined> {
    const [result] = await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(eq(modules.id, id));

    if (!result) return undefined;

    return {
      ...result.modules,
      project: result.projects!,
      assignedUser: result.users
    };
  }

  async createModule(module: InsertModule): Promise<Module> {
    const [newModule] = await db.insert(modules).values(module as any).returning();
    
    // Update project progress
    await this.updateProjectProgress((module as any).projectId);
    
    // Recalculate project budget
    await this.recalculateProjectBudget((module as any).projectId);
    
    // Update project status based on milestones
    await this.updateProjectStatusBasedOnMilestones((module as any).projectId);
    
    return newModule;
  }

  async updateModule(id: string, module: Partial<InsertModule>): Promise<Module> {
    // Check if this is a milestone (by checking if it exists in milestones table)
    const milestone = await db.select().from(milestones).where(eq(milestones.id, id)).limit(1);
    
    if (milestone.length > 0) {
      // Update milestone
      const [updatedMilestone] = await db
        .update(milestones)
        .set({ 
          ...module, 
          updatedAt: new Date() as any
        } as any)
        .where(eq(milestones.id, id))
        .returning();

      // Update project progress
      await this.updateProjectProgress(updatedMilestone.projectId);
      // Recalculate project budget when fees change
      await this.recalculateProjectBudget(updatedMilestone.projectId);
      // Auto-update project status based on milestone progress
      await this.updateProjectStatusBasedOnMilestones(updatedMilestone.projectId);

      // Return as module-like object
      return {
        ...updatedMilestone,
        dueDate: updatedMilestone.endDate,
        estimatedHours: null,
        actualHours: 0,
        weight: 2,
        assignedUserId: null,
        phaseNumber: 3,
        phaseName: 'Development',
        progressPercent: 0,
        isMilestone: true
      } as any;
    } else {
      // Update regular module
    const [updatedModule] = await db
      .update(modules)
      .set({ 
        ...module, 
        updatedAt: new Date() as any,
        completedAt: (module as any).status === 'completed' ? new Date() : undefined
      } as any)
      .where(eq(modules.id, id))
      .returning();

    // Update project progress
    await this.updateProjectProgress(updatedModule.projectId);
    // Recalculate project budget when fees change
    await this.recalculateProjectBudget(updatedModule.projectId);
    // Auto-update project status based on milestone progress
    await this.updateProjectStatusBasedOnMilestones(updatedModule.projectId);
    
    // Handle Phase 3 specific logic: Update milestone status when module changes
    if (updatedModule.phaseNumber === 3) {
      await this.updateMilestoneStatusFromModules(updatedModule.id);
    }
    
    // Update phase status based on module status changes
    if (updatedModule.phaseNumber) {
      await this.updatePhaseStatusFromModules(updatedModule.projectId, updatedModule.phaseNumber);
    }

    return updatedModule;
    }
  }

    async getModulesByProject(projectId: string): Promise<(Module & { assignedUser: User | null; subtasks: any[]; isMilestone?: boolean; feeAmount?: any; expectedInvoiceDate?: any; expectedCollectionDate?: any; modules?: any[] })[]> {
    // Get milestones for Phase 3 to include them in the modules table
    const projectMilestones = await db
      .select()
      .from(milestones)
      .where(eq(milestones.projectId, projectId))
      .orderBy(asc(milestones.createdAt));

    // For each milestone, get its nested modules or direct subtasks
    const milestonesWithModules = await Promise.all(
      projectMilestones.map(async (milestone) => {
        // Determine phase number based on milestone name
        const getPhaseNumber = (milestoneName: string): number => {
          const phaseMap: { [key: string]: number } = {
            'Project Setup': 1,
            'Contract Finalization': 1,
            'System Architecture': 2,
            'UI/UX Design': 2,
            'Core System Development': 3,
            'Financial System': 3,
            'Academic Management': 3,
            'System Testing': 4,
            'User Acceptance Testing': 4,
            'Production Deployment': 5,
            'Go-Live Support': 5,
            'Post-Launch Support': 6
          };
          return phaseMap[milestoneName] || 3; // Default to 3 if not found
        };

        const getPhaseName = (phaseNumber: number): string => {
          const phaseNames: { [key: number]: string } = {
            1: 'Initiation & Contracting',
            2: 'Planning & Design',
            3: 'Development',
            4: 'Testing & Quality Assurance',
            5: 'Deployment & Go-Live',
            6: 'Support & Maintenance'
          };
          return phaseNames[phaseNumber] || 'Development';
        };

        const phaseNumber = getPhaseNumber(milestone.name);
        const phaseName = getPhaseName(phaseNumber);

        if (phaseNumber === 3) {
          // Phase 3: Get modules that belong to this milestone
        const milestoneModules = await db
          .select()
          .from(modules)
          .leftJoin(users, eq(modules.assignedUserId, users.id))
          .where(and(
            eq(modules.projectId, projectId),
            eq(modules.milestoneId, milestone.id)
          ))
          .orderBy(asc(modules.createdAt))
          .then(rows => rows.map(row => ({
            ...row.modules,
            assignedUser: row.users
          })));

        // Get subtasks for each module under this milestone
        const modulesWithSubtasks = await Promise.all(
          milestoneModules.map(async (module) => {
            const subtasksWithUsers = await db
              .select({
                subtask: subtasks,
                assignedUser: users,
              })
              .from(subtasks)
              .leftJoin(users, eq(subtasks.assignedUserId, users.id))
              .where(eq(subtasks.moduleId, module.id))
              .orderBy(asc(subtasks.createdAt));

            // Populate assignedDev and assignedConsultant for subtasks
            const subtasksWithAssignments = await Promise.all(
              subtasksWithUsers.map(async (row) => {
                const subtask = {
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
                assignedDevId: row.subtask.assignedDevId,
                assignedConsultantId: row.subtask.assignedConsultantId,
                assignedUser: row.assignedUser,
                completedAt: row.subtask.completedAt
                };

                // Populate assignedDev
                if (subtask.assignedDevId) {
                  try {
                    const assignedDev = await this.getUser(subtask.assignedDevId);
                    if (assignedDev) {
                      (subtask as any).assignedDev = {
                        id: assignedDev.id,
                        firstName: assignedDev.firstName,
                        lastName: assignedDev.lastName,
                        email: assignedDev.email
                      };
                    }
                  } catch (error) {
                    // Silently handle error
                  }
                }

                // Populate assignedConsultant
                if (subtask.assignedConsultantId) {
                  try {
                    const assignedConsultant = await this.getUser(subtask.assignedConsultantId);
                    if (assignedConsultant) {
                      (subtask as any).assignedConsultant = {
                        id: assignedConsultant.id,
                        firstName: assignedConsultant.firstName,
                        lastName: assignedConsultant.lastName,
                        email: assignedConsultant.email
                      };
                    }
                  } catch (error) {
                    // Silently handle error
                  }
                }

                return subtask;
              })
            );

            return {
              ...module,
              subtasks: subtasksWithAssignments
            };
          })
        );

        // Convert milestone to module-like object with nested modules
        return {
          id: milestone.id,
          name: milestone.name,
          description: milestone.description,
          priority: milestone.priority,
          status: 'not_started', // Default status for milestones
          billingStatus: milestone.billingStatus,
          startDate: milestone.startDate,
          dueDate: milestone.endDate,
          estimatedHours: null,
          actualHours: 0,
          weight: 2,
          assignedUserId: null,
          assignedUser: null,
          projectId: milestone.projectId,
          phaseNumber: phaseNumber,
          phaseName: phaseName,
          progressPercent: 0,
          createdAt: milestone.createdAt,
          updatedAt: milestone.updatedAt,
          subtasks: [],
          // Milestone-specific fields
          feeAmount: milestone.feeAmount,
          expectedInvoiceDate: milestone.expectedInvoiceDate,
          expectedCollectionDate: milestone.expectedCollectionDate,
          isMilestone: true,
          // Nested modules
          modules: modulesWithSubtasks
        } as any;
        } else {
          // Phase 1,2,4,5,6: Get subtasks directly under the milestone
          // First, find the module that represents this milestone
          const milestoneModule = await db
      .select()
      .from(modules)
      .where(and(
        eq(modules.projectId, projectId),
              eq(modules.name, milestone.name) // Match by name since these modules represent the milestones
            ))
            .limit(1);

          let milestoneSubtasks: any[] = [];
          if (milestoneModule.length > 0) {
            // Get subtasks directly under this milestone's module
        const subtasksWithUsers = await db
          .select({
            subtask: subtasks,
            assignedUser: users,
          })
          .from(subtasks)
          .leftJoin(users, eq(subtasks.assignedUserId, users.id))
              .where(eq(subtasks.moduleId, milestoneModule[0].id))
          .orderBy(asc(subtasks.createdAt));

            milestoneSubtasks = subtasksWithUsers.map(row => ({
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
            assignedDevId: row.subtask.assignedDevId,
            assignedConsultantId: row.subtask.assignedConsultantId,
              createdById: row.subtask.createdById,
            assignedUser: row.assignedUser,
            completedAt: row.subtask.completedAt
            }));
          }

          // Convert milestone to module-like object with direct subtasks
          return {
            id: milestone.id,
            name: milestone.name,
            description: milestone.description,
            priority: milestone.priority,
            status: 'not_started', // Default status for milestones
            billingStatus: milestone.billingStatus,
            startDate: milestone.startDate,
            dueDate: milestone.endDate,
            estimatedHours: null,
            actualHours: 0,
            weight: 2,
            assignedUserId: null,
            assignedUser: null,
            projectId: milestone.projectId,
            phaseNumber: phaseNumber,
            phaseName: phaseName,
            progressPercent: 0,
            createdAt: milestone.createdAt,
            updatedAt: milestone.updatedAt,
            subtasks: milestoneSubtasks, // Direct subtasks
            // Milestone-specific fields
            feeAmount: milestone.feeAmount,
            expectedInvoiceDate: milestone.expectedInvoiceDate,
            expectedCollectionDate: milestone.expectedCollectionDate,
            isMilestone: true,
            // Empty modules array since these phases don't have modules
            modules: []
          } as any;
        }
      })
    );

    // Get regular modules (not under milestones) for other phases
    // Return all milestones (no regular modules needed since all milestones are handled above)
    return milestonesWithModules;
  }

  async getModulesByUser(userId: string): Promise<(Module & { project: Project })[]> {
    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .where(eq(modules.assignedUserId, userId))
      .orderBy(asc(modules.createdAt))
      .then(rows => rows.map(row => ({
        ...row.modules,
        project: row.projects!
      })));
  }

  async getOverdueModules(): Promise<(Module & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          sql`${modules.dueDate} < ${now}`,
          sql`${modules.status} != 'done'`
        )
      )
      .orderBy(asc(modules.dueDate))
      .then(rows => rows.map(row => ({
        ...row.modules,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getUpcomingModules(days: number): Promise<(Module & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          sql`${modules.dueDate} >= ${now}`,
          sql`${modules.dueDate} <= ${futureDate}`,
          sql`${modules.status} != 'done'`
        )
      )
      .orderBy(asc(modules.dueDate))
      .then(rows => rows.map(row => ({
        ...row.modules,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getOverdueModulesForUser(userId: string): Promise<(Module & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          eq(modules.assignedUserId, userId),
          sql`${modules.dueDate} < ${now}`,
          sql`${modules.status} != 'done'`
        )
      )
      .orderBy(asc(modules.dueDate))
      .then(rows => rows.map(row => ({
        ...row.modules,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  async getUpcomingModulesForUser(userId: string, days: number): Promise<(Module & { project: Project; assignedUser: User | null })[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    return await db
      .select()
      .from(modules)
      .leftJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(modules.assignedUserId, users.id))
      .where(
        and(
          eq(modules.assignedUserId, userId),
          sql`${modules.dueDate} >= ${now}`,
          sql`${modules.dueDate} <= ${futureDate}`,
          sql`${modules.status} != 'done'`
        )
      )
      .orderBy(asc(modules.dueDate))
      .then(rows => rows.map(row => ({
        ...row.modules,
        project: row.projects!,
        assignedUser: row.users
      })));
  }

  // Task dependency operations (for backward compatibility)
  async getTaskDependencies(taskId: string): Promise<any[]> {
    return await db
      .select()
      .from(moduleDependencies)
      .where(eq(moduleDependencies.moduleId, taskId));
  }

  async createTaskDependency(dependency: any): Promise<any> {
    try {
      // Validate that both modules exist
      const dependentModule = await this.getModule(dependency.moduleId);
      if (!dependentModule) {
        throw new Error('Dependent module not found');
      }

      const dependsOnModule = await this.getModule(dependency.dependsOnModuleId);
      if (!dependsOnModule) {
        throw new Error('Dependency target module not found');
      }

      // Check for circular dependency
      const existingReverseDependency = await db
        .select()
        .from(moduleDependencies)
        .where(
          and(
            eq(moduleDependencies.moduleId, dependency.dependsOnModuleId),
            eq(moduleDependencies.dependsOnModuleId, dependency.moduleId)
          )
        );

      if (existingReverseDependency.length > 0) {
        throw new Error('Circular dependency detected');
      }

      // Check if dependency already exists
      const existingDependency = await db
        .select()
        .from(moduleDependencies)
        .where(
          and(
            eq(moduleDependencies.moduleId, dependency.moduleId),
            eq(moduleDependencies.dependsOnModuleId, dependency.dependsOnModuleId)
          )
        );

      if (existingDependency.length > 0) {
        throw new Error('Dependency already exists');
      }

      // Create the dependency
      const [newDependency] = await db
        .insert(moduleDependencies)
        .values({
          moduleId: dependency.moduleId,
          dependsOnModuleId: dependency.dependsOnModuleId,
          dependencyType: dependency.dependencyType || 'finish_to_start',
          createdAt: new Date()
        } as any)
        .returning();

      // Task dependency created
      return newDependency;
    } catch (error) {
      console.error('Error creating task dependency:', error);
      throw error;
    }
  }

  async deleteTaskDependency(dependencyId: string): Promise<void> {
    try {
      const result = await db
        .delete(moduleDependencies)
        .where(eq(moduleDependencies.id, dependencyId))
        .returning();

      if (result.length === 0) {
        throw new Error('Task dependency not found');
      }

      // Task dependency deleted successfully
    } catch (error) {
      console.error('Error deleting task dependency:', error);
      throw error;
    }
  }

  // Admin Role Management Operations
  async getAdminRoles(): Promise<(AdminRole & { user: User; assignedByUser: User })[]> {
    try {
      const result = await db
        .select({
          id: adminRoles.id,
          userId: adminRoles.userId,
          roleType: adminRoles.roleType,
          segment: adminRoles.segment,
          assignedAt: adminRoles.assignedAt,
          assignedBy: adminRoles.assignedBy,
          isActive: adminRoles.isActive,
          createdAt: adminRoles.createdAt,
          updatedAt: adminRoles.updatedAt,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            isProjectManager: users.isProjectManager,
            isFinanceHead: users.isFinanceHead,
            assignedSegment: users.assignedSegment,
          },
          assignedByUser: {
            id: sql`assigned_by_user.id`,
            email: sql`assigned_by_user.email`,
            firstName: sql`assigned_by_user.first_name`,
            lastName: sql`assigned_by_user.last_name`,
          },
        })
        .from(adminRoles)
        .innerJoin(users, eq(adminRoles.userId, users.id))
        .innerJoin(
          sql`${users} as assigned_by_user`,
          eq(adminRoles.assignedBy, sql`assigned_by_user.id`)
        )
        .where(eq(adminRoles.isActive, true))
        .orderBy(asc(adminRoles.createdAt));

      return result.map((row: any) => ({
        id: row.id,
        userId: row.userId,
        roleType: row.roleType,
        segment: row.segment,
        assignedAt: row.assignedAt,
        assignedBy: row.assignedBy,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        user: row.user,
        assignedByUser: row.assignedByUser,
      }));
    } catch (error) {
      console.error('Error fetching admin roles:', error);
      throw error;
    }
  }

  async getAdminRolesByUser(userId: string): Promise<AdminRole[]> {
    try {
      return await db
        .select()
        .from(adminRoles)
        .where(and(eq(adminRoles.userId, userId), eq(adminRoles.isActive, true)))
        .orderBy(asc(adminRoles.createdAt));
    } catch (error) {
      console.error('Error fetching admin roles by user:', error);
      throw error;
    }
  }

  async assignAdminRole(roleData: InsertAdminRole): Promise<AdminRole> {
    const typedRoleData = roleData as {
      userId: string;
      roleType: AdminRoleType;
      segment?: 'academic' | 'parastals' | 'private';
      assignedBy: string;
      isActive: boolean;
    };
    try {
      // Check if user already has this role
      const existingRole = await db
        .select()
        .from(adminRoles)
        .where(
          and(
            eq(adminRoles.userId, typedRoleData.userId),
            eq(adminRoles.roleType, typedRoleData.roleType),
            typedRoleData.segment ? eq(adminRoles.segment, typedRoleData.segment) : sql`segment IS NULL`,
            eq(adminRoles.isActive, true)
          )
        )
        .limit(1);

      if (existingRole.length > 0) {
        throw new Error('User already has this admin role assigned');
      }

      // Create the admin role assignment
      const [newRole] = await db
        .insert(adminRoles)
        .values({
          ...typedRoleData,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning();

      // Update user table with admin flags and base role
      const updateData: any = { updatedAt: new Date() };
      if (typedRoleData.roleType === 'project_manager') {
        updateData.isProjectManager = true;
        updateData.role = 'project_manager'; // Update base role
      } else if (typedRoleData.roleType === 'finance_head') {
        updateData.isFinanceHead = true;
        updateData.role = 'finance_head'; // Update base role
      } else if (typedRoleData.roleType === 'segment_leader' && typedRoleData.segment) {
        updateData.assignedSegment = typedRoleData.segment;
        updateData.role = 'segment_leader'; // Update base role
      }

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, typedRoleData.userId));

      // Admin role assigned
      return newRole;
    } catch (error) {
      console.error('Error assigning admin role:', error);
      throw error;
    }
  }

  async removeAdminRole(userId: string, roleType: AdminRoleType, segment?: string): Promise<void> {
    try {
      // Deactivate the admin role assignment
      const conditions = [
        eq(adminRoles.userId, userId),
        eq(adminRoles.roleType, roleType),
        eq(adminRoles.isActive, true)
      ];

      if (segment) {
        conditions.push(eq(adminRoles.segment, segment as any));
      } else {
        conditions.push(sql`segment IS NULL`);
      }

      const result = await db
        .update(adminRoles)
        .set({ isActive: false, updatedAt: new Date() } as any)
        .where(and(...conditions))
        .returning();

      if (result.length === 0) {
        throw new Error('Admin role assignment not found');
      }

      // Update user table to remove admin flags and reset base role
      const updateData: any = { updatedAt: new Date() };
      if (roleType === 'project_manager') {
        updateData.isProjectManager = false;
        updateData.role = 'employee'; // Reset base role
      } else if (roleType === 'finance_head') {
        updateData.isFinanceHead = false;
        updateData.role = 'employee'; // Reset base role
      } else if (roleType === 'segment_leader') {
        updateData.assignedSegment = null;
        updateData.role = 'employee'; // Reset base role
      }

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId));

      // Admin role removed
    } catch (error) {
      console.error('Error removing admin role:', error);
      throw error;
    }
  }

  async getUserDashboardRole(userId: string): Promise<{ role: string; isProjectManager: boolean; isFinanceHead: boolean; assignedSegment?: string }> {
    try {
      const [user] = await db
        .select({
          role: users.role,
          isProjectManager: users.isProjectManager,
          isFinanceHead: users.isFinanceHead,
          assignedSegment: users.assignedSegment,
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        throw new Error('User not found');
      }

      return {
        role: user.role,
        isProjectManager: user.isProjectManager || false,
        isFinanceHead: user.isFinanceHead || false,
        assignedSegment: user.assignedSegment || undefined,
      };
    } catch (error) {
      console.error('Error fetching user dashboard role:', error);
      throw error;
    }
  }

  async getSegmentLeaderData(): Promise<{ academic: any; parastals: any; private: any; projectManager: any; financeHead: any }> {
    try {
      // Get segment leaders from admin roles
      const segmentLeaderRoles = await db
        .select({
          userId: adminRoles.userId,
          segment: adminRoles.segment,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(adminRoles)
        .innerJoin(users, eq(adminRoles.userId, users.id))
        .where(
          and(
            eq(adminRoles.roleType, 'segment_leader'),
            eq(adminRoles.isActive, true)
          )
        );

      // Get project manager
      const [projectManagerRole] = await db
        .select({
          userId: adminRoles.userId,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(adminRoles)
        .innerJoin(users, eq(adminRoles.userId, users.id))
        .where(
          and(
            eq(adminRoles.roleType, 'project_manager'),
            eq(adminRoles.isActive, true)
          )
        )
        .limit(1);

      // Get finance head
      const [financeHeadRole] = await db
        .select({
          userId: adminRoles.userId,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(adminRoles)
        .innerJoin(users, eq(adminRoles.userId, users.id))
        .where(
          and(
            eq(adminRoles.roleType, 'finance_head'),
            eq(adminRoles.isActive, true)
          )
        )
        .limit(1);

      const result = {
        academic: segmentLeaderRoles.find(r => r.segment === 'academic')?.user || null,
        parastals: segmentLeaderRoles.find(r => r.segment === 'parastals')?.user || null,
        private: segmentLeaderRoles.find(r => r.segment === 'private')?.user || null,
        projectManager: projectManagerRole?.user || null,
        financeHead: financeHeadRole?.user || null,
      };

      return result;
    } catch (error) {
      console.error('Error fetching segment leader data:', error);
      throw error;
    }
  }



  async createUserWithCredentials(
    userData: { email: string; firstName: string; lastName: string; role: AdminRoleType; segment?: string },
    assignedBy: string
  ): Promise<{ user: User; temporaryPassword: string }> {
    try {
      // Generate temporary password
      const temporaryPassword = Math.random().toString(36).slice(-8);
      
      // Hash the password (you'll need to implement password hashing)
      // const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
      
      // Create user with employee role (they'll get admin privileges through admin roles table)
      const [newUser] = await db
        .insert(users)
        .values({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: 'employee', // Base role
          password: temporaryPassword, // TODO: Hash this properly
          temporaryPassword: temporaryPassword,
          passwordGeneratedAt: new Date(),
          mustChangePassword: true, // Force password change on first login
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning();

      // Assign admin role
      await this.assignAdminRole({
        userId: newUser.id,
        roleType: userData.role,
        segment: userData.segment as any,
        assignedBy: assignedBy,
      });

      // User created with admin role
      return { user: newUser, temporaryPassword };
    } catch (error) {
      console.error('Error creating user with credentials:', error);
      throw error;
    }
  }

  // Add method to handle password changes
  async updateUserPassword(userId: string, newPassword: string, isFirstChange: boolean = false): Promise<void> {
    try {
      const updateData: any = {
        password: newPassword,
        lastPasswordChange: new Date(),
        updatedAt: new Date(),
      };

      if (isFirstChange) {
        updateData.mustChangePassword = false;
        updateData.temporaryPassword = null;
        updateData.passwordGeneratedAt = null;
      }

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId));

      // Password updated
    } catch (error) {
      console.error('Error updating user password:', error);
      throw error;
    }
  }

  async getOverdueBreakdownForUser(userId: string): Promise<{
    overdueModules: (Module & { project: Project; assignedUser: User | null })[];
    overdueSubtasks: (Subtask & { module: Module; project: Project; assignedUser: User | null })[];
  }> {
    const now = new Date();

    // Get overdue modules through user's overdue subtasks
    const overdueModules = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(
        and(
          or(
            eq(subtasks.assignedUserId, userId),
            eq(subtasks.assignedDevId, userId),
            eq(subtasks.assignedConsultantId, userId)
          ),
          sql`${subtasks.dueDate} < ${now}`,
          sql`${subtasks.status} != 'completed'`
        )
      )
      .execute();

    // Get overdue subtasks
    const overdueSubtasks = await db
      .select()
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .leftJoin(users, eq(subtasks.assignedUserId, users.id))
      .where(
        and(
          or(
            eq(subtasks.assignedUserId, userId),
            eq(subtasks.assignedDevId, userId),
            eq(subtasks.assignedConsultantId, userId)
          ),
          sql`${subtasks.dueDate} < ${now}`,
          sql`${subtasks.status} != 'completed'`
        )
      )
      .execute();

    return {
      overdueModules: overdueModules.map(row => ({ ...row.modules, project: row.projects, assignedUser: row.users })),
      overdueSubtasks: overdueSubtasks.map(row => ({ ...row.subtasks, module: row.modules, project: row.projects, assignedUser: row.users })),
    };
  }

  async getUserAssignments(userId: string): Promise<{
    projects: Project[];
    subtasks: (Subtask & { module: Module; project: Project })[];
  }> {
    // Projects via team membership
    const teamProjectRows = await db
      .select({ project: projects })
      .from(projects)
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId));

    // Projects via user assigned to modules or subtasks
    const moduleProjectRows = await db
      .select({ project: projects })
      .from(modules)
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .where(eq(modules.assignedUserId, userId));

    const subtaskProjectRows = await db
      .select({ project: projects })
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .where(or(eq(subtasks.assignedUserId, userId), eq(subtasks.assignedDevId, userId), eq(subtasks.assignedConsultantId, userId)));

    const allProjects = [
      ...teamProjectRows.map(r => r.project),
      ...moduleProjectRows.map(r => r.project),
      ...subtaskProjectRows.map(r => r.project),
    ];
    const projectMap: Record<string, Project> = {};
    for (const p of allProjects) {
      if (p) projectMap[p.id] = p;
    }
    const uniqueProjects = Object.values(projectMap);

    // Subtasks assigned to user with module + project
    const subtaskRows = await db
      .select({ subtask: subtasks, module: modules, project: projects })
      .from(subtasks)
      .innerJoin(modules, eq(subtasks.moduleId, modules.id))
      .innerJoin(projects, eq(modules.projectId, projects.id))
      .where(or(eq(subtasks.assignedUserId, userId), eq(subtasks.assignedDevId, userId), eq(subtasks.assignedConsultantId, userId)))
      .orderBy(desc(subtasks.createdAt as any));

    const userSubtasks = subtaskRows.map(r => ({ ...r.subtask, module: r.module, project: r.project }));

    return { projects: uniqueProjects, subtasks: userSubtasks };
  }
}

export const storage = new DatabaseStorage();
