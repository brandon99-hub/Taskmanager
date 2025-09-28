import { db } from '../db';
import { 
  systemActivityLogs, 
  apiRequestLogs, 
  systemEventsLogs,
  type InsertSystemActivityLog,
  type InsertApiRequestLog,
  type InsertSystemEventLog
} from '../../shared/schema';
import { eq, desc, asc, and, or, sql, count, gte, lte, like } from 'drizzle-orm';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

export interface UserActionData {
  actionType: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  oldValues?: any;
  newValues?: any;
  success?: boolean;
  errorMessage?: string;
  additionalContext?: any;
}

export interface ApiRequestData {
  method: string;
  endpoint: string;
  statusCode: number;
  responseTimeMs?: number;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  queryParams?: any;
  requestBodySize?: number;
}

export interface SystemEventData {
  eventType: string;
  eventCategory: string;
  description: string;
  severity?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  metadata?: any;
}

export class ComprehensiveAuditService {
  /**
   * Log user actions (CRUD operations, login/logout, etc.)
   */
  async logUserAction(
    data: UserActionData,
    context: AuditContext
  ): Promise<void> {
    try {
      await db.insert(systemActivityLogs).values({
        userId: context.userId,
        actionType: data.actionType,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        resourceName: data.resourceName,
        oldValues: data.oldValues,
        newValues: data.newValues,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        requestId: context.requestId,
        success: data.success ?? true,
        errorMessage: data.errorMessage,
        additionalContext: data.additionalContext,
      } as InsertSystemActivityLog);
    } catch (error) {
      console.error('Failed to log user action:', error);
    }
  }

  /**
   * Log API requests
   */
  async logApiRequest(
    data: ApiRequestData,
    context: AuditContext
  ): Promise<void> {
    try {
      await db.insert(apiRequestLogs).values({
        userId: context.userId,
        method: data.method,
        endpoint: data.endpoint,
        statusCode: data.statusCode,
        responseTimeMs: data.responseTimeMs,
        requestSizeBytes: data.requestSizeBytes,
        responseSizeBytes: data.responseSizeBytes,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        queryParams: data.queryParams,
        requestBodySize: data.requestBodySize,
        sessionId: context.sessionId,
      } as InsertApiRequestLog);
    } catch (error) {
      console.error('Failed to log API request:', error);
    }
  }

  /**
   * Log system events
   */
  async logSystemEvent(data: SystemEventData): Promise<void> {
    try {
      await db.insert(systemEventsLogs).values({
        eventType: data.eventType,
        eventCategory: data.eventCategory,
        description: data.description,
        severity: data.severity || 'info',
        metadata: data.metadata,
      } as InsertSystemEventLog);
    } catch (error) {
      console.error('Failed to log system event:', error);
    }
  }

  /**
   * Get logs with filtering and pagination
   */
  async getLogs(filters: {
    logType?: 'all' | 'activity' | 'security' | 'api' | 'system';
    startDate?: string;
    endDate?: string;
    userId?: string;
    severity?: string;
    actionType?: string;
    resourceType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      logType = 'all',
      startDate,
      endDate,
      userId,
      severity,
      actionType,
      resourceType,
      search,
      page = 1,
      limit = 50
    } = filters;

    const offset = (page - 1) * limit;

    // Build date filter
    const dateFilter = [];
    if (startDate) {
      dateFilter.push(gte(systemActivityLogs.createdAt, new Date(startDate)));
    }
    if (endDate) {
      dateFilter.push(lte(systemActivityLogs.createdAt, new Date(endDate)));
    }

    let logs: any[] = [];
    let totalCount = 0;

    if (logType === 'all' || logType === 'activity') {
      // Get activity logs
      const activityQuery = db
        .select()
        .from(systemActivityLogs)
        .where(
          and(
            userId ? eq(systemActivityLogs.userId, userId) : undefined,
            actionType ? eq(systemActivityLogs.actionType, actionType) : undefined,
            resourceType ? eq(systemActivityLogs.resourceType, resourceType) : undefined,
            search ? or(
              like(systemActivityLogs.resourceName, `%${search}%`),
              like(systemActivityLogs.actionType, `%${search}%`),
              like(systemActivityLogs.resourceType, `%${search}%`)
            ) : undefined,
            ...dateFilter
          )
        )
        .orderBy(desc(systemActivityLogs.createdAt))
        .limit(limit)
        .offset(offset);

      const activityCountQuery = db
        .select({ count: count() })
        .from(systemActivityLogs)
        .where(
          and(
            userId ? eq(systemActivityLogs.userId, userId) : undefined,
            actionType ? eq(systemActivityLogs.actionType, actionType) : undefined,
            resourceType ? eq(systemActivityLogs.resourceType, resourceType) : undefined,
            search ? or(
              like(systemActivityLogs.resourceName, `%${search}%`),
              like(systemActivityLogs.actionType, `%${search}%`),
              like(systemActivityLogs.resourceType, `%${search}%`)
            ) : undefined,
            ...dateFilter
          )
        );

      const [activityLogs, activityCount] = await Promise.all([
        activityQuery,
        activityCountQuery
      ]);

      logs = [...logs, ...activityLogs.map(log => ({ ...log, logType: 'activity' }))];
      totalCount += activityCount[0].count;
    }

    if (logType === 'all' || logType === 'api') {
      // Get API logs
      const apiQuery = db
        .select()
        .from(apiRequestLogs)
        .where(
          and(
            userId ? eq(apiRequestLogs.userId, userId) : undefined,
            search ? or(
              like(apiRequestLogs.endpoint, `%${search}%`),
              like(apiRequestLogs.method, `%${search}%`)
            ) : undefined,
            ...dateFilter
          )
        )
        .orderBy(desc(apiRequestLogs.createdAt))
        .limit(limit)
        .offset(offset);

      const apiCountQuery = db
        .select({ count: count() })
        .from(apiRequestLogs)
        .where(
          and(
            userId ? eq(apiRequestLogs.userId, userId) : undefined,
            search ? or(
              like(apiRequestLogs.endpoint, `%${search}%`),
              like(apiRequestLogs.method, `%${search}%`)
            ) : undefined,
            ...dateFilter
          )
        );

      const [apiLogs, apiCount] = await Promise.all([
        apiQuery,
        apiCountQuery
      ]);

      logs = [...logs, ...apiLogs.map(log => ({ ...log, logType: 'api' }))];
      totalCount += apiCount[0].count;
    }

    if (logType === 'all' || logType === 'system') {
      // Get system event logs
      const systemQuery = db
        .select()
        .from(systemEventsLogs)
        .where(
          and(
            severity ? eq(systemEventsLogs.severity, severity) : undefined,
            search ? or(
              like(systemEventsLogs.description, `%${search}%`),
              like(systemEventsLogs.eventType, `%${search}%`)
            ) : undefined,
            ...dateFilter
          )
        )
        .orderBy(desc(systemEventsLogs.createdAt))
        .limit(limit)
        .offset(offset);

      const systemCountQuery = db
        .select({ count: count() })
        .from(systemEventsLogs)
        .where(
          and(
            severity ? eq(systemEventsLogs.severity, severity) : undefined,
            search ? or(
              like(systemEventsLogs.description, `%${search}%`),
              like(systemEventsLogs.eventType, `%${search}%`)
            ) : undefined,
            ...dateFilter
          )
        );

      const [systemLogs, systemCount] = await Promise.all([
        systemQuery,
        systemCountQuery
      ]);

      logs = [...logs, ...systemLogs.map(log => ({ ...log, logType: 'system' }))];
      totalCount += systemCount[0].count;
    }

    // Sort all logs by creation date
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      data: logs.slice(0, limit),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    };
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(filters: {
    startDate?: string;
    endDate?: string;
    userId?: string;
  }) {
    const { startDate, endDate, userId } = filters;

    const dateFilter = [];
    if (startDate) {
      dateFilter.push(gte(systemActivityLogs.createdAt, new Date(startDate)));
    }
    if (endDate) {
      dateFilter.push(lte(systemActivityLogs.createdAt, new Date(endDate)));
    }

    const baseFilter = and(
      userId ? eq(systemActivityLogs.userId, userId) : undefined,
      ...dateFilter
    );

    // Also get system events count
    const systemDateFilter = [];
    if (startDate) {
      systemDateFilter.push(gte(systemEventsLogs.createdAt, new Date(startDate)));
    }
    if (endDate) {
      systemDateFilter.push(lte(systemEventsLogs.createdAt, new Date(endDate)));
    }

    const systemBaseFilter = and(...systemDateFilter);

    const [
      totalActivities,
      successfulActivities,
      failedActivities,
      totalSystemEvents,
      topActions,
      topResources,
      topUsers
    ] = await Promise.all([
      // Total activities
      db.select({ count: count() }).from(systemActivityLogs).where(baseFilter),
      
      // Successful activities
      db.select({ count: count() }).from(systemActivityLogs).where(and(baseFilter, eq(systemActivityLogs.success, true))),
      
      // Failed activities
      db.select({ count: count() }).from(systemActivityLogs).where(and(baseFilter, eq(systemActivityLogs.success, false))),
      
      // Total system events
      db.select({ count: count() }).from(systemEventsLogs).where(systemBaseFilter),
      
      // Top actions
      db.select({ 
        actionType: systemActivityLogs.actionType,
        count: count()
      })
      .from(systemActivityLogs)
      .where(baseFilter)
      .groupBy(systemActivityLogs.actionType)
      .orderBy(desc(count()))
      .limit(10),
      
      // Top resources
      db.select({ 
        resourceType: systemActivityLogs.resourceType,
        count: count()
      })
      .from(systemActivityLogs)
      .where(baseFilter)
      .groupBy(systemActivityLogs.resourceType)
      .orderBy(desc(count()))
      .limit(10),
      
      // Top users
      db.select({ 
        userId: systemActivityLogs.userId,
        count: count()
      })
      .from(systemActivityLogs)
      .where(and(baseFilter, sql`${systemActivityLogs.userId} IS NOT NULL`))
      .groupBy(systemActivityLogs.userId)
      .orderBy(desc(count()))
      .limit(10)
    ]);

    const activityCount = totalActivities[0].count;
    const systemCount = totalSystemEvents[0].count;
    const totalCount = activityCount + systemCount;

    return {
      totalActivities: totalCount,
      successfulActivities: successfulActivities[0].count,
      failedActivities: failedActivities[0].count,
      successRate: totalCount > 0 
        ? (successfulActivities[0].count / totalCount) * 100 
        : 0,
      topActions: topActions,
      topResources: topResources,
      topUsers: topUsers
    };
  }

  /**
   * Export logs to Excel
   */
  async exportLogs(filters: any) {
    const logs = await this.getLogs({ ...filters, limit: 10000 });
    return logs.data;
  }
}

export const auditService = new ComprehensiveAuditService();
