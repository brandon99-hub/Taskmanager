import { emailService, EmailNotificationData } from './emailService';
import { storage } from '../storage';
import { InsertNotification } from '@shared/schema';
import { formatDueDate, shouldSendDueSoonNotification, getNotificationThreshold } from '@shared/dateUtils';

export interface NotificationContext {
  task?: any;
  project?: any;
  user?: any;
  assignedBy?: any;
}

export enum NotificationType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_DUE_SOON = 'task_due_soon',
  TASK_OVERDUE = 'task_overdue',
  PROJECT_DEADLINE = 'project_deadline',
  MILESTONE_COMPLETED = 'milestone_completed',
  TEAM_UPDATE = 'team_update'
}

export class NotificationService {
  constructor(
    private emailSvc = emailService,
    private storageInstance = storage
  ) {}
  private readonly DEBUG = process.env.NOTIFICATIONS_DEBUG === 'true';

  /**
   * Send a task assignment notification
   */
  async sendTaskAssignedNotification(context: NotificationContext): Promise<void> {
    const { task, project, user, assignedBy } = context;
    
    if (!task || !project || !user) {
      console.error('Missing required context for task assigned notification');
      return;
    }

    try {
      if (this.DEBUG) console.log(`Starting notification process for task ${task.id} assigned to user ${user.email}`);
      
      // Get user notification preferences
      const preferences = await this.getUserNotificationPreferences(user.id);
      if (this.DEBUG) console.log(`User ${user.email} preferences:`, {
        inAppTaskAssigned: preferences.inAppTaskAssigned,
        emailTaskAssigned: preferences.emailTaskAssigned
      });
      
      // Send in-app notification if enabled
      if (preferences.inAppTaskAssigned) {
        if (this.DEBUG) console.log(`Creating in-app notification for user ${user.email}`);
        await this.createInAppNotification({
          userId: user.id,
          title: 'New Task Assigned',
          message: `You have been assigned a new task: ${task.name} in ${project.name}`,
          type: NotificationType.TASK_ASSIGNED,
          relatedId: task.id
        });
        if (this.DEBUG) console.log(`In-app notification created successfully for user ${user.email}`);
      }

      // Send email notification if enabled
      if (preferences.emailTaskAssigned) {
        if (this.DEBUG) console.log(`Sending email notification to ${user.email}`);
        const emailData = this.buildTaskAssignedEmailData(context, preferences);
        const emailResult = await this.emailSvc.sendTaskAssignedEmail(emailData);
        if (this.DEBUG) console.log(`Email notification result for ${user.email}:`, emailResult);
      }

      if (this.DEBUG) console.log(`Task assigned notifications completed for task ${task.id} to user ${user.email}`);
    } catch (error) {
      console.error('Error sending task assigned notification:', error);
    }
  }

  /**
   * Send a task due soon reminder
   */
  async sendTaskDueSoonNotification(context: NotificationContext): Promise<void> {
    const { task, project, user } = context;
    
    if (!task || !project || !user) {
      console.error('Missing required context for task due soon notification');
      return;
    }

    try {
      const preferences = await this.getUserNotificationPreferences(user.id);
      
      // Send in-app notification if enabled
      if (preferences.inAppTaskDueSoon) {
        await this.createInAppNotification({
          userId: user.id,
          title: 'Task Due Soon',
          message: `Reminder: ${task.name} is due ${this.formatDueDate(task.dueDate)}`,
          type: NotificationType.TASK_DUE_SOON,
          relatedId: task.id
        });
      }

      // Send email notification if enabled
      if (preferences.emailTaskDueSoon) {
        const emailData = this.buildTaskDueSoonEmailData(context, preferences);
        await this.emailSvc.sendTaskDueSoonEmail(emailData);
      }

      if (this.DEBUG) console.log(`Task due soon notifications sent for task ${task.id} to user ${user.id}`);
    } catch (error) {
      console.error('Error sending task due soon notification:', error);
    }
  }

  /**
   * Send an overdue task alert
   */
  async sendTaskOverdueNotification(context: NotificationContext): Promise<void> {
    const { task, project, user } = context;
    
    if (!task || !project || !user) {
      console.error('Missing required context for task overdue notification');
      return;
    }

    try {
      const preferences = await this.getUserNotificationPreferences(user.id);
      
      // Send in-app notification if enabled
      if (preferences.inAppTaskOverdue) {
        await this.createInAppNotification({
          userId: user.id,
          title: 'Task Overdue',
          message: `URGENT: ${task.name} is now overdue and requires immediate attention`,
          type: NotificationType.TASK_OVERDUE,
          relatedId: task.id
        });
      }

      // Send email notification if enabled
      if (preferences.emailTaskOverdue) {
        const emailData = this.buildTaskOverdueEmailData(context, preferences);
        await this.emailSvc.sendTaskOverdueEmail(emailData);
      }

      if (this.DEBUG) console.log(`Task overdue notifications sent for task ${task.id} to user ${user.id}`);
    } catch (error) {
      console.error('Error sending task overdue notification:', error);
    }
  }

  /**
   * Send project deadline notification
   */
  async sendProjectDeadlineNotification(context: NotificationContext): Promise<void> {
    const { project, user } = context;
    
    if (!project || !user) {
      console.error('Missing required context for project deadline notification');
      return;
    }

    try {
      const preferences = await this.getUserNotificationPreferences(user.id);
      
      // Send in-app notification if enabled
      if (preferences.inAppProjectDeadline) {
        await this.createInAppNotification({
          userId: user.id,
          title: 'Project Deadline Approaching',
          message: `Project ${project.name} deadline is approaching: ${this.formatDueDate(project.endDate)}`,
          type: NotificationType.PROJECT_DEADLINE,
          relatedId: project.id
        });
      }

      // Send email notification if enabled
      if (preferences.emailProjectDeadline) {
        const emailData = this.buildProjectDeadlineEmailData(context, preferences);
        await this.emailSvc.sendProjectDeadlineEmail(emailData);
      }

      if (this.DEBUG) console.log(`Project deadline notifications sent for project ${project.id} to user ${user.id}`);
    } catch (error) {
      console.error('Error sending project deadline notification:', error);
    }
  }

  /**
   * Check for due soon tasks and send notifications based on smart deadline calculation
   */
  async checkAndSendDueSoonNotifications(): Promise<void> {
    try {
      // Get all active users
      const users = await this.storageInstance.getUsers();
      
      for (const user of users) {
        if (!user.isActive) continue;
        
        const preferences = await this.getUserNotificationPreferences(user.id);
        if (!preferences.emailTaskDueSoon && !preferences.inAppTaskDueSoon) continue;
        
        // Get all tasks assigned to this user that are not completed
        const userTasks = await this.storageInstance.getTasksByUser(user.id);
        
        for (const task of userTasks) {
          if (task.status === 'done') continue;
          
          // Calculate if task needs a due soon notification
          if (this.shouldSendDueSoonNotification(task)) {
            // Check if we already sent a reminder for this task recently
            const recentNotifications = await this.storageInstance.getNotifications(user.id);
            const hasRecentReminder = recentNotifications.some(n => 
              n.type === NotificationType.TASK_DUE_SOON && 
              n.relatedId === task.id &&
              new Date().getTime() - (task.completedAt ? new Date(task.completedAt).getTime() : 0) < 7 * 24 * 60 * 60 * 1000 // 7 days
            );
            
            if (!hasRecentReminder) {
              await this.sendTaskDueSoonNotification({
                task: task,
                project: task.project,
                user: user
              });
            }
          }
        }
      }
      
      if (this.DEBUG) console.log('Smart due soon notification check completed');
    } catch (error) {
      console.error('Error checking due soon notifications:', error);
    }
  }

  /**
   * Check for overdue tasks and send notifications
   */
  async checkAndSendOverdueNotifications(): Promise<void> {
    try {
      // Get all active users
      const users = await this.storageInstance.getUsers();
      
      for (const user of users) {
        if (!user.isActive) continue;
        
        const preferences = await this.getUserNotificationPreferences(user.id);
        if (!preferences.emailTaskOverdue && !preferences.inAppTaskOverdue) continue;
        
        // Get all tasks assigned to this user
        const userTasks = await this.storageInstance.getTasksByUser(user.id);
        
        for (const task of userTasks) {
          if (task.status === 'done') continue;
          
          // Check if task is overdue
          if (this.isTaskOverdue(task)) {
            // Check if we already sent an overdue alert recently
            const recentNotifications = await this.storageInstance.getNotifications(user.id);
            const hasRecentAlert = recentNotifications.some(n => 
              n.type === NotificationType.TASK_OVERDUE && 
              n.relatedId === task.id &&
              new Date().getTime() - (n.createdAt ? new Date(n.createdAt).getTime() : 0) < 24 * 60 * 60 * 1000 // 24 hours
            );
            
            if (!hasRecentAlert) {
              // Get project details for the task
              const project = await this.storageInstance.getProject(task.projectId);
              if (project) {
                await this.sendTaskOverdueNotification({
                  task: task,
                  project: project,
                  user: user
                });
              }
            }
          }
        }
      }
      
      console.log('Smart overdue notification check completed');
    } catch (error) {
      console.error('Error checking overdue notifications:', error);
    }
  }

  /**
   * Manual trigger for due soon notification check (API endpoint can call this)
   */
  async manualDueSoonCheck(): Promise<{ processed: number; sent: number }> {
    if (this.DEBUG) console.log('Manual due soon notification check triggered');
    
    let processed = 0;
    let sent = 0;
    
    try {
      const users = await this.storageInstance.getUsers();
      
      for (const user of users) {
        if (!user.isActive) continue;
        
        const preferences = await this.getUserNotificationPreferences(user.id);
        if (!preferences.emailTaskDueSoon && !preferences.inAppTaskDueSoon) continue;
        
        const userTasks = await this.storageInstance.getTasksByUser(user.id);
        
        for (const task of userTasks) {
          if (task.status === 'done') continue;
          processed++;
          
          if (this.shouldSendDueSoonNotification(task)) {
            const recentNotifications = await this.storageInstance.getNotifications(user.id);
            const hasRecentReminder = recentNotifications.some(n => 
              n.type === NotificationType.TASK_DUE_SOON && 
              n.relatedId === task.id &&
              new Date().getTime() - (task.completedAt ? new Date(task.completedAt).getTime() : 0) < 7 * 24 * 60 * 60 * 1000
            );
            
            if (!hasRecentReminder) {
              await this.sendTaskDueSoonNotification({
                task: task,
                project: task.project,
                user: user
              });
              sent++;
            }
          }
        }
      }
      
      if (this.DEBUG) console.log(`Manual due soon check completed: ${processed} tasks processed, ${sent} notifications sent`);
      return { processed, sent };
    } catch (error) {
      console.error('Error in manual due soon check:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for overdue notification check (API endpoint can call this)
   */
  async manualOverdueCheck(): Promise<{ processed: number; sent: number }> {
    if (this.DEBUG) console.log('Manual overdue notification check triggered');
    
    let processed = 0;
    let sent = 0;
    
    try {
      const users = await this.storageInstance.getUsers();
      
      for (const user of users) {
        if (!user.isActive) continue;
        
        const preferences = await this.getUserNotificationPreferences(user.id);
        if (!preferences.emailTaskOverdue && !preferences.inAppTaskOverdue) continue;
        
        const userTasks = await this.storageInstance.getTasksByUser(user.id);
        
        for (const task of userTasks) {
          if (task.status === 'done') continue;
          processed++;
          
          if (this.isTaskOverdue(task)) {
            const recentNotifications = await this.storageInstance.getNotifications(user.id);
            const hasRecentAlert = recentNotifications.some(n => 
              n.type === NotificationType.TASK_OVERDUE && 
              n.relatedId === task.id &&
              new Date().getTime() - (n.createdAt ? new Date(n.createdAt).getTime() : 0) < 24 * 60 * 60 * 1000
            );
            
            if (!hasRecentAlert) {
              await this.sendTaskOverdueNotification({
                task: task,
                project: task.project,
                user: user
              });
              sent++;
            }
          }
        }
      }
      
      if (this.DEBUG) console.log(`Manual overdue check completed: ${processed} tasks processed, ${sent} notifications sent`);
      return { processed, sent };
    } catch (error) {
      console.error('Error in manual overdue check:', error);
      throw error;
    }
  }

  /**
   * Check notifications for a specific user (called on dashboard load)
   */
  async checkUserNotifications(userId: string): Promise<{ dueSoon: number; overdue: number }> {
    try {
      const user = await this.storageInstance.getUser(userId);
      if (!user || !user.isActive) {
        return { dueSoon: 0, overdue: 0 };
      }

      const preferences = await this.getUserNotificationPreferences(userId);
      const userTasks = await this.storageInstance.getTasksByUser(userId);
      
      let dueSoonCount = 0;
      let overdueCount = 0;

      for (const task of userTasks) {
        if (task.status === 'done') continue;

        // Check for due soon notifications
        if (this.shouldSendDueSoonNotification(task)) {
          const recentNotifications = await this.storageInstance.getNotifications(userId);
          const hasRecentReminder = recentNotifications.some(n => 
            n.type === NotificationType.TASK_DUE_SOON && 
            n.relatedId === task.id &&
            new Date().getTime() - (task.completedAt ? new Date(task.completedAt).getTime() : 0) < 7 * 24 * 60 * 60 * 1000
          );

          if (!hasRecentReminder && (preferences.emailTaskDueSoon || preferences.inAppTaskDueSoon)) {
            await this.sendTaskDueSoonNotification({
              task: task,
              project: task.project,
              user: user
            });
            dueSoonCount++;
          }
        }

        // Check for overdue notifications
        if (this.isTaskOverdue(task)) {
          const recentNotifications = await this.storageInstance.getNotifications(userId);
          const hasRecentAlert = recentNotifications.some(n => 
            n.type === NotificationType.TASK_OVERDUE && 
            n.relatedId === task.id &&
            new Date().getTime() - (n.createdAt ? new Date(n.createdAt).getTime() : 0) < 24 * 60 * 60 * 1000
          );

          if (!hasRecentAlert && (preferences.emailTaskOverdue || preferences.inAppTaskOverdue)) {
            await this.sendTaskOverdueNotification({
              task: task,
              project: task.project,
              user: user
            });
            overdueCount++;
          }
        }
      }

      return { dueSoon: dueSoonCount, overdue: overdueCount };
    } catch (error) {
      console.error(`Error checking notifications for user ${userId}:`, error);
      return { dueSoon: 0, overdue: 0 };
    }
  }

  /**
   * Get user notification preferences (with defaults)
   */
  private async getUserNotificationPreferences(userId: string): Promise<any> {
    try {
      return await this.storageInstance.getUserNotificationPreferences(userId);
    } catch (error) {
      console.error('Error getting user notification preferences:', error);
      // Return safe defaults
      return {
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
      };
    }
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(notification: InsertNotification): Promise<void> {
    try {
      await this.storageInstance.createNotification(notification);
    } catch (error) {
      console.error('Error creating in-app notification:', error);
    }
  }

  /**
   * Build email data for task assigned notification
   */
  private buildTaskAssignedEmailData(context: NotificationContext, preferences: any): EmailNotificationData {
    const { task, project, user, assignedBy } = context;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    
    return {
      to: user.email,
      userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
      taskName: task.name,
      taskDescription: task.description,
      taskUrl: `${baseUrl}/tasks?taskId=${task.id}`,
      updateUrl: `${baseUrl}/tasks?taskId=${task.id}&action=update`,
      projectName: project.name,
      priority: task.priority,
      priorityLabel: task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium',
      dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) : 'Not set',
      feeAmount: task.feeAmount ? parseFloat(task.feeAmount).toLocaleString() : undefined,
      assignedBy: assignedBy ? `${assignedBy.firstName} ${assignedBy.lastName}` : 'Project Manager',
      progressPercent: task.progressPercent || 0,
      isUrgent: task.priority === 'high' || task.priority === 'critical'
    };
  }

  /**
   * Build email data for task due soon notification
   */
  private buildTaskDueSoonEmailData(context: NotificationContext, preferences: any): EmailNotificationData {
    const { task, project, user } = context;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    
    return {
      to: user.email,
      userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
      taskName: task.name,
      taskDescription: task.description,
      taskUrl: `${baseUrl}/tasks?taskId=${task.id}`,
      updateUrl: `${baseUrl}/tasks?taskId=${task.id}&action=update`,
      projectName: project.name,
      priority: task.priority,
      priorityLabel: task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium',
      dueDate: new Date(task.dueDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      feeAmount: task.feeAmount ? parseFloat(task.feeAmount).toLocaleString() : undefined,
      progressPercent: task.progressPercent || 0,
      isUrgent: true // All due soon notifications are urgent
    };
  }

  /**
   * Build email data for task overdue notification
   */
  private buildTaskOverdueEmailData(context: NotificationContext, preferences: any): EmailNotificationData {
    const { task, project, user } = context;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    
    return {
      to: user.email,
      userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
      taskName: task.name,
      taskDescription: task.description,
      taskUrl: `${baseUrl}/tasks?taskId=${task.id}`,
      updateUrl: `${baseUrl}/tasks?taskId=${task.id}&action=update`,
      projectName: project.name,
      priority: 'critical', // All overdue tasks are critical
      priorityLabel: 'OVERDUE',
      dueDate: new Date(task.dueDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      feeAmount: task.feeAmount ? parseFloat(task.feeAmount).toLocaleString() : undefined,
      progressPercent: task.progressPercent || 0,
      isUrgent: true
    };
  }

  /**
   * Build email data for project deadline notification
   */
  private buildProjectDeadlineEmailData(context: NotificationContext, preferences: any): EmailNotificationData {
    const { project, user } = context;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    
    return {
      to: user.email,
      userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
      projectName: project.name,
      taskUrl: `${baseUrl}/projects/${project.id}`,
      updateUrl: `${baseUrl}/projects/${project.id}`,
      priority: 'high',
      priorityLabel: 'High',
      dueDate: new Date(project.endDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      progressPercent: project.progress || 0,
      isUrgent: true
    };
  }

  /**
   * Smart calculation: Should we send a due soon notification for this task?
   */
  private shouldSendDueSoonNotification(task: any): boolean {
    return shouldSendDueSoonNotification(task.dueDate, task.priority);
  }

  /**
   * Check if a task is overdue
   */
  private isTaskOverdue(task: any): boolean {
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    
    // Task is overdue if current time is past the due date
    return now.getTime() > dueDate.getTime();
  }

  /**
   * Get notification threshold based on task priority
   */
  private getNotificationThreshold(priority: string): number {
    return getNotificationThreshold(priority);
  }

  /**
   * Check if we should send a notification today for this task
   * (Prevents sending the same notification multiple times)
   */
  private shouldSendNotificationToday(task: any, lastNotificationDate?: Date): boolean {
    if (!lastNotificationDate) return true;
    
    const now = new Date();
    const daysSinceLastNotification = Math.floor(
      (now.getTime() - lastNotificationDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // For critical tasks, send reminders every 3 days within the notification period
    if (task.priority?.toLowerCase() === 'critical') {
      return daysSinceLastNotification >= 3;
    }
    
    // For other tasks, send reminder once per week
    return daysSinceLastNotification >= 7;
  }

  /**
   * Format due date for display
   */
  private formatDueDate(dueDate: string | Date): string {
    return formatDueDate(dueDate);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
