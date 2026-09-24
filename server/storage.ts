import {
  users,
  teams,
  projects,
  billingItems,
  teamMembers,
  projectAttachments,
  notifications,
  userNotificationPreferences,
  userCalendarSettings,
  invoiceReports,
  monthlyTargets,
  invoiceCollections,
  contracts,
  type User,
  type UpsertUser,
  type Team,
  type InsertTeam,
  type Project,
  type InsertProject,
  type BillingItem,
  type InsertBillingItem,
  type TeamMember,
  type InsertTeamMember,
  type ProjectAttachment,
  type InsertProjectAttachment,
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
  adminRoleMembers,
  roles,
  type Role,
  type InsertRole,
  permissions,
  type Permission,
  rolePermissions,
  companies,
  type Company,
  type InsertCompany,
  segments,
  type Segment,
  type InsertSegment,
  serviceCategories,
  type ServiceCategory,
  type InsertServiceCategory,
  tickets,
  type Ticket,
  type InsertTicket,
  ticketComments,
  type TicketComment,
  type InsertTicketComment,
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
  createUserWithRole(userData: { email: string; firstName: string; lastName: string; roleId: string | null }, assignedBy: string): Promise<{ user: User; temporaryPassword: string }>;
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; email?: string }): Promise<User>;
  setUserActive(userId: string, isActive: boolean): Promise<User>;
  getUserTicketCounts(): Promise<Record<string, { open: number; resolved: number }>>;

  // Companies operations
  getCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company>;

  // Segments operations (dynamic, admin-managed - replaces the old segment enum)
  getSegments(): Promise<Segment[]>;
  getSegment(id: string): Promise<Segment | undefined>;
  createSegment(segment: InsertSegment): Promise<Segment>;
  updateSegment(id: string, segment: Partial<InsertSegment>): Promise<Segment>;
  deleteSegment(id: string): Promise<void>;

  // Service categories operations
  getServiceCategories(): Promise<ServiceCategory[]>;
  getServiceCategory(id: string): Promise<ServiceCategory | undefined>;
  createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory>;
  updateServiceCategory(id: string, category: Partial<InsertServiceCategory>): Promise<ServiceCategory>;
  deleteServiceCategory(id: string): Promise<void>;

  // Ticket operations
  getTickets(filter: { createdByUserId?: string; assignedToUserId?: string; types?: string[] }): Promise<any[]>;
  getTicket(id: string): Promise<any | undefined>;
  createTicket(ticket: InsertTicket & { ticketNumber: string }): Promise<Ticket>;
  assignTicket(id: string, assignedToUserId: string | null, assignedTeamId?: string | null): Promise<Ticket>;
  updateTicketStatus(id: string, status: string, resolution?: { rootCause: string; resolutionNotes: string }): Promise<Ticket>;
  recordTicketEscalation(id: string, data: { escalatedToUserId: string; escalatedFromUserId: string; reason: string }): Promise<Ticket>;
  getTicketComments(ticketId: string): Promise<(TicketComment & { user: User })[]>;
  addTicketComment(comment: InsertTicketComment): Promise<TicketComment>;
  getTicketCount(): Promise<number>;

  // Dynamic RBAC: roles & permissions operations
  getRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<InsertRole>): Promise<Role>;
  deleteRole(id: string): Promise<void>;
  getPermissions(): Promise<Permission[]>;
  getRolePermissionIds(roleId: string): Promise<string[]>;
  setRolePermissions(roleId: string, permissionIds: string[]): Promise<void>;
  assignUserRole(userId: string, roleId: string | null): Promise<User>;

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
  getProjects(): Promise<(Project & { manager: User; team: Team | null; billingItemCount: number; paidBillingItemCount: number; paidAmount: number; totalFees: number })[]>;
  getProjectsPaginated(page?: number, limit?: number): Promise<{
    data: (Project & { manager: User; team: Team | null; billingItemCount: number; paidBillingItemCount: number; paidAmount: number; totalFees: number })[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>;
  getProject(id: string): Promise<(Project & { manager: User; team: Team | null; company: Company | null }) | undefined>;
  getProjectsForUser(userId: string): Promise<(Project & { manager: User; team: Team | null; billingItemCount: number; paidBillingItemCount: number; paidAmount: number; totalFees: number })[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project>;
  terminateProject(id: string): Promise<Project>; // Method for terminating projects
  closeProjectSupport(id: string): Promise<Project>; // Deliberately close out a project's support/SLA period
  updateProjectProgress(id: string): Promise<void>;
  getProjectsByManager(managerId: string): Promise<Project[]>;
  getProjectsByTeam(teamId: string): Promise<Project[]>;
  getProjectsBySegment(segment: string): Promise<Project[]>; // New method for segment filtering
  recalculateProjectBudget(projectId: string): Promise<void>;
  updateProjectStatusBasedOnBillingItems(projectId: string): Promise<void>;

  // Billing item operations (flat per-project invoicing line items; replaces the old
  // milestone -> module -> subtask delivery hierarchy, which has been removed entirely)
  getBillingItems(): Promise<(BillingItem & { project: Project })[]>;
  getBillingItemsForUser(userId: string): Promise<(BillingItem & { project: Project })[]>;
  getBillingItem(id: string): Promise<(BillingItem & { project: Project }) | undefined>;
  createBillingItem(billingItem: InsertBillingItem): Promise<BillingItem>;
  updateBillingItem(id: string, billingItem: Partial<InsertBillingItem>): Promise<BillingItem>;
  deleteBillingItem(id: string): Promise<void>;
  getBillingItemsByProject(projectId: string): Promise<BillingItem[]>;

  // Invoice and reporting operations
  getInvoiceReport(year: number, month?: number): Promise<any>; // New method for invoice reports
  getMonthlyTargets(year: number): Promise<any[]>; // New method for monthly targets
  calculateMonthlyTargets(year: number): Promise<void>; // New method for auto-calculating targets
  createInvoiceReport(invoice: any): Promise<any>; // New method for creating invoice reports
  updateInvoiceStatus(invoiceId: string, status: string): Promise<any>; // New method for updating invoice status
  recordInvoiceCollection(collection: any): Promise<any>; // New method for recording payments

  // Contract operations
  getContracts(): Promise<any[]>;
  getContract(contractId: string): Promise<any>;
  createContract(contract: any): Promise<any>;
  updateContract(contractId: string, contract: any): Promise<any>;

  // Project charter operations
  getProjectCharter(projectId: string): Promise<any>;
  createProjectCharter(projectId: string, charter: any): Promise<any>;
  updateProjectCharter(projectId: string, charter: any): Promise<any>;

  // Dashboard analytics
  getDashboardMetrics(): Promise<{
    activeProjects: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    billingItemsCount: number;
    paidBillingItemsCount: number;
    overdueBillingItemsCount: number;
    projectsOnSupport: number;
    onSupportProjects: number;
  }>;
  getDashboardMetricsForUser(userId: string): Promise<{
    totalTeamProjects: number;
    activeTeamProjects: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    billingItemsCount: number;
  }>;
  getDashboardMetricsForSegment(segment: string): Promise<{
    activeProjects: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    billingItemsCount: number;
    paidBillingItemsCount: number;
    overdueBillingItemsCount: number;
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
    totalTasks: number;
    completedTasks: number;
    workloadPercentage: number;
  }[]>;
  getDashboardKanbanBillingItems(): Promise<{
    overdue: (BillingItem & { project: Project })[];
    review: (BillingItem & { project: Project })[];
    recentlyDone: (BillingItem & { project: Project })[];
    highPriorityTodo: (BillingItem & { project: Project })[];
  }>;

  // Project Management Dashboard methods
  getProjectPerformanceData(year: number, month?: number): Promise<{
    projects: (Project & { manager: User; team: Team | null; progress: number })[];
    ganttData: any;
    performanceMetrics: {
      totalProjects: number;
      billingProgress: number;
      teamCapacity: number;
      timelineHealth: number;
    };
  }>;

  getRiskQualityData(year: number, month?: number): Promise<{
    supportProjects: any[];
    riskTrends: any[];
  }>;

  // Aggregated assignments for a user across all teams/projects
  getUserAssignments(userId: string): Promise<{
    projects: Project[];
    tickets: any[];
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
  getSegmentLeader(segmentId: string): Promise<any>;
  updateSegmentLeaders(data: {
    leaders: { segmentId: string; leaderEmail: string; leaderName: string }[];
    financeEmail: string;
    accountManagerEmail: string;
  }): Promise<void>;
  setSegmentLeader(segmentId: string, leader: { leaderId: string; leaderName: string; leaderEmail: string } | null): Promise<void>;
  
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
  getUserDashboardRole(userId: string): Promise<{ role: string; assignedSegment?: string }>;
  getSegmentLeaderData(): Promise<{ academic: any; parastals: any; private: any }>;
  createUserWithCredentials(userData: { email: string; firstName: string; lastName: string; role: AdminRoleType; segment?: string }, assignedBy: string): Promise<{ user: User; temporaryPassword: string }>;
  listManagersForHead(headRoleId: string): Promise<{ user: User }[]>;
  addManagersToHead(headRoleId: string, managerUsers: { id: string }[], assignedBy: string): Promise<void>;
  removeManagerFromHead(headRoleId: string, managerUserId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`);
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

    // Explicit projection: never return password/temporaryPassword/resetToken to callers.
    let query = db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        middleName: users.middleName,
        lastName: users.lastName,
        phoneNumber: users.phoneNumber,
        idNumber: users.idNumber,
        profileImageUrl: users.profileImageUrl,
        role: users.role,
        roleId: users.roleId,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        mustChangePassword: users.mustChangePassword,
        lastPasswordChange: users.lastPasswordChange,
        assignedSegment: users.assignedSegment,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users) as any;
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

  async createUserWithRole(
    userData: { email: string; firstName: string; lastName: string; roleId: string | null },
    assignedBy: string
  ): Promise<{ user: User; temporaryPassword: string }> {
    const temporaryPassword = Math.random().toString(36).slice(-8);
    const { hashPassword } = await import('./auth');
    const hashedPassword = await hashPassword(temporaryPassword);

    const [newUser] = await db
      .insert(users)
      .values({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        roleId: userData.roleId,
        role: 'employee',
        password: hashedPassword,
        temporaryPassword,
        passwordGeneratedAt: new Date(),
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    return { user: newUser, temporaryPassword };
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; email?: string }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async setUserActive(userId: string, isActive: boolean): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() } as any)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async getUserTicketCounts(): Promise<Record<string, { open: number; resolved: number }>> {
    const rows = await db
      .select({
        userId: users.id,
        openCount: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('open', 'in_progress') THEN 1 ELSE 0 END)`,
        resolvedCount: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END)`,
      })
      .from(users)
      .leftJoin(tickets, eq(users.id, tickets.assignedToUserId))
      .groupBy(users.id);

    const result: Record<string, { open: number; resolved: number }> = {};
    for (const row of rows) {
      result[row.userId] = { open: Number(row.openCount) || 0, resolved: Number(row.resolvedCount) || 0 };
    }
    return result;
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
    activeProjects: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    billingItemsCount: number;
    paidBillingItemsCount: number;
    overdueBillingItemsCount: number;
    projectsOnSupport: number;
    onSupportProjects: number;
    openTicketsCount: number;
    resolvedTicketsCount: number;
  }> {
    const now = new Date();
    const activeProjects = await db.select({ count: count() }).from(projects).where(eq(projects.status, "active"));
    const totalBudget = await db.select({ total: sql`SUM(${projects.budget})` }).from(projects);
    const collectedAmount = await db.select({ total: sql`SUM(${invoiceCollections.amount})` }).from(invoiceCollections);
    const pendingAmount = await db.select({ total: sql`SUM(${projects.budget}) - SUM(${invoiceCollections.amount})` }).from(projects).leftJoin(invoiceCollections, eq(projects.id, invoiceCollections.projectId));
    const billingItemsCount = await db.select({ count: count() }).from(billingItems);
    const paidBillingItemsCount = await db.select({ count: count() }).from(billingItems).where(eq(billingItems.billingStatus, 'paid'));
    const overdueBillingItemsCount = await db.select({ count: count() }).from(billingItems).where(and(
      sql`${billingItems.expectedCollectionDate} < ${now}`,
      sql`${billingItems.billingStatus} != 'paid'`
    ));
    const projectsOnSupport = await db.select({ count: count() }).from(projects).where(eq(projects.status, "on_support"));
    const openTicketsCount = await db.select({ count: count() }).from(tickets).where(inArray(tickets.status, ['open', 'in_progress']));
    const resolvedTicketsCount = await db.select({ count: count() }).from(tickets).where(inArray(tickets.status, ['resolved', 'closed']));

    return {
      activeProjects: activeProjects[0]?.count || 0,
      totalBudget: Number(totalBudget[0]?.total) || 0,
      collectedAmount: Number(collectedAmount[0]?.total) || 0,
      pendingAmount: Number(pendingAmount[0]?.total) || 0,
      billingItemsCount: billingItemsCount[0]?.count || 0,
      paidBillingItemsCount: paidBillingItemsCount[0]?.count || 0,
      overdueBillingItemsCount: overdueBillingItemsCount[0]?.count || 0,
      projectsOnSupport: projectsOnSupport[0]?.count || 0,
      onSupportProjects: projectsOnSupport[0]?.count || 0,
      openTicketsCount: openTicketsCount[0]?.count || 0,
      resolvedTicketsCount: resolvedTicketsCount[0]?.count || 0,
    };
  }

  // Companies operations
  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(asc(companies.name));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company> {
    const [updatedCompany] = await db
      .update(companies)
      .set({ ...company, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updatedCompany;
  }

  // Segments operations (dynamic, admin-managed - replaces the old segment enum)
  async getSegments(): Promise<Segment[]> {
    return await db.select().from(segments).orderBy(asc(segments.name));
  }

  async getSegment(id: string): Promise<Segment | undefined> {
    const [segment] = await db.select().from(segments).where(eq(segments.id, id));
    return segment;
  }

  async createSegment(segment: InsertSegment): Promise<Segment> {
    const [newSegment] = await db.insert(segments).values(segment).returning();
    return newSegment;
  }

  async updateSegment(id: string, segment: Partial<InsertSegment>): Promise<Segment> {
    const [updatedSegment] = await db
      .update(segments)
      .set({ ...segment, updatedAt: new Date() })
      .where(eq(segments.id, id))
      .returning();
    return updatedSegment;
  }

  async deleteSegment(id: string): Promise<void> {
    await db.delete(segments).where(eq(segments.id, id));
  }

  // Service categories operations
  async getServiceCategories(): Promise<ServiceCategory[]> {
    return await db.select().from(serviceCategories).orderBy(asc(serviceCategories.name));
  }

  async getServiceCategory(id: string): Promise<ServiceCategory | undefined> {
    const [category] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, id));
    return category;
  }

  async createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory> {
    const [newCategory] = await db.insert(serviceCategories).values(category).returning();
    return newCategory;
  }

  async updateServiceCategory(id: string, category: Partial<InsertServiceCategory>): Promise<ServiceCategory> {
    const [updatedCategory] = await db
      .update(serviceCategories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(serviceCategories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteServiceCategory(id: string): Promise<void> {
    await db.delete(serviceCategories).where(eq(serviceCategories.id, id));
  }

  // Ticket operations
  async getTickets(filter: { createdByUserId?: string; assignedToUserId?: string; types?: string[] }): Promise<any[]> {
    const conditions: any[] = [];
    if (filter.createdByUserId) conditions.push(eq(tickets.createdByUserId, filter.createdByUserId));
    if (filter.assignedToUserId) conditions.push(eq(tickets.assignedToUserId, filter.assignedToUserId));
    if (filter.types && filter.types.length > 0) conditions.push(inArray(tickets.type, filter.types as any));

    const createdByUsers = users;
    let query = db
      .select({
        ticket: tickets,
        project: projects,
        company: companies,
        category: serviceCategories,
        assignedTo: {
          id: sql`assigned_to_user.id`,
          firstName: sql`assigned_to_user.first_name`,
          lastName: sql`assigned_to_user.last_name`,
          email: sql`assigned_to_user.email`,
        },
        createdBy: {
          id: sql`created_by_user.id`,
          firstName: sql`created_by_user.first_name`,
          lastName: sql`created_by_user.last_name`,
          email: sql`created_by_user.email`,
        },
      })
      .from(tickets)
      .leftJoin(projects, eq(tickets.projectId, projects.id))
      .leftJoin(companies, eq(tickets.companyId, companies.id))
      .leftJoin(serviceCategories, eq(tickets.categoryId, serviceCategories.id))
      .leftJoin(sql`${users} as assigned_to_user`, eq(tickets.assignedToUserId, sql`assigned_to_user.id`))
      .leftJoin(sql`${users} as created_by_user`, eq(tickets.createdByUserId, sql`created_by_user.id`)) as any;

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    query = query.orderBy(desc(tickets.createdAt));

    const rows = await query;
    return rows.map((row: any) => ({
      ...row.ticket,
      project: row.project,
      company: row.company,
      category: row.category,
      assignedTo: row.assignedTo?.id ? row.assignedTo : null,
      createdBy: row.createdBy?.id ? row.createdBy : null,
    }));
  }

  async getTicket(id: string): Promise<any | undefined> {
    const [row] = await db
      .select({
        ticket: tickets,
        project: projects,
        company: companies,
        category: serviceCategories,
        assignedTo: {
          id: sql`assigned_to_user.id`,
          firstName: sql`assigned_to_user.first_name`,
          lastName: sql`assigned_to_user.last_name`,
          email: sql`assigned_to_user.email`,
        },
        createdBy: {
          id: sql`created_by_user.id`,
          firstName: sql`created_by_user.first_name`,
          lastName: sql`created_by_user.last_name`,
          email: sql`created_by_user.email`,
        },
      })
      .from(tickets)
      .leftJoin(projects, eq(tickets.projectId, projects.id))
      .leftJoin(companies, eq(tickets.companyId, companies.id))
      .leftJoin(serviceCategories, eq(tickets.categoryId, serviceCategories.id))
      .leftJoin(sql`${users} as assigned_to_user`, eq(tickets.assignedToUserId, sql`assigned_to_user.id`))
      .leftJoin(sql`${users} as created_by_user`, eq(tickets.createdByUserId, sql`created_by_user.id`))
      .where(eq(tickets.id, id));

    if (!row) return undefined;
    return {
      ...row.ticket,
      project: row.project,
      company: row.company,
      category: row.category,
      assignedTo: (row.assignedTo as any)?.id ? row.assignedTo : null,
      createdBy: (row.createdBy as any)?.id ? row.createdBy : null,
    };
  }

  async getTicketCount(): Promise<number> {
    const [row] = await db.select({ count: count() }).from(tickets);
    return row?.count || 0;
  }

  async createTicket(ticket: InsertTicket & { ticketNumber: string }): Promise<Ticket> {
    const [newTicket] = await db.insert(tickets).values(ticket as any).returning();
    return newTicket;
  }

  async assignTicket(id: string, assignedToUserId: string | null, assignedTeamId?: string | null): Promise<Ticket> {
    const [updatedTicket] = await db
      .update(tickets)
      .set({ assignedToUserId, assignedTeamId, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    return updatedTicket;
  }

  async updateTicketStatus(id: string, status: string, resolution?: { rootCause: string; resolutionNotes: string }): Promise<Ticket> {
    const updates: any = { status, updatedAt: new Date() };
    if (status === 'resolved' || status === 'closed') {
      updates.resolvedAt = new Date();
    }
    if (resolution) {
      updates.rootCause = resolution.rootCause;
      updates.resolutionNotes = resolution.resolutionNotes;
    }
    const [updatedTicket] = await db
      .update(tickets)
      .set(updates)
      .where(eq(tickets.id, id))
      .returning();
    return updatedTicket;
  }

  async recordTicketEscalation(id: string, data: { escalatedToUserId: string; escalatedFromUserId: string; reason: string }): Promise<Ticket> {
    const [updatedTicket] = await db
      .update(tickets)
      .set({
        assignedToUserId: data.escalatedToUserId,
        escalatedFromUserId: data.escalatedFromUserId,
        escalationReason: data.reason,
        escalatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, id))
      .returning();
    return updatedTicket;
  }

  async getTicketComments(ticketId: string): Promise<(TicketComment & { user: User })[]> {
    const rows = await db
      .select({ comment: ticketComments, user: users })
      .from(ticketComments)
      .leftJoin(users, eq(ticketComments.userId, users.id))
      .where(eq(ticketComments.ticketId, ticketId))
      .orderBy(asc(ticketComments.createdAt));
    return rows.map((row: any) => ({ ...row.comment, user: row.user }));
  }

  async addTicketComment(comment: InsertTicketComment): Promise<TicketComment> {
    const [newComment] = await db.insert(ticketComments).values(comment).returning();
    return newComment;
  }

  // Dynamic RBAC: roles & permissions operations
  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(asc(roles.name));
  }

  async getRole(id: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }

  async createRole(role: InsertRole): Promise<Role> {
    const [newRole] = await db.insert(roles).values(role).returning();
    return newRole;
  }

  async updateRole(id: string, role: Partial<InsertRole>): Promise<Role> {
    const [updatedRole] = await db
      .update(roles)
      .set({ ...role, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return updatedRole;
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.getRole(id);
    if (!role) {
      throw new Error('Role not found');
    }
    if (role.isSystem) {
      throw new Error('System roles cannot be deleted');
    }
    await db.delete(roles).where(eq(roles.id, id));
  }

  async getPermissions(): Promise<Permission[]> {
    return await db.select().from(permissions).orderBy(asc(permissions.category), asc(permissions.label));
  }

  async getRolePermissionIds(roleId: string): Promise<string[]> {
    const rows = await db
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
    return rows.map((r) => r.permissionId);
  }

  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (permissionIds.length > 0) {
      await db.insert(rolePermissions).values(permissionIds.map((permissionId) => ({ roleId, permissionId })));
    }
  }

  async assignUserRole(userId: string, roleId: string | null): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ roleId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  // Team operations
  async getTeams(): Promise<(Team & { projects: Project[]; sector: Segment | null })[]> {
    const result = await db
      .select({
        team: teams,
        project: projects,
        sector: segments,
      })
      .from(teams)
      .leftJoin(projects, eq(teams.id, projects.teamId))
      .leftJoin(segments, eq(teams.sectorId, segments.id))
      .orderBy(asc(teams.name));

    // Group projects by team
    const teamMap = new Map<string, Team & { projects: Project[]; sector: Segment | null }>();

    result.forEach(row => {
      if (!teamMap.has(row.team.id)) {
        teamMap.set(row.team.id, {
          ...row.team,
          projects: [],
          sector: row.sector ?? null,
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
    
    // Calculate workload for each member, based on tickets assigned to them
    // (subtask-based workload no longer applies - subtasks/modules were removed)
    const membersWithWorkload = await Promise.all(
      members.map(async (member) => {
        const totalTasksResult = await db
          .select({ count: count() })
          .from(tickets)
          .where(eq(tickets.assignedToUserId, member.userId));

        const totalTasks = Number(totalTasksResult[0]?.count || 0);

        const completedTasksResult = await db
          .select({ count: count() })
          .from(tickets)
          .where(
            and(
              eq(tickets.assignedToUserId, member.userId),
              inArray(tickets.status, ['resolved', 'closed'])
            )
          );

        const completedTasks = Number(completedTasksResult[0]?.count || 0);

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

    // Calculate total tickets assigned to team members
    const totalTasks = membersWithWorkload.reduce((sum, m) => sum + m.totalTasks, 0);
    
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
    billingItemCount: number;
    paidBillingItemCount: number;
    paidAmount: number;
    totalFees: number;
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

    // Step 2: aggregate billing items per project
    const aggRows = await db
      .select({
        projectId: billingItems.projectId,
        billingItemCount: count(billingItems.id),
        paidBillingItemCount: sql<number>`SUM(CASE WHEN ${billingItems.billingStatus} = 'paid' THEN 1 ELSE 0 END)`,
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${billingItems.billingStatus} = 'paid' THEN ${billingItems.feeAmount} ELSE 0 END), 0)`,
        totalFees: sql<number>`COALESCE(SUM(${billingItems.feeAmount}), 0)`,
      })
      .from(billingItems)
      .where(inArray(billingItems.projectId, projectIds))
      .groupBy(billingItems.projectId);

    const projectIdToAgg: Record<string, { billingItemCount: number; paidBillingItemCount: number; paidAmount: number; totalFees: number }> = {};
    for (const row of aggRows) {
      projectIdToAgg[row.projectId] = {
        billingItemCount: Number(row.billingItemCount || 0),
        paidBillingItemCount: Number(row.paidBillingItemCount || 0),
        paidAmount: Number(row.paidAmount || 0),
        totalFees: Number(row.totalFees || 0),
      };
    }

    // Step 3: merge
    return baseRows.map(r => {
      const agg = projectIdToAgg[r.project.id] || { billingItemCount: 0, paidBillingItemCount: 0, paidAmount: 0, totalFees: 0 };
      return {
        ...r.project,
        manager: r.manager!,
        team: r.team ?? null,
        billingItemCount: agg.billingItemCount,
        paidBillingItemCount: agg.paidBillingItemCount,
        paidAmount: agg.paidAmount,
        totalFees: agg.totalFees,
      };
    });
  }

  async getProjectsPaginated(page: number = 1, limit: number = 20): Promise<{
    data: (Project & { manager: User; team: Team | null; billingItemCount: number; paidBillingItemCount: number; paidAmount: number; totalFees: number })[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const [totalCount] = await db.select({ count: count() }).from(projects);
    
    // Step 1: fetch base projects with manager and team (paginated)
    const baseRows = await db
      .select({
        project: projects,
        manager: users,
        team: teams,
      })
      .from(projects)
      .leftJoin(users, eq(projects.managerId, users.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .orderBy(desc(projects.createdAt))
      .limit(limit)
      .offset(offset);

    const projectIds = baseRows.map(r => r.project.id);
    if (projectIds.length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: totalCount.count,
          totalPages: Math.ceil(totalCount.count / limit)
        }
      };
    }

    // Step 2: aggregate billing items per project
    const aggRows = await db
      .select({
        projectId: billingItems.projectId,
        billingItemCount: count(billingItems.id),
        paidBillingItemCount: sql<number>`SUM(CASE WHEN ${billingItems.billingStatus} = 'paid' THEN 1 ELSE 0 END)`,
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${billingItems.billingStatus} = 'paid' THEN ${billingItems.feeAmount} ELSE 0 END), 0)`,
        totalFees: sql<number>`COALESCE(SUM(${billingItems.feeAmount}), 0)`,
      })
      .from(billingItems)
      .where(inArray(billingItems.projectId, projectIds))
      .groupBy(billingItems.projectId);

    const projectIdToAgg: Record<string, { billingItemCount: number; paidBillingItemCount: number; paidAmount: number; totalFees: number }> = {};
    for (const row of aggRows) {
      projectIdToAgg[row.projectId] = {
        billingItemCount: Number(row.billingItemCount || 0),
        paidBillingItemCount: Number(row.paidBillingItemCount || 0),
        paidAmount: Number(row.paidAmount || 0),
        totalFees: Number(row.totalFees || 0),
      };
    }

    // Step 3: merge
    const data = baseRows.map(r => {
      const agg = projectIdToAgg[r.project.id] || { billingItemCount: 0, paidBillingItemCount: 0, paidAmount: 0, totalFees: 0 };
      return {
        ...r.project,
        manager: r.manager!,
        team: r.team ?? null,
        billingItemCount: agg.billingItemCount,
        paidBillingItemCount: agg.paidBillingItemCount,
        paidAmount: agg.paidAmount,
        totalFees: agg.totalFees,
      };
    });

    const total = totalCount.count;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  async getProjectsForUser(userId: string): Promise<(Project & { manager: User; team: Team | null; billingItemCount: number; paidBillingItemCount: number; paidAmount: number; totalFees: number })[]> {
    // Get unique project IDs that the user has access to (team membership, or tickets assigned to them)
    const userProjectIds = new Set<string>();

    const byMembership = await db
      .select({ projectId: projects.id })
      .from(projects)
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId));

    byMembership.forEach(r => {
      if (r.projectId) userProjectIds.add(r.projectId);
    });

    const byTickets = await db
      .select({ projectId: tickets.projectId })
      .from(tickets)
      .where(eq(tickets.assignedToUserId, userId));

    byTickets.forEach(r => {
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
        projectId: billingItems.projectId,
        billingItemCount: count(billingItems.id),
        paidBillingItemCount: sql<number>`SUM(CASE WHEN ${billingItems.billingStatus} = 'paid' THEN 1 ELSE 0 END)`,
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${billingItems.billingStatus} = 'paid' THEN ${billingItems.feeAmount} ELSE 0 END), 0)`,
        totalFees: sql<number>`COALESCE(SUM(${billingItems.feeAmount}), 0)`,
      })
      .from(billingItems)
      .where(inArray(billingItems.projectId, projectIds))
      .groupBy(billingItems.projectId);

    const projectIdToAgg: Record<string, { billingItemCount: number; paidBillingItemCount: number; paidAmount: number; totalFees: number }> = {};
    for (const row of aggRows) {
      projectIdToAgg[row.projectId] = {
        billingItemCount: Number(row.billingItemCount || 0),
        paidBillingItemCount: Number(row.paidBillingItemCount || 0),
        paidAmount: Number(row.paidAmount || 0),
        totalFees: Number(row.totalFees || 0),
      };
    }

    return baseRows.map(r => {
      const agg = projectIdToAgg[r.project.id] || { billingItemCount: 0, paidBillingItemCount: 0, paidAmount: 0, totalFees: 0 };
      return {
        ...r.project,
        manager: r.manager!,
        team: r.team ?? null,
        billingItemCount: agg.billingItemCount,
        paidBillingItemCount: agg.paidBillingItemCount,
        paidAmount: agg.paidAmount,
        totalFees: agg.totalFees,
      };
    });
  }

  async getProject(id: string): Promise<(Project & { manager: User; team: Team | null; company: Company | null }) | undefined> {
    const projectData = await db
      .select()
      .from(projects)
      .leftJoin(users, eq(projects.managerId, users.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .leftJoin(companies, eq(projects.companyId, companies.id))
      .where(eq(projects.id, id));

    if (!projectData.length) return undefined;

    return {
      ...projectData[0].projects,
      manager: projectData[0].users!,
      team: projectData[0].teams,
      company: projectData[0].companies
    };
  }

  async createProject(project: InsertProject): Promise<Project> {
    // Set budget to 0 initially - it will be calculated from billing item fees
    const projectData = { ...project, budget: "0" };
    const [newProject] = await db.insert(projects).values(projectData as any).returning();

    // Recalculate budget from billing item fees if any exist
    await this.recalculateProjectBudget(newProject.id);

    return newProject;
  }

  async updateProject(id: string, project: Partial<InsertProject>): Promise<Project> {
    // Get existing project to detect changes
    const existingProject = await this.getProject(id);

    // Remove budget from update if it exists - budget is auto-calculated from billing items
    const { budget, ...projectData } = project;
    
    const [updatedProject] = await db
      .update(projects)
      .set({ ...projectData, updatedAt: new Date() } as any)
      .where(eq(projects.id, id))
      .returning();
    
    // Recalculate budget from milestone fees
    await this.recalculateProjectBudget(id);
    
    // Check if manager changed and invalidate performance cache
    if (existingProject && project.managerId && existingProject.managerId !== project.managerId) {
      console.log(`Manager changed for project ${id}: ${existingProject.managerId} -> ${project.managerId}`);
      await this.invalidateTeamPerformanceCache();
    }
    
    // Check if team changed and invalidate workload cache
    if (existingProject && project.teamId && existingProject.teamId !== project.teamId) {
      console.log(`Team changed for project ${id}: ${existingProject.teamId} -> ${project.teamId}`);
      await this.invalidateTeamPerformanceCache();
    }
    
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

  async closeProjectSupport(id: string): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({ status: 'support_closed' as const, updatedAt: new Date() } as any)
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async updateProjectProgress(id: string): Promise<void> {
    // Progress is now derived from billing items paid ratio (work-item/module-based
    // progress no longer applies - modules/subtasks were removed).
    const items = await db
      .select()
      .from(billingItems)
      .where(eq(billingItems.projectId, id));

    if (items.length === 0) {
      await db.update(projects).set({ progress: 0 } as any).where(eq(projects.id, id));
      return;
    }

    const paidCount = items.filter(i => i.billingStatus === 'paid').length;
    const progress = Math.round((paidCount / items.length) * 100);

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

  async getProjectsBySegment(segmentId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.segmentId, segmentId))
      .orderBy(desc(projects.createdAt));
  }

  // Invoice and reporting operations
    async getInvoiceReport(year: number, month?: number): Promise<any> {
    try {
      // Dynamic, admin-managed segments (replaces the old academic/parastals/private enum)
      const segs = await this.getSegments();

      // SIMPLE LOGIC: Get revenue based on billing status, not due dates

      // 1. Expected Revenue: Sum of all milestone fees for the year
      const expectedRevenue = await db
        .select({
          segmentId: projects.segmentId,
          totalAmount: sql<number>`COALESCE(SUM(${billingItems.feeAmount}), 0)`
        })
        .from(billingItems)
        .innerJoin(projects, eq(billingItems.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${billingItems.expectedInvoiceDate}) = ${year}`,
            sql`${billingItems.feeAmount} IS NOT NULL AND ${billingItems.feeAmount} > 0`
          )
        )
        .groupBy(projects.segmentId)
        .execute();



      // 2. Invoice Sent Revenue: Sum of fees for billingItems with billing_status = 'sent'
      const invoiceSentRevenue = await db
        .select({
          segmentId: projects.segmentId,
          totalAmount: sql<number>`COALESCE(SUM(${billingItems.feeAmount}), 0)`
        })
        .from(billingItems)
        .innerJoin(projects, eq(billingItems.projectId, projects.id))
        .where(
          and(
            eq(billingItems.billingStatus, 'sent'),
            sql`${billingItems.feeAmount} IS NOT NULL AND ${billingItems.feeAmount} > 0`
          )
        )
        .groupBy(projects.segmentId)
        .execute();



      // 3. Collected Revenue: Sum of fees for billingItems with billing_status = 'paid'
      const collectedRevenue = await db
        .select({
          segmentId: projects.segmentId,
          totalAmount: sql<number>`COALESCE(SUM(${billingItems.feeAmount}), 0)`
        })
        .from(billingItems)
        .innerJoin(projects, eq(billingItems.projectId, projects.id))
        .where(
          and(
            eq(billingItems.billingStatus, 'paid'),
            sql`${billingItems.feeAmount} IS NOT NULL AND ${billingItems.feeAmount} > 0`
          )
        )
        .groupBy(projects.segmentId)
        .execute();



      // Calculate totals by segment
      const expectedBySegment: Record<string, number> = {};
      const sentBySegment: Record<string, number> = {};
      const paidBySegment: Record<string, number> = {};

      segs.forEach(seg => {
        expectedBySegment[seg.id] = Number(expectedRevenue.find(r => r.segmentId === seg.id)?.totalAmount || 0);
        sentBySegment[seg.id] = Number(invoiceSentRevenue.find(r => r.segmentId === seg.id)?.totalAmount || 0);
        paidBySegment[seg.id] = Number(collectedRevenue.find(r => r.segmentId === seg.id)?.totalAmount || 0);
      });

      // Calculate overall totals - FIXED: Convert to numbers before summing
      const totalExpected: number = (Object.values(expectedBySegment) as any[]).reduce((sum: number, amount: any) => sum + Number(amount || 0), 0);
      const totalSent: number = (Object.values(sentBySegment) as any[]).reduce((sum: number, amount: any) => sum + Number(amount || 0), 0);
      const totalPaid: number = (Object.values(paidBySegment) as any[]).reduce((sum: number, amount: any) => sum + Number(amount || 0), 0);

      // Monthly trend with REAL data (12 months) - FIXED: Show actual monthly performance
      const monthlyTrend = [];
      for (let m = 1; m <= 12; m++) {
        const buildSegmentFields = () => {
          const fields: Record<string, any> = {
            total: sql<number>`COALESCE(SUM(${billingItems.feeAmount}), 0)`
          };
          for (const seg of segs) {
            fields[seg.id] = sql<number>`COALESCE(SUM(CASE WHEN ${projects.segmentId} = ${seg.id} THEN ${billingItems.feeAmount} ELSE 0 END), 0)`;
          }
          return fields;
        };

        // Get ALL billingItems due in this month (regardless of completion status)
        const monthExpected = await db
          .select(buildSegmentFields())
          .from(billingItems)
          .innerJoin(projects, eq(billingItems.projectId, projects.id))
          .where(
            and(
              sql`EXTRACT(YEAR FROM ${billingItems.expectedInvoiceDate}) = ${year}`,
              sql`EXTRACT(MONTH FROM ${billingItems.expectedInvoiceDate}) = ${m}`,
              sql`${billingItems.feeAmount} IS NOT NULL AND ${billingItems.feeAmount} > 0`
              // NO status filter - include ALL billingItems for the month
            )
          )
          .execute();

        // Get billingItems due this month with 'sent' billing status
        const monthSent = await db
          .select(buildSegmentFields())
          .from(billingItems)
          .innerJoin(projects, eq(billingItems.projectId, projects.id))
          .where(
            and(
              sql`EXTRACT(YEAR FROM ${billingItems.expectedInvoiceDate}) = ${year}`,
              sql`EXTRACT(MONTH FROM ${billingItems.expectedInvoiceDate}) = ${m}`,
              eq(billingItems.billingStatus, 'sent'),
              sql`${billingItems.feeAmount} IS NOT NULL AND ${billingItems.feeAmount} > 0`
              // NO status filter - include ALL billingItems for the month
            )
          )
          .execute();

        // Get billingItems due this month with 'paid' billing status
        const monthPaid = await db
          .select(buildSegmentFields())
          .from(billingItems)
          .innerJoin(projects, eq(billingItems.projectId, projects.id))
          .where(
            and(
              sql`EXTRACT(YEAR FROM ${billingItems.expectedInvoiceDate}) = ${year}`,
              sql`EXTRACT(MONTH FROM ${billingItems.expectedInvoiceDate}) = ${m}`,
              eq(billingItems.billingStatus, 'paid'),
              sql`${billingItems.feeAmount} IS NOT NULL AND ${billingItems.feeAmount} > 0`
              // NO status filter - include ALL billingItems for the month
            )
          )
          .execute();

          const monthEntry: Record<string, any> = {
            month: new Date(year, m - 1).toLocaleDateString('en-US', { month: 'long' }),
            expected: Number((monthExpected[0] as any)?.total || 0), // Total billingItems due this month
            sent: Number((monthSent[0] as any)?.total || 0),         // Milestones due this month with 'sent' status
            paid: Number((monthPaid[0] as any)?.total || 0),         // Milestones due this month with 'paid' status
          };
          // Segment breakdowns based on due dates (not completion dates)
          for (const seg of segs) {
            monthEntry[seg.id] = Number((monthExpected[0] as any)?.[seg.id] || 0);
          }
          monthlyTrend.push(monthEntry);
      }

      const result = {
        year,
        month,
        monthlyTargets: {
          ...Object.fromEntries(segs.map(seg => [seg.id, expectedBySegment[seg.id] || 0])),
          total: totalExpected
        },
        invoiceSent: {
          ...Object.fromEntries(segs.map(seg => [seg.id, sentBySegment[seg.id] || 0])),
          total: totalSent
        },
        actualCollections: {
          ...Object.fromEntries(segs.map(seg => [seg.id, paidBySegment[seg.id] || 0])),
          total: totalPaid
        },
        segmentBreakdown: segs.map(seg => ({
          segment: seg.name,
          expected: expectedBySegment[seg.id] || 0,
          sent: sentBySegment[seg.id] || 0,
          paid: paidBySegment[seg.id] || 0,
          percentage: (expectedBySegment[seg.id] || 0) > 0 ?
            Math.round(((paidBySegment[seg.id] || 0) / (expectedBySegment[seg.id] || 0)) * 100) : 0,
          billingItems: [] // Simplified for now
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
      const segs = await this.getSegments();
      const billingItemsByMonth = await db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${billingItems.expectedInvoiceDate})`,
          segmentId: projects.segmentId,
          totalFees: sql<number>`COALESCE(SUM(${billingItems.feeAmount}), 0)`,
          milestoneCount: sql<number>`COUNT(${billingItems.id})`
        })
        .from(billingItems)
        .innerJoin(projects, eq(billingItems.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${billingItems.expectedInvoiceDate}) = ${year}`,
            sql`${billingItems.feeAmount} IS NOT NULL AND ${billingItems.feeAmount} > 0`
          )
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${billingItems.expectedInvoiceDate})`, projects.segmentId)
        .execute();

      // Convert to monthly targets format
      const targets: any[] = [];
      for (let month = 1; month <= 12; month++) {
        segs.forEach(seg => {
          const monthData = billingItemsByMonth.find(m =>
            Number(m.month) === month && m.segmentId === seg.id
          );

          // Convert fees to numbers and sum them properly
          const targetAmount = monthData?.totalFees ? Number(monthData.totalFees) : 0;

          targets.push({
            year,
            month,
            segment: seg.id,
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
      // NOTE: monthlyTargets.segment is still the legacy academic/parastals/private
      // enum (out of scope for the dynamic-segments migration), while projects now
      // only carries segmentId. We join on segmentId and only persist rows whose
      // segment NAME still matches one of the three legacy enum values - segments
      // created later under new names simply won't have monthly targets rows until
      // that legacy enum is migrated in a future phase.
      const legacySegmentNames: Array<'academic' | 'parastals' | 'private'> = ['academic', 'parastals', 'private'];
      const segs = await this.getSegments();
      const segmentIdToLegacyName = new Map<string, 'academic' | 'parastals' | 'private'>();
      for (const seg of segs) {
        const lower = seg.name.trim().toLowerCase();
        if ((legacySegmentNames as string[]).includes(lower)) {
          segmentIdToLegacyName.set(seg.id, lower as 'academic' | 'parastals' | 'private');
        }
      }

      const billingItemsByMonth = await db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${billingItems.expectedInvoiceDate})`,
          segmentId: projects.segmentId,
          totalFees: sql<number>`COALESCE(SUM(${billingItems.feeAmount}), 0)`,
          milestoneCount: sql<number>`COUNT(${billingItems.id})`
        })
        .from(billingItems)
        .innerJoin(projects, eq(billingItems.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${billingItems.expectedInvoiceDate}) = ${year}`,
            sql`${billingItems.feeAmount} IS NOT NULL AND ${billingItems.feeAmount} > 0`
          )
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${billingItems.expectedInvoiceDate})`, projects.segmentId)
        .execute();

      // Calculate actual amounts for each month/segment - COUNT REVENUE WHEN SENT, NOT WHEN DONE
      const actualsByMonth = await db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${billingItems.invoiceSentAt})`, // Use invoiceSentAt for billing
          segmentId: projects.segmentId,
          actualAmount: sql<number>`COALESCE(SUM(${billingItems.feeAmount}), 0)`
        })
        .from(billingItems)
        .innerJoin(projects, eq(billingItems.projectId, projects.id))
        .where(
          and(
            sql`EXTRACT(YEAR FROM ${billingItems.invoiceSentAt}) = ${year}`, // Use invoiceSentAt for billing
            eq(billingItems.billingStatus, 'sent'), // Changed from 'done' to 'sent' - count revenue when invoice sent
            sql`${billingItems.feeAmount} IS NOT NULL AND ${billingItems.feeAmount} > 0`
          )
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${billingItems.invoiceSentAt})`, projects.segmentId)
        .execute();

      // Delete existing targets for this year
      await db
        .delete(monthlyTargets)
        .where(eq(monthlyTargets.year, year))
        .execute();

      // Insert new calculated targets
      const targetsToInsert = [];
      for (let month = 1; month <= 12; month++) {
        for (const [segmentId, segment] of Array.from(segmentIdToLegacyName.entries())) {
          const milestoneData = billingItemsByMonth.find(m =>
            m.month === month && m.segmentId === segmentId
          );
          const actualData = actualsByMonth.find(a =>
            a.month === month && a.segmentId === segmentId
          );

          if (milestoneData || actualData) {
                      targetsToInsert.push({
            year,
            month,
            segment,
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
    // Get all billingItems for this project
    const projectMilestones = await db
      .select()
      .from(billingItems)
      .where(eq(billingItems.projectId, projectId));

    // Calculate total from milestone fees
    const total = projectMilestones.reduce((sum, milestone) => {
      return sum + parseFloat(milestone.feeAmount || '0');
    }, 0);

    // Update project budget
    await db.update(projects).set({ budget: String(total) } as any).where(eq(projects.id, projectId));
  }

  async invalidateTeamPerformanceCache(): Promise<void> {
    // This method will be called when assignments change to ensure fresh data
    // For now, we'll add logging to track when cache invalidation is needed
    console.log('Team performance cache invalidated - fresh data will be calculated on next request');
    
    // In a production system, this would:
    // 1. Clear Redis cache keys for team performance
    // 2. Mark cached data as stale
    // 3. Trigger background recalculation
    
    // For immediate effect, we could recalculate metrics here
    // but that might be expensive for large datasets
  }

  async updateProjectStatusBasedOnBillingItems(projectId: string): Promise<void> {
    // Get project and its billing items
    const project = await this.getProject(projectId);
    if (!project) return;

    const projectBillingItems = await this.getBillingItemsByProject(projectId);

    if (projectBillingItems.length === 0) {
      // No billing items, keep as planning
      return;
    }

    const totalBillingItems = projectBillingItems.length;
    const paidBillingItems = projectBillingItems.filter(m => m.billingStatus === 'paid').length;

    let newStatus = project.status; // Keep current status by default

    // Automatic status logic based on billing item status
    if (paidBillingItems === totalBillingItems && totalBillingItems > 0) {
      // All billing items are paid - move to on_support (SLA)
      newStatus = 'on_support';
    } else if (paidBillingItems > 0) {
      // At least one billing item is paid
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

      // Log the automatic status change
      try {
        const { auditService } = await import('./services/comprehensiveAuditService');
        await auditService.logSystemOperation(
          'status_update',
          'project',
          projectId,
          project.name,
          {
            oldStatus: project.status,
            newStatus: newStatus,
            reason: 'automatic_billing_item_based_update',
            billingItemCount: totalBillingItems,
            paidBillingItems: paidBillingItems
          }
        );
      } catch (error) {
        console.error('Error logging project status change:', error);
      }
    }
  }

  async getDashboardMetricsForUser(userId: string): Promise<{
    totalTeamProjects: number;
    activeTeamProjects: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    billingItemsCount: number;
    openTicketsCount: number;
    resolvedTicketsCount: number;
  }> {
    // Get user's team IDs
    const memberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));
    const teamIds = memberships.map((m) => m.teamId);

    let totalTeamProjects = 0;
    let activeTeamProjects = 0;
    let totalBudget = 0;
    let collectedAmount = 0;
    let pendingAmount = 0;

    if (teamIds.length > 0) {
      const teamProjects = await db
        .select({ id: projects.id, status: projects.status, budget: projects.budget })
        .from(projects)
        .where(inArray(projects.teamId, teamIds));

      totalTeamProjects = teamProjects.length;
      activeTeamProjects = teamProjects.filter(p => p.status === 'active').length;
      totalBudget = teamProjects.reduce((sum, p) => sum + Number(p.budget || 0), 0);

      const projectIds = teamProjects.map(p => p.id);
      if (projectIds.length > 0) {
        const [collected] = await db
          .select({ total: sql<number>`COALESCE(SUM(${invoiceCollections.amount}), 0)` })
          .from(invoiceCollections)
          .where(inArray(invoiceCollections.projectId, projectIds));
        collectedAmount = Number(collected?.total || 0);
        pendingAmount = totalBudget - collectedAmount;
      }
    }

    const [billingItemsCountResult] = teamIds.length > 0 ?
      await db
        .select({ count: count() })
        .from(billingItems)
        .leftJoin(projects, eq(billingItems.projectId, projects.id))
        .where(inArray(projects.teamId, teamIds)) :
      [{ count: 0 }];

    const [openTicketsResult] = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(eq(tickets.assignedToUserId, userId), inArray(tickets.status, ['open', 'in_progress'])));
    const [resolvedTicketsResult] = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(eq(tickets.assignedToUserId, userId), inArray(tickets.status, ['resolved', 'closed'])));

    return {
      totalTeamProjects,
      activeTeamProjects,
      totalBudget,
      collectedAmount,
      pendingAmount,
      billingItemsCount: billingItemsCountResult.count,
      openTicketsCount: openTicketsResult?.count || 0,
      resolvedTicketsCount: resolvedTicketsResult?.count || 0,
    };
  }

  async getDashboardMetricsForSegment(segment: string): Promise<{
    activeProjects: number;
    totalBudget: number;
    collectedAmount: number;
    pendingAmount: number;
    billingItemsCount: number;
    paidBillingItemsCount: number;
    overdueBillingItemsCount: number;
    projectsOnSupport: number;
    onSupportProjects: number;
    openTicketsCount: number;
    resolvedTicketsCount: number;
  }> {
    const now = new Date();
    // `segment` here is the legacy academic/parastals/private name (it comes from
    // users.assignedSegment, which is out of scope for the dynamic-segments migration -
    // see the note in calculateMonthlyTargets above). Resolve it to the matching dynamic
    // segment's id so we can filter projects.segmentId. If no segment row matches that
    // legacy name yet, every count below is correctly zero rather than throwing.
    const allSegments = await this.getSegments();
    const matchingSegment = allSegments.find(s => s.name.trim().toLowerCase() === segment.trim().toLowerCase());
    const segmentId = matchingSegment?.id ?? '__no_match__';

    const [activeProjectsResult] = await db
      .select({ count: count() })
      .from(projects)
      .where(and(
        eq(projects.status, 'active'),
        eq(projects.segmentId, segmentId)
      ));

    const segmentProjects = await db
      .select({ id: projects.id, budget: projects.budget })
      .from(projects)
      .where(and(
        eq(projects.status, 'active'),
        eq(projects.segmentId, segmentId)
      ));

    const totalBudget = segmentProjects
      .map(p => Number(p.budget) || 0)
      .reduce((acc: number, curr: number) => acc + curr, 0);

    let collectedAmount = 0;
    const projectIds = segmentProjects.map(p => p.id);
    if (projectIds.length > 0) {
      const [collected] = await db
        .select({ total: sql<number>`COALESCE(SUM(${invoiceCollections.amount}), 0)` })
        .from(invoiceCollections)
        .where(inArray(invoiceCollections.projectId, projectIds));
      collectedAmount = Number(collected?.total || 0);
    }

    const [billingItemsCountResult] = await db
      .select({ count: count() })
      .from(billingItems)
      .leftJoin(projects, eq(billingItems.projectId, projects.id))
      .where(eq(projects.segmentId, segmentId));

    const [paidBillingItemsCountResult] = await db
      .select({ count: count() })
      .from(billingItems)
      .leftJoin(projects, eq(billingItems.projectId, projects.id))
      .where(and(
        eq(projects.segmentId, segmentId),
        eq(billingItems.billingStatus, 'paid')
      ));

    const [overdueBillingItemsCountResult] = await db
      .select({ count: count() })
      .from(billingItems)
      .leftJoin(projects, eq(billingItems.projectId, projects.id))
      .where(and(
        eq(projects.segmentId, segmentId),
        sql`${billingItems.expectedCollectionDate} < ${now}`,
        sql`${billingItems.billingStatus} != 'paid'`
      ));

    const [onSupportProjectsResult] = await db
      .select({ count: count() })
      .from(projects)
      .where(and(
        eq(projects.status, 'on_support'),
        eq(projects.segmentId, segmentId)
      ));

    const [openTicketsResult] = await db
      .select({ count: count() })
      .from(tickets)
      .leftJoin(projects, eq(tickets.projectId, projects.id))
      .where(and(eq(projects.segmentId, segmentId), inArray(tickets.status, ['open', 'in_progress'])));
    const [resolvedTicketsResult] = await db
      .select({ count: count() })
      .from(tickets)
      .leftJoin(projects, eq(tickets.projectId, projects.id))
      .where(and(eq(projects.segmentId, segmentId), inArray(tickets.status, ['resolved', 'closed'])));

    return {
      activeProjects: activeProjectsResult.count,
      totalBudget,
      collectedAmount,
      pendingAmount: totalBudget - collectedAmount,
      billingItemsCount: billingItemsCountResult.count,
      paidBillingItemsCount: paidBillingItemsCountResult.count,
      overdueBillingItemsCount: overdueBillingItemsCountResult.count,
      projectsOnSupport: onSupportProjectsResult.count,
      onSupportProjects: onSupportProjectsResult.count,
      openTicketsCount: openTicketsResult?.count || 0,
      resolvedTicketsCount: resolvedTicketsResult?.count || 0,
    };
  }

  async getTeamWorkload(): Promise<{
    userId: string;
    user: User;
    totalTasks: number;
    completedTasks: number;
    workloadPercentage: number;
  }[]> {
    // Workload is based on ticket assignment (modules/subtasks were removed)
    const workloadData = await db
      .select({
        userId: users.id,
        user: users,
        totalTasks: count(tickets.id),
        completedTasks: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END)`,
      })
      .from(users)
      .leftJoin(tickets, eq(users.id, tickets.assignedToUserId))
      .groupBy(users.id)
      .having(sql`COUNT(${tickets.id}) > 0`);

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

    // Workload for users who are in these teams, counting tickets assigned to them
    const workloadData = await db
      .select({
        userId: users.id,
        user: users,
        totalTasks: count(tickets.id),
        completedTasks: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END)`,
      })
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .leftJoin(tickets, eq(users.id, tickets.assignedToUserId))
      .where(inArray(teamMembers.teamId, teamIds))
      .groupBy(users.id)
      .having(sql`COUNT(${tickets.id}) > 0`);

    return workloadData.map((data) => {
      const totalTasks = data.totalTasks;
      const completedTasks = Number(data.completedTasks);
      const workloadPercentage = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

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
  async getDashboardKanbanBillingItems(): Promise<{
    overdue: (BillingItem & { project: Project })[];
    review: (BillingItem & { project: Project })[];
    recentlyDone: (BillingItem & { project: Project })[];
    highPriorityTodo: (BillingItem & { project: Project })[];
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const overdue = await db
      .select()
      .from(billingItems)
      .innerJoin(projects, eq(billingItems.projectId, projects.id))
      .where(
        and(
          sql`${billingItems.expectedCollectionDate} < ${now}`,
          sql`${billingItems.billingStatus} != 'paid'`
        )
      )
      .execute();

    const review = await db
      .select()
      .from(billingItems)
      .innerJoin(projects, eq(billingItems.projectId, projects.id))
      .where(
        or(
          eq(billingItems.billingStatus, 'sent'),
          eq(billingItems.billingStatus, 'processing')
        )
      )
      .execute();

    const recentlyDone = await db
      .select()
      .from(billingItems)
      .innerJoin(projects, eq(billingItems.projectId, projects.id))
      .where(
        and(
          eq(billingItems.billingStatus, 'paid'),
          sql`${billingItems.updatedAt} >= ${sevenDaysAgo}`
        )
      )
      .execute();

    const highPriorityTodo = await db
      .select()
      .from(billingItems)
      .innerJoin(projects, eq(billingItems.projectId, projects.id))
      .where(eq(billingItems.billingStatus, 'to_send'))
      .execute();

    return {
      overdue: overdue.map(row => ({ ...row.billing_items, project: row.projects })),
      review: review.map(row => ({ ...row.billing_items, project: row.projects })),
      recentlyDone: recentlyDone.map(row => ({ ...row.billing_items, project: row.projects })),
      highPriorityTodo: highPriorityTodo.map(row => ({ ...row.billing_items, project: row.projects })),
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
        // Performance is now based on tickets assigned to team members (last 90 days)
    // (subtask-based scoring no longer applies - subtasks were removed)
    const teamMetrics = await db
      .select({
        teamId: teams.id,
        team: teams,
        totalTasks: count(tickets.id),
        completedTasks: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END)`,
        onTimeTasks: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END)`,
        overdueTasks: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('open', 'in_progress') THEN 1 ELSE 0 END)`,
        highPriorityTasks: sql<number>`SUM(CASE WHEN ${tickets.priority} IN ('high', 'urgent') THEN 1 ELSE 0 END)`,
        completedHighPriorityTasks: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') AND ${tickets.priority} IN ('high', 'urgent') THEN 1 ELSE 0 END)`,
      })
      .from(teams)
      .leftJoin(tickets, eq(teams.id, tickets.assignedTeamId))
      .where(
        and(
          sql`${tickets.id} IS NOT NULL`, // Only teams with actual tickets
          sql`${tickets.createdAt} >= NOW() - INTERVAL '90 days'`
        )
      )
      .groupBy(teams.id)
      .orderBy(sql`(SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(${tickets.id}), 0)) DESC`) // Order by completion rate
      .limit(1) // Only get the best team
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
            totalTasks: count(tickets.id),
            completedTasks: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END)`,
            overdueTasks: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('open', 'in_progress') THEN 1 ELSE 0 END)`,
            highPriorityTasks: sql<number>`SUM(CASE WHEN ${tickets.priority} IN ('high', 'urgent') THEN 1 ELSE 0 END)`,
            completedHighPriorityTasks: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') AND ${tickets.priority} IN ('high', 'urgent') THEN 1 ELSE 0 END)`,
          })
          .from(tickets)
          .where(eq(tickets.assignedToUserId, member.userId))
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

  async getSegmentLeader(segmentId: string): Promise<any> {
    try {
      // Get segment leader from the segmentLeaders table
      const [leader] = await db
        .select({
          segmentId: segmentLeaders.segmentId,
          leaderId: segmentLeaders.leaderId,
          leaderEmail: segmentLeaders.leaderEmail,
          leaderName: segmentLeaders.leaderName
        })
        .from(segmentLeaders)
        .where(eq(segmentLeaders.segmentId, segmentId));

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
    leaders: { segmentId: string; leaderEmail: string; leaderName: string }[];
    financeEmail: string;
    accountManagerEmail: string;
  }): Promise<void> {
    try {
      // Delete existing segment leaders first
      await db.delete(segmentLeaders);

      // Insert new segment leaders
      if (data.leaders.length > 0) {
        await db.insert(segmentLeaders).values(
          data.leaders.map(leader => ({
            segmentId: leader.segmentId,
            leaderName: leader.leaderName,
            leaderEmail: leader.leaderEmail,
          }))
        );
      }

      // Save finance and account manager emails to system configuration
      await this.setSystemConfig('financeEmail', data.financeEmail, 'Finance department email for notifications');
      await this.setSystemConfig('accountManagerEmail', data.accountManagerEmail, 'Account manager email for project forecasts');


    } catch (error) {
      console.error('Error updating segment leaders:', error);
      throw error;
    }
  }

  // Set (or clear) a single segment's leader, without touching any other segment's assignment.
  async setSegmentLeader(segmentId: string, leader: { leaderId: string; leaderName: string; leaderEmail: string } | null): Promise<void> {
    try {
      await db.delete(segmentLeaders).where(eq(segmentLeaders.segmentId, segmentId));
      if (leader) {
        await db.insert(segmentLeaders).values({
          segmentId,
          leaderId: leader.leaderId,
          leaderName: leader.leaderName,
          leaderEmail: leader.leaderEmail,
        } as any);
      }
    } catch (error) {
      console.error('Error setting segment leader:', error);
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

  // Project Management Dashboard implementation
  async getProjectPerformanceData(year: number, month?: number): Promise<{
    projects: (Project & { manager: User; team: Team | null; progress: number })[];
    ganttData: any;
    performanceMetrics: {
      totalProjects: number;
      billingProgress: number;
      teamCapacity: number;
      timelineHealth: number;
    };
  }> {
    try {
      // Get all projects with progress calculation (based on paid billing items)
      const projectsQuery = db
        .select({
          project: projects,
          manager: users,
          team: teams,
          totalBillingItems: sql<number>`COUNT(${billingItems.id})`,
          paidBillingItems: sql<number>`SUM(CASE WHEN ${billingItems.billingStatus} = 'paid' THEN 1 ELSE 0 END)`,
        })
        .from(projects)
        .leftJoin(users, eq(projects.managerId, users.id))
        .leftJoin(teams, eq(projects.teamId, teams.id))
        .leftJoin(billingItems, eq(billingItems.projectId, projects.id))
        .groupBy(projects.id, users.id, teams.id);

      // Add year filter
      let whereConditions = sql`EXTRACT(YEAR FROM ${projects.createdAt}) = ${year}`;

      // Add month filter if provided
      if (month) {
        whereConditions = sql`${whereConditions} AND EXTRACT(MONTH FROM ${projects.createdAt}) = ${month}`;
      }

      const projectResults = await projectsQuery.where(whereConditions);

      const projectsWithProgress = projectResults.map(result => {
        const totalBillingItems = Number(result.totalBillingItems || 0);
        const paidBillingItems = Number(result.paidBillingItems || 0);
        const progress = totalBillingItems > 0 ? Math.round((paidBillingItems / totalBillingItems) * 100) : 0;

        return {
          ...result.project,
          manager: result.manager!,
          team: result.team,
          progress
        };
      });

      // Calculate performance metrics
      const totalProjects = projectsWithProgress.length;
      const billingProgress = totalProjects > 0
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
        ganttData: null,
        performanceMetrics: {
          totalProjects,
          billingProgress,
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
      // Get projects that are on support status, with open/resolved ticket counts
      // (module/subtask "critical issues" no longer apply - tickets are the support-period work unit now)
      const supportProjectsQuery = db
        .select({
          project: projects,
          manager: users,
          team: teams,
          totalBillingItems: sql<number>`COUNT(DISTINCT ${billingItems.id})`,
          paidBillingItems: sql<number>`COUNT(DISTINCT CASE WHEN ${billingItems.billingStatus} = 'paid' THEN ${billingItems.id} END)`,
          openTickets: sql<number>`COUNT(DISTINCT CASE WHEN ${tickets.status} IN ('open', 'in_progress') THEN ${tickets.id} END)`,
          resolvedTickets: sql<number>`COUNT(DISTINCT CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN ${tickets.id} END)`,
        })
        .from(projects)
        .leftJoin(users, eq(projects.managerId, users.id))
        .leftJoin(teams, eq(projects.teamId, teams.id))
        .leftJoin(billingItems, eq(billingItems.projectId, projects.id))
        .leftJoin(tickets, eq(tickets.projectId, projects.id))
        .where(eq(projects.status, 'on_support'))
        .groupBy(projects.id, users.id, teams.id);

      const supportResults = await supportProjectsQuery;

      const supportProjects = supportResults.map(result => {
        const totalBillingItems = Number(result.totalBillingItems || 0);
        const paidBillingItems = Number(result.paidBillingItems || 0);
        const progress = totalBillingItems > 0 ? Math.round((paidBillingItems / totalBillingItems) * 100) : 0;
        const openTickets = Number(result.openTickets || 0);
        const resolvedTickets = Number(result.resolvedTickets || 0);

        const responseTime = openTickets > 0 ? Math.random() * 4 + 1 : Math.random() * 2 + 0.5; // Simulated response time
        const qualityRating = Math.min(5, 3 + (progress / 25)); // Quality based on billing progress

        // Determine SLA status
        let slaStatus = 'compliant';
        if (responseTime > 4) slaStatus = 'breach';
        else if (responseTime > 2.5 || openTickets > 3) slaStatus = 'warning';

        // Determine risk level
        let riskLevel = 'low';
        if (openTickets > 5 || progress < 50) riskLevel = 'high';
        else if (openTickets > 2 || progress < 75) riskLevel = 'medium';

        return {
          id: result.project.id,
          name: result.project.name,
          client: result.project.client,
          slaStatus,
          responseTime: `${responseTime.toFixed(1)} hrs`,
          issuesOpen: openTickets,
          issuesResolved: resolvedTickets,
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

  // Module/subtask/phase status-cascade operations were removed entirely along with
  // modules/subtasks/projectPhases - billing items have no status cascade, they're
  // updated directly (see updateBillingItem).

  // Billing item operations (flat per-project invoicing line items)
  async getBillingItems(): Promise<(BillingItem & { project: Project })[]> {
    try {
      const rows = await db
        .select({ billingItem: billingItems, project: projects })
        .from(billingItems)
        .leftJoin(projects, eq(billingItems.projectId, projects.id))
        .orderBy(asc(billingItems.createdAt));

      return rows.map((row) => ({ ...row.billingItem, project: row.project! }));
    } catch (error) {
      console.error('Error fetching billing items:', error);
      return [];
    }
  }

  async getBillingItemsForUser(userId: string): Promise<(BillingItem & { project: Project })[]> {
    try {
      const userTeamIds = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .execute();

      const teamIds = userTeamIds.map(t => t.teamId);

      const userProjectIds = await db
        .select({ projectId: projects.id })
        .from(projects)
        .where(
          teamIds.length > 0 ? sql`${projects.teamId} IN (${teamIds.join(',')})` : sql`1 = 0`
        )
        .execute();

      const projectIds = userProjectIds.map(p => p.projectId);

      if (projectIds.length === 0) {
        return [];
      }

      const rows = await db
        .select({ billingItem: billingItems, project: projects })
        .from(billingItems)
        .leftJoin(projects, eq(billingItems.projectId, projects.id))
        .where(inArray(billingItems.projectId, projectIds as any))
        .orderBy(asc(billingItems.createdAt));

      return rows.map((row) => ({ ...row.billingItem, project: row.project! }));
    } catch (error) {
      console.error('Error fetching billing items for user:', error);
      return [];
    }
  }

  async getBillingItem(id: string): Promise<(BillingItem & { project: Project }) | undefined> {
    try {
      const [result] = await db
        .select({ billingItem: billingItems, project: projects })
        .from(billingItems)
        .leftJoin(projects, eq(billingItems.projectId, projects.id))
        .where(eq(billingItems.id, id));

      if (!result) return undefined;
      return { ...result.billingItem, project: result.project! };
    } catch (error) {
      console.error('Error fetching billing item:', error);
      return undefined;
    }
  }

  async createBillingItem(billingItem: InsertBillingItem): Promise<BillingItem> {
    try {
      const [newBillingItem] = await db.insert(billingItems).values(billingItem as any).returning();
      await this.updateProjectStatusBasedOnBillingItems(newBillingItem.projectId);
      await this.recalculateProjectBudget(newBillingItem.projectId);
      return newBillingItem;
    } catch (error) {
      console.error('Error creating billing item:', error);
      throw error;
    }
  }

  async updateBillingItem(id: string, billingItem: Partial<InsertBillingItem>): Promise<BillingItem> {
    try {
      const [updatedBillingItem] = await db
        .update(billingItems)
        .set({
          ...billingItem,
          updatedAt: new Date() as any
        } as any)
        .where(eq(billingItems.id, id))
        .returning();

      await this.updateProjectStatusBasedOnBillingItems(updatedBillingItem.projectId);
      await this.recalculateProjectBudget(updatedBillingItem.projectId);

      return updatedBillingItem;
    } catch (error) {
      console.error('Error updating billing item:', error);
      throw error;
    }
  }

  async deleteBillingItem(id: string): Promise<void> {
    try {
      const [billingItemInfo] = await db
        .select({
          projectId: billingItems.projectId,
          name: billingItems.name,
          billingStatus: billingItems.billingStatus
        })
        .from(billingItems)
        .where(eq(billingItems.id, id));

      if (!billingItemInfo) {
        throw new Error('Billing item not found');
      }

      await db.delete(billingItems).where(eq(billingItems.id, id));

      try {
        const { auditService } = await import('./services/comprehensiveAuditService');
        await auditService.logSystemOperation(
          'delete',
          'billing_item',
          id,
          billingItemInfo.name,
          {
            projectId: billingItemInfo.projectId,
            billingStatus: billingItemInfo.billingStatus,
            reason: 'admin_deletion'
          }
        );
      } catch (error) {
        console.error('Error logging billing item deletion:', error);
      }

      if (billingItemInfo?.projectId) {
        await this.updateProjectStatusBasedOnBillingItems(billingItemInfo.projectId);
        await this.recalculateProjectBudget(billingItemInfo.projectId);
      }
    } catch (error) {
      console.error('Error deleting billing item:', error);
      throw error;
    }
  }

  async getBillingItemsByProject(projectId: string): Promise<BillingItem[]> {
    try {
      return await db
        .select()
        .from(billingItems)
        .where(eq(billingItems.projectId, projectId))
        .orderBy(asc(billingItems.createdAt));
    } catch (error) {
      console.error('Error fetching billing items by project:', error);
      return [];
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

  // Subtask/module operations were removed entirely (see billing item operations above,
  // and getUserAssignments/getTeamWorkload* below for what replaced them)

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
        // Idempotent: return the existing active role instead of erroring
        return existingRole[0] as unknown as AdminRole;
      }

      // Enforce uniqueness for segment leaders per segment by deactivating any existing active holder
      if (typedRoleData.roleType === 'segment_leader' && typedRoleData.segment) {
        const currentHolder = await db
          .select({ id: adminRoles.id, userId: adminRoles.userId })
          .from(adminRoles)
          .where(
            and(
              eq(adminRoles.roleType, 'segment_leader'),
              eq(adminRoles.segment, typedRoleData.segment),
              eq(adminRoles.isActive, true)
            )
          )
          .limit(1);

        if (currentHolder.length > 0 && currentHolder[0].userId !== typedRoleData.userId) {
          // Deactivate previous role assignment
          await db
            .update(adminRoles)
            .set({ isActive: false, updatedAt: new Date() } as any)
            .where(eq(adminRoles.id, currentHolder[0].id));

          // Clear previous user's assignedSegment flag
          await db
            .update(users)
            .set({ assignedSegment: null, updatedAt: new Date() } as any)
            .where(eq(users.id, currentHolder[0].userId));
        }
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

      // Update user table with admin flags and promote base role to admin
      const updateData: any = { updatedAt: new Date() };
      if (typedRoleData.roleType === 'segment_leader' && typedRoleData.segment) {
        updateData.assignedSegment = typedRoleData.segment;
      }
      // Ensure any assigned admin role elevates base role to 'admin'
      updateData.role = 'admin';

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

      // Update user table to remove admin flags (do not downgrade base role)
      const updateData: any = { updatedAt: new Date() };
      if (roleType === 'segment_leader') {
        updateData.assignedSegment = null;
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

  async getUserDashboardRole(userId: string): Promise<{ role: string; assignedSegment?: string }> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return { role: 'employee' };

      // Gather membership-based inheritance (segment leader hierarchy)
      const memberships = await db
        .select({
          headRoleType: adminRoles.roleType,
          headSegment: adminRoles.segment,
        })
        .from(adminRoleMembers)
        .innerJoin(adminRoles, eq(adminRoleMembers.headRoleId, adminRoles.id))
        .where(and(eq(adminRoleMembers.managerUserId, userId), eq(adminRoles.isActive, true)));

      let inheritedSeg: any = undefined;
      for (const m of memberships) {
        if (m.headRoleType === 'segment_leader' && m.headSegment) inheritedSeg = m.headSegment;
      }

      const assignedSegment = inheritedSeg ?? user.assignedSegment ?? undefined;

      return {
        role: user.role,
        assignedSegment,
      };
    } catch (error) {
      console.error('Error checking dashboard role:', error);
      return { role: 'employee' };
    }
  }

  async getSegmentLeaderData(): Promise<{ academic: any; parastals: any; private: any }> {
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

      return {
        academic: segmentLeaderRoles.find(r => r.segment === 'academic')?.user || null,
        parastals: segmentLeaderRoles.find(r => r.segment === 'parastals')?.user || null,
        private: segmentLeaderRoles.find(r => r.segment === 'private')?.user || null,
      };
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
      
      // Hash the password properly
      const { hashPassword } = await import('./auth');
      const hashedPassword = await hashPassword(temporaryPassword);
      
      // Create user with admin base role so they have full admin capabilities
      const [newUser] = await db
        .insert(users)
        .values({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: 'admin',
          password: hashedPassword, // Now properly hashed
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
      // Hash the password properly
      const { hashPassword } = await import('./auth');
      const hashedPassword = await hashPassword(newPassword);
      
      const updateData: any = {
        password: hashedPassword, // Now properly hashed
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

  async getUserAssignments(userId: string): Promise<{
    projects: Project[];
    tickets: any[];
  }> {
    // Projects via team membership
    const teamProjectRows = await db
      .select({ project: projects })
      .from(projects)
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId));

    // Projects via tickets assigned to the user
    const ticketProjectRows = await db
      .select({ project: projects })
      .from(tickets)
      .innerJoin(projects, eq(tickets.projectId, projects.id))
      .where(eq(tickets.assignedToUserId, userId));

    const allProjects = [
      ...teamProjectRows.map(r => r.project),
      ...ticketProjectRows.map(r => r.project),
    ];
    const projectMap: Record<string, Project> = {};
    for (const p of allProjects) {
      if (p) projectMap[p.id] = p;
    }
    const uniqueProjects = Object.values(projectMap);

    const userTickets = await this.getTickets({ assignedToUserId: userId });

    return { projects: uniqueProjects, tickets: userTickets };
  }

  async listManagersForHead(headRoleId: string): Promise<{ user: User }[]> {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      })
      .from(adminRoleMembers)
      .innerJoin(users, eq(adminRoleMembers.managerUserId, users.id))
      .where(eq(adminRoleMembers.headRoleId, headRoleId));
    return rows.map((u: any) => ({ user: u }));
  }

  async addManagersToHead(headRoleId: string, managerUsers: { id: string }[], assignedBy: string): Promise<void> {
    if (!managerUsers.length) return;
    const now = new Date();
    // Upsert links; ensure base role is 'manager'
    for (const mu of managerUsers) {
      // Link
      await db
        .insert(adminRoleMembers)
        .values({ headRoleId, managerUserId: mu.id, createdAt: now, updatedAt: now } as any)
        .onConflictDoNothing();
      // Promote to manager if not admin
      await db
        .update(users)
        .set({ role: sql`CASE WHEN role = 'admin' THEN role ELSE 'manager' END`, updatedAt: now } as any)
        .where(eq(users.id, mu.id));
    }
  }

  async removeManagerFromHead(headRoleId: string, managerUserId: string): Promise<void> {
    await db.delete(adminRoleMembers).where(and(eq(adminRoleMembers.headRoleId, headRoleId), eq(adminRoleMembers.managerUserId, managerUserId)));
  }
}

export const storage = new DatabaseStorage();
