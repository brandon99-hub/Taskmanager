import { emailService, EmailNotificationData } from './emailService';
import { storage } from '../storage';
import { InsertNotification } from '../../shared/schema';
import { formatDueDate, shouldSendDueSoonNotification, getNotificationThreshold } from '../../shared/dateUtils';

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
  TEAM_UPDATE = 'team_update',
  ADMIN_ROLE_ASSIGNED = 'admin_role_assigned',
  USER_CREDENTIALS_SENT = 'user_credentials_sent',
  SUBTASK_ASSIGNMENT = 'subtask_assignment',
  FINANCE_DEADLINE_WARNING = 'finance_deadline_warning'
}

export class NotificationService {
  constructor(
    private emailSvc = emailService,
    private storageInstance = storage
  ) {}


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
  
      
      // Get user notification preferences
      const preferences = await this.getUserNotificationPreferences(user.id);

      
      // Send in-app notification if enabled
      if (preferences.inAppTaskAssigned) {

        await this.createInAppNotification({
          userId: user.id,
          title: 'New Task Assigned',
          message: `You have been assigned a new task: ${task.name} in ${project.name}`,
          type: NotificationType.TASK_ASSIGNED,
          relatedId: task.id
        });

      }

      // Send email notification if enabled
      if (preferences.emailTaskAssigned) {

        const emailData = this.buildTaskAssignedEmailData(context, preferences);
        const emailResult = await this.emailSvc.sendTaskAssignedEmail(emailData);

      }

      
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
    const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || '';
    
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
    const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || '';
    
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
    const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || '';
    
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
    const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || '';
    
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

  /**
   * Send admin role assignment notification
   */
  async sendAdminRoleAssignedNotification(context: {
    user: any;
    roleType: string;
    segment?: string;
    assignedBy: any;
    temporaryPassword?: string;
  }): Promise<void> {
    const { user, roleType, segment, assignedBy, temporaryPassword } = context;
    
    if (!user || !roleType || !assignedBy) {
      console.error('Missing required context for admin role assigned notification');
      return;
    }

    try {
      // Send in-app notification
      await this.createInAppNotification({
        userId: user.id,
        title: 'Admin Role Assigned',
        message: `You have been assigned the role of ${this.formatRoleName(roleType, segment)} by ${assignedBy.firstName} ${assignedBy.lastName}`,
        type: NotificationType.ADMIN_ROLE_ASSIGNED,
        relatedId: user.id
      });

      // Send email notification with credentials if provided
      if (temporaryPassword) {
        await this.sendCredentialsEmail({
          user,
          roleType,
          segment,
          assignedBy,
          temporaryPassword
        });
      } else {
        await this.sendRoleAssignmentEmail({
          user,
          roleType,
          segment,
          assignedBy
        });
      }

    } catch (error) {
      console.error('Error sending admin role assigned notification:', error);
    }
  }

  /**
   * Send subtask assignment notification with dual recipients
   */
  async sendSubtaskAssignmentNotification(context: {
    subtask: any;
    module: any;
    project: any;
    assignee: any;
    assignedBy: any;
  }): Promise<void> {
    const { subtask, module, project, assignee, assignedBy } = context;
    
    if (!subtask || !module || !project || !assignee || !assignedBy) {
      console.error('Missing required context for subtask assignment notification');
      return;
    }

    try {
      // Send notification to assignee
      const assigneePreferences = await this.getUserNotificationPreferences(assignee.id);
      
      if (assigneePreferences.inAppTaskAssigned) {
        await this.createInAppNotification({
          userId: assignee.id,
          title: 'New Subtask Assigned',
          message: `You have been assigned subtask: ${subtask.name} in module ${module.name}`,
          type: NotificationType.SUBTASK_ASSIGNMENT,
          relatedId: subtask.id
        });
      }

      if (assigneePreferences.emailTaskAssigned) {
        await this.sendSubtaskAssignmentEmail({
          subtask,
          module,
          project,
          assignee,
          assignedBy,
          isAssignee: true
        });
      }

      // Send notification to assigned by (if different)
      if (assignee.id !== assignedBy.id) {
        const assignerPreferences = await this.getUserNotificationPreferences(assignedBy.id);
        
        if (assignerPreferences.inAppTaskAssigned) {
          await this.createInAppNotification({
            userId: assignedBy.id,
            title: 'Subtask Assignment Confirmed',
            message: `Subtask ${subtask.name} has been assigned to ${assignee.firstName} ${assignee.lastName}`,
            type: NotificationType.SUBTASK_ASSIGNMENT,
            relatedId: subtask.id
          });
        }

        if (assignerPreferences.emailTaskAssigned) {
          await this.sendSubtaskAssignmentEmail({
            subtask,
            module,
            project,
            assignee,
            assignedBy,
            isAssignee: false
          });
        }
      }

    } catch (error) {
      console.error('Error sending subtask assignment notification:', error);
    }
  }

  /**
   * Send notifications for subtask assignments with specialized roles (dev and consultant)
   */
  async sendSubtaskSpecializedRoleNotification(context: {
    subtask: any;
    module: any;
    project: any;
    assignedBy: any;
  }): Promise<void> {
    const { subtask, module, project, assignedBy } = context;
    
    if (!subtask || !module || !project || !assignedBy) {
      console.error('Missing required context for specialized role subtask notification');
      return;
    }

    try {
      // Send notification to assigned developer if present
      if (subtask.assignedDevId) {
        const developer = await this.storageInstance.getUser(subtask.assignedDevId);
        if (developer) {
          const devPreferences = await this.getUserNotificationPreferences(developer.id);
          
          if (devPreferences.inAppTaskAssigned) {
            await this.createInAppNotification({
              userId: developer.id,
              title: 'New Development Subtask Assigned',
              message: `You have been assigned as developer for subtask: ${subtask.name} in module ${module.name}`,
              type: NotificationType.SUBTASK_ASSIGNMENT,
              relatedId: subtask.id
            });
          }

          if (devPreferences.emailTaskAssigned) {
            await this.sendSubtaskAssignmentEmail({
              subtask,
              module,
              project,
              assignee: developer,
              assignedBy,
              isAssignee: true
            });
          }
        }
      }

      // Send notification to assigned functional consultant if present
      if (subtask.assignedConsultantId) {
        const consultant = await this.storageInstance.getUser(subtask.assignedConsultantId);
        if (consultant) {
          const consultantPreferences = await this.getUserNotificationPreferences(consultant.id);
          
          if (consultantPreferences.inAppTaskAssigned) {
            await this.createInAppNotification({
              userId: consultant.id,
              title: 'New Consultant Subtask Assigned',
              message: `You have been assigned as functional consultant for subtask: ${subtask.name} in module ${module.name}`,
              type: NotificationType.SUBTASK_ASSIGNMENT,
              relatedId: subtask.id
            });
          }

          if (consultantPreferences.emailTaskAssigned) {
            await this.sendSubtaskAssignmentEmail({
              subtask,
              module,
              project,
              assignee: consultant,
              assignedBy,
              isAssignee: true
            });
          }
        }
      }
    } catch (error) {
      console.error('Error sending specialized role subtask notification:', error);
    }
  }

  /**
   * Send finance deadline warning (for finance head role)
   */
  async sendFinanceDeadlineWarning(context: {
    milestones: any[];
    financeHead: any;
  }): Promise<void> {
    const { milestones, financeHead } = context;
    
    if (!milestones || milestones.length === 0 || !financeHead) {
      return;
    }

    try {
      // Send in-app notification
      await this.createInAppNotification({
        userId: financeHead.id,
        title: 'Payment Deadlines Approaching',
        message: `${milestones.length} milestone payments are due for processing`,
        type: NotificationType.FINANCE_DEADLINE_WARNING,
        relatedId: 'finance_warning'
      });

      // Send email notification
      await this.sendFinanceDeadlineEmail({
        milestones,
        financeHead
      });

    } catch (error) {
      console.error('Error sending finance deadline warning:', error);
    }
  }

  /**
   * Helper method to format role names for display
   */
  private formatRoleName(roleType: string, segment?: string): string {
    switch (roleType) {
      case 'project_manager':
        return 'Project Manager';
      case 'finance_head':
        return 'Finance Head';
      case 'segment_leader':
        return `${segment?.charAt(0).toUpperCase()}${segment?.slice(1)} Segment Leader`;
      case 'manager':
        return 'Manager';
      default:
        return roleType;
    }
  }

  /**
   * Get role-specific responsibilities for email templates
   */
  private getRoleResponsibilities(roleType: string, segment?: string): string {
    switch (roleType) {
      case 'project_manager':
        return `
          <li>Oversee all projects across all segments</li>
          <li>Manage project timelines and deliverables</li>
          <li>Coordinate with team leaders and clients</li>
          <li>Monitor project budgets and resource allocation</li>
          <li>Generate and review project reports</li>
        `;
        
      case 'finance_head':
        return `
          <li>Monitor financial performance and budgets</li>
          <li>Track invoice payments and collections</li>
          <li>Generate financial reports and analytics</li>
          <li>Manage payment deadlines and reminders</li>
          <li>Oversee contract values and budget allocations</li>
        `;
        
      case 'segment_leader':
        const segmentName = segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : 'Unknown';
        return `
          <li>Manage all ${segmentName} sector projects</li>
          <li>Monitor ${segmentName} project performance and metrics</li>
          <li>Coordinate with ${segmentName} clients and stakeholders</li>
          <li>Review ${segmentName} project deliverables and timelines</li>
          <li>Generate ${segmentName} sector reports and analytics</li>
        `;
        
      default:
        return '<li>Access assigned dashboard and manage your responsibilities</li>';
    }
  }

  /**
   * Send credentials email for new admin users
   */
  private async sendCredentialsEmail(context: {
    user: any;
    roleType: string;
    segment?: string;
    assignedBy: any;
    temporaryPassword: string;
  }): Promise<void> {
    const { user, roleType, segment, assignedBy, temporaryPassword } = context;
    
    const roleName = this.formatRoleName(roleType, segment);
    const userName = (user.firstName && user.lastName) 
      ? `${user.firstName} ${user.lastName}` 
      : user.email;
    const assignerName = (assignedBy.firstName && assignedBy.lastName) 
      ? `${assignedBy.firstName} ${assignedBy.lastName}` 
      : assignedBy.email;
    
    const emailTemplate = {
      to: user.email,
      subject: `Welcome to TaskFlow - ${roleName} Role Assignment`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to TaskFlow</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1f4e79; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .credentials { background: white; border: 2px solid #e74c3c; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .button { display: inline-block; background: #1f4e79; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to TaskFlow</h1>
              <p>You've been assigned an admin role</p>
            </div>
            
            <div class="content">
              <h2>Hello ${userName},</h2>
              
              <p>Congratulations! You have been assigned the role of <strong>${roleName}</strong> by ${assignerName}.</p>
              
              <div class="credentials">
                <h3>🔐 Your Login Credentials</h3>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Temporary Password:</strong> <code>${temporaryPassword}</code></p>
              </div>
              
              <div class="warning">
                <h4>⚠️ Important Security Notice</h4>
                <p>For security reasons, you <strong>must change your password</strong> immediately after your first login.</p>
              </div>
              
              <h3>Your Responsibilities as ${roleName}:</h3>
              <ul>
                ${this.getRoleResponsibilities(roleType, segment)}
              </ul>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || process.env.CLIENT_URL}/login" class="button">
                  Login to TaskFlow Dashboard
                </a>
              </p>
              
              <p style="font-size: 12px; color: #666; margin-top: 30px;">
                If you have any questions, please contact your administrator or reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to TaskFlow!
        
        Hello ${userName},
        
        You have been assigned the role of ${roleName} by ${assignerName}.
        
        Your Login Credentials:
        Email: ${user.email}
        Temporary Password: ${temporaryPassword}
        
        IMPORTANT: You must change your password immediately after your first login for security reasons.
        
        Please login at: ${process.env.FRONTEND_URL || process.env.CLIENT_URL}/login
        
        Best regards,
        TaskFlow Team
      `
    };
    
    // Send email using email service
    try {
      await this.emailSvc.sendEmail(emailTemplate);
      console.log(`Credentials email sent to: ${user.email}`);
    } catch (error) {
      console.error('Failed to send credentials email:', error);
      throw error;
    }
  }

  /**
   * Send role assignment email (without credentials)
   */
  private async sendRoleAssignmentEmail(context: {
    user: any;
    roleType: string;
    segment?: string;
    assignedBy: any;
  }): Promise<void> {
    const { user, roleType, segment, assignedBy } = context;
    
    const roleName = this.formatRoleName(roleType, segment);
    const userName = (user.firstName && user.lastName) 
      ? `${user.firstName} ${user.lastName}` 
      : user.email;
    const assignerName = (assignedBy.firstName && assignedBy.lastName) 
      ? `${assignedBy.firstName} ${assignedBy.lastName}` 
      : assignedBy.email;
    
    const emailTemplate = {
      to: user.email,
      subject: `Role Assignment Update - ${roleName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Role Assignment Update</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #27ae60; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .role-info { background: white; border-left: 4px solid #27ae60; padding: 20px; margin: 20px 0; }
            .button { display: inline-block; background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>.updateDynamic Role Assignment Update</h1>
              <p>Your responsibilities have been updated</p>
            </div>
            
            <div class="content">
              <h2>Hello ${userName},</h2>
              
              <p>Your role has been updated in the TaskFlow system by ${assignerName}.</p>
              
              <div class="role-info">
                <h3>New Role: ${roleName}</h3>
                <p>This role grants you additional responsibilities and access within the system.</p>
              </div>
              
              <h3>Your New Responsibilities:</h3>
              <ul>
                ${this.getRoleResponsibilities(roleType, segment)}
              </ul>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || process.env.CLIENT_URL}/dashboard" class="button">
                  Access Your Dashboard
                </a>
              </p>
              
              <p style="font-size: 12px; color: #666; margin-top: 30px;">
                If you have any questions about your new role, please contact your administrator.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Role Assignment Update
        
        Hello ${userName},
        
        Your role has been updated to ${roleName} by ${assignerName}.
        
        Please login to access your updated dashboard at: ${process.env.FRONTEND_URL || process.env.CLIENT_URL}/dashboard
        
        Best regards,
        TaskFlow Team
      `
    };
    
    try {
      await this.emailSvc.sendEmail(emailTemplate);
      console.log(`Role assignment email sent to: ${user.email}`);
    } catch (error) {
      console.error('Failed to send role assignment email:', error);
      throw error;
    }
  }

  /**
   * Send subtask assignment email
   */
  private async sendSubtaskAssignmentEmail(context: {
    subtask: any;
    module: any;
    project: any;
    assignee: any;
    assignedBy: any;
    isAssignee: boolean;
  }): Promise<void> {
    const { subtask, module, project, assignee, assignedBy, isAssignee } = context;
    
    const recipient = isAssignee ? assignee : assignedBy;
    const recipientName = (recipient.firstName && recipient.lastName) 
      ? `${recipient.firstName} ${recipient.lastName}` 
      : recipient.email;
    const assigneeName = (assignee.firstName && assignee.lastName) 
      ? `${assignee.firstName} ${assignee.lastName}` 
      : assignee.email;
    const assignerName = (assignedBy.firstName && assignedBy.lastName) 
      ? `${assignedBy.firstName} ${assignedBy.lastName}` 
      : assignedBy.email;
    
    const subject = isAssignee 
      ? `New Subtask Assignment: ${subtask.name}`
      : `Subtask Assignment Confirmation: ${subtask.name}`;
    
    const emailTemplate = {
      to: recipient.email,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${isAssignee ? '#3498db' : '#27ae60'}; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .task-info { background: white; border-left: 4px solid ${isAssignee ? '#3498db' : '#27ae60'}; padding: 20px; margin: 20px 0; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; }
            .priority { padding: 5px 10px; border-radius: 15px; font-weight: bold; font-size: 12px; }
            .priority.high { background: #ffebee; color: #c62828; }
            .priority.medium { background: #fff8e1; color: #f57c00; }
            .priority.low { background: #e8f5e8; color: #2e7d32; }
            .button { display: inline-block; background: ${isAssignee ? '#3498db' : '#27ae60'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; }
            .deadline { color: #e74c3c; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${isAssignee ? '📋' : '✅'} ${isAssignee ? 'New Subtask Assignment' : 'Assignment Confirmation'}</h1>
              <p>${isAssignee ? 'You have a new subtask to work on' : 'Your subtask assignment has been confirmed'}</p>
            </div>
            
            <div class="content">
              <h2>Hello ${recipientName},</h2>
              
              ${isAssignee 
                ? `<p>You have been assigned a new subtask by ${assignerName}.</p>`
                : `<p>The subtask <strong>${subtask.name}</strong> has been successfully assigned to ${assigneeName}.</p>`
              }
              
              <div class="task-info">
                <h3>Subtask Details</h3>
                <div class="details">
                  <h4>${subtask.name}</h4>
                  <p><strong>Description:</strong> ${subtask.description || 'No description provided'}</p>
                  <p><strong>Module:</strong> ${module.name}</p>
                  <p><strong>Project:</strong> ${project.name}</p>
                  ${subtask.dueDate ? `<p><strong>Due Date:</strong> <span class="deadline">${new Date(subtask.dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>` : ''}
                  ${subtask.priority ? `<p><strong>Priority:</strong> <span class="priority ${subtask.priority.toLowerCase()}">${subtask.priority.toUpperCase()}</span></p>` : ''}
                  ${isAssignee ? `<p><strong>Assigned By:</strong> ${assignerName}</p>` : `<p><strong>Assigned To:</strong> ${assigneeName}</p>`}
                  ${subtask.estimatedHours ? `<p><strong>Estimated Hours:</strong> ${subtask.estimatedHours}h</p>` : ''}
                </div>
              </div>
              
              ${isAssignee ? `
              <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h4>📝 Next Steps:</h4>
                <ul>
                  <li>Review the subtask requirements carefully</li>
                  <li>Update progress regularly in the system</li>
                  <li>Reach out to ${assignerName} if you have questions</li>
                  <li>Complete the task before the deadline</li>
                </ul>
              </div>
              ` : `
              <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h4>✅ Assignment Confirmed</h4>
                <p>The subtask has been successfully assigned to ${assigneeName}. You can track progress in your dashboard.</p>
              </div>
              `}
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || process.env.CLIENT_URL}/projects/${project.id}/modules/${module.id}" class="button">
                  ${isAssignee ? 'View Subtask' : 'Monitor Progress'}
                </a>
                ${isAssignee ? `<a href="${process.env.FRONTEND_URL || process.env.CLIENT_URL}/dashboard" class="button">Go to Dashboard</a>` : ''}
              </p>
              
              <p style="font-size: 12px; color: #666; margin-top: 30px;">
                This is an automated notification from TaskFlow. If you have questions, please contact the project manager.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        ${subject}
        
        Hello ${recipientName},
        
        ${isAssignee 
          ? `You have been assigned a new subtask: ${subtask.name} by ${assignerName}.`
          : `The subtask "${subtask.name}" has been successfully assigned to ${assigneeName}.`
        }
        
        Subtask Details:
        - Name: ${subtask.name}
        - Description: ${subtask.description || 'No description provided'}
        - Module: ${module.name}
        - Project: ${project.name}
        ${subtask.dueDate ? `- Due Date: ${new Date(subtask.dueDate).toLocaleDateString()}` : ''}
        ${subtask.priority ? `- Priority: ${subtask.priority}` : ''}
        ${isAssignee ? `- Assigned By: ${assignerName}` : `- Assigned To: ${assigneeName}`}
        
        Access TaskFlow: ${process.env.FRONTEND_URL || process.env.CLIENT_URL}/projects/${project.id}/modules/${module.id}
        
        Best regards,
        TaskFlow Team
      `
    };
    
    try {
      await this.emailSvc.sendEmail(emailTemplate);
      console.log(`Subtask assignment email sent to: ${recipient.email}`);
    } catch (error) {
      console.error('Failed to send subtask assignment email:', error);
      throw error;
    }
  }

  /**
   * Send finance deadline email
   */
  private async sendFinanceDeadlineEmail(context: {
    milestones: any[];
    financeHead: any;
  }): Promise<void> {
    const { milestones, financeHead } = context;
    const financeHeadName = `${financeHead.firstName} ${financeHead.lastName}`;
    
    // Group milestones by urgency
    const now = new Date();
    const urgentMilestones = milestones.filter(m => {
      const dueDate = new Date(m.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 3;
    });
    
    const upcomingMilestones = milestones.filter(m => {
      const dueDate = new Date(m.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue > 3 && daysUntilDue <= 14;
    });
    
    const totalAmount = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    
    const subject = `Finance Alert: ${milestones.length} Payment Deadlines Approaching`;
    
    const emailTemplate = {
      to: financeHead.email,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 700px; margin: 0 auto; padding: 20px; }
            .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .alert { background: #ffebee; border: 2px solid #e74c3c; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .milestone-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
            .milestone-table th, .milestone-table td { padding: 12px; border: 1px solid #ddd; text-align: left; }
            .milestone-table th { background: #f8f9fa; font-weight: bold; }
            .urgent { background: #ffebee; }
            .upcoming { background: #fff3e0; }
            .amount { font-weight: bold; color: #2c3e50; }
            .button { display: inline-block; background: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; }
            .summary { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💰 Finance Alert</h1>
              <p>Payment deadlines require your attention</p>
            </div>
            
            <div class="content">
              <h2>Hello ${financeHeadName},</h2>
              
              <div class="alert">
                <h3>⚠️ Payment Deadlines Approaching</h3>
                <p>You have <strong>${milestones.length} milestone payments</strong> that require processing. Please review and take appropriate action.</p>
              </div>
              
              <div class="summary">
                <h3>📊 Summary</h3>
                <p><strong>Total Milestones:</strong> ${milestones.length}</p>
                <p><strong>Total Amount:</strong> <span class="amount">$${totalAmount.toLocaleString()}</span></p>
                <p><strong>Urgent (≤3 days):</strong> ${urgentMilestones.length}</p>
                <p><strong>Upcoming (4-14 days):</strong> ${upcomingMilestones.length}</p>
              </div>
              
              ${urgentMilestones.length > 0 ? `
              <h3 style="color: #e74c3c;">🚨 Urgent Milestones (≤3 days)</h3>
              <table class="milestone-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Milestone</th>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Client</th>
                  </tr>
                </thead>
                <tbody>
                  ${urgentMilestones.map(m => {
                    const dueDate = new Date(m.dueDate);
                    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return `
                    <tr class="urgent">
                      <td>${m.project?.name || 'Unknown Project'}</td>
                      <td>${m.name}</td>
                      <td>${dueDate.toLocaleDateString()} (${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'})</td>
                      <td class="amount">$${(parseFloat(m.amount) || 0).toLocaleString()}</td>
                      <td>${m.project?.clientName || 'Unknown Client'}</td>
                    </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              ` : ''}
              
              ${upcomingMilestones.length > 0 ? `
              <h3 style="color: #f39c12;">📅 Upcoming Milestones (4-14 days)</h3>
              <table class="milestone-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Milestone</th>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Client</th>
                  </tr>
                </thead>
                <tbody>
                  ${upcomingMilestones.map(m => {
                    const dueDate = new Date(m.dueDate);
                    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return `
                    <tr class="upcoming">
                      <td>${m.project?.name || 'Unknown Project'}</td>
                      <td>${m.name}</td>
                      <td>${dueDate.toLocaleDateString()} (${daysUntilDue} days)</td>
                      <td class="amount">$${(parseFloat(m.amount) || 0).toLocaleString()}</td>
                      <td>${m.project?.clientName || 'Unknown Client'}</td>
                    </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              ` : ''}
              
              <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h4>💡 Recommended Actions:</h4>
                <ul>
                  <li>Review each milestone and verify completion status</li>
                  <li>Contact clients for any pending deliverables</li>
                  <li>Prepare and send invoices for completed milestones</li>
                  <li>Follow up on overdue payments</li>
                  <li>Update payment status in the system</li>
                </ul>
              </div>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || process.env.CLIENT_URL}/dashboard" class="button">
                  View Finance Dashboard
                </a>
                <a href="${process.env.FRONTEND_URL || process.env.CLIENT_URL}/projects" class="button">
                  Review Projects
                </a>
              </p>
              
              <p style="font-size: 12px; color: #666; margin-top: 30px;">
                This automated alert helps you stay on top of financial deadlines. For questions, contact your administrator.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        ${subject}
        
        Hello ${financeHeadName},
        
        You have ${milestones.length} milestone payments that require processing.
        
        Summary:
        - Total Milestones: ${milestones.length}
        - Total Amount: $${totalAmount.toLocaleString()}
        - Urgent (≤3 days): ${urgentMilestones.length}
        - Upcoming (4-14 days): ${upcomingMilestones.length}
        
        ${urgentMilestones.length > 0 ? `
        URGENT MILESTONES (≤3 days):
        ${urgentMilestones.map(m => {
          const dueDate = new Date(m.dueDate);
          const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return `- ${m.project?.name || 'Unknown'}: ${m.name} - Due: ${dueDate.toLocaleDateString()} (${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}) - $${(parseFloat(m.amount) || 0).toLocaleString()}`;
        }).join('\n        ')}
        ` : ''}
        
        ${upcomingMilestones.length > 0 ? `
        UPCOMING MILESTONES (4-14 days):
        ${upcomingMilestones.map(m => {
          const dueDate = new Date(m.dueDate);
          const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return `- ${m.project?.name || 'Unknown'}: ${m.name} - Due: ${dueDate.toLocaleDateString()} (${daysUntilDue} days) - $${(parseFloat(m.amount) || 0).toLocaleString()}`;
        }).join('\n        ')}
        ` : ''}
        
        Please review and take appropriate action.
        
        Access TaskFlow: ${process.env.FRONTEND_URL || process.env.CLIENT_URL}/dashboard
        
        Best regards,
        TaskFlow Team
      `
    };
    
    try {
      await this.emailSvc.sendEmail(emailTemplate);
      console.log(`Finance deadline email sent to: ${financeHead.email}`);
    } catch (error) {
      console.error('Failed to send finance deadline email:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
