import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Resolve templates relative to the project root
const TEMPLATE_ROOT = path.resolve(process.cwd(), 'server', 'templates');


export interface EmailNotificationData {
  to: string;
  userName: string;
  taskName?: string;
  taskDescription?: string;
  taskUrl?: string;
  updateUrl?: string;
  projectName?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  priorityLabel?: string;
  dueDate?: string;
  feeAmount?: string;
  assignedBy?: string;
  progressPercent?: number;
  isUrgent?: boolean;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  logoUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

export class EmailService {
  private transporter?: nodemailer.Transporter;
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private isConfigured: boolean = false;

  constructor() {
    this.setupTransporter();
  }

  private setupTransporter() {
    try {
      
      
      if (process.env.EMAIL_PROVIDER === 'gmail') {
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
          console.warn('EmailService: Gmail configuration missing. Email service disabled.');
          return;
        }
        
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
          }
        });

      } else {
        // SMTP configuration for other providers
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
          console.warn('EmailService: SMTP configuration missing. Email service disabled.');
          return;
        }

        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      }

      this.isConfigured = true;
    } catch (error) {
      console.error('EmailService: Failed to configure email service:', error);
    }
  }

  private async loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate | null> {
    try {
      if (this.templates.has(templateName)) {
        return this.templates.get(templateName)!;
      }

      const templatePath = path.join(TEMPLATE_ROOT, `${templateName}.hbs`);
      const templateContent = await readFile(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateContent);
      
      this.templates.set(templateName, compiledTemplate);
      return compiledTemplate;
    } catch (error) {
      console.error(`Failed to load email template ${templateName}:`, error);
      return null;
    }
  }

  private getEmailSubject(type: string, data: EmailNotificationData): string {
    switch (type) {
      case 'taskAssigned':
        return `New Task Assigned: ${data.taskName} - Due ${data.dueDate}`;
      case 'taskDueSoon':
        return `⏰ Reminder: ${data.taskName} due ${data.dueDate}`;
      case 'taskOverdue':
        return `🚨 OVERDUE: ${data.taskName} requires immediate attention`;
      case 'projectDeadline':
        return `📅 Project Deadline Approaching: ${data.projectName}`;
      case 'passwordReset':
        return `🔐 Password Reset Request - TaskFlow`;
      default:
        return `TaskFlow Notification`;
    }
  }

  private enhanceEmailData(data: EmailNotificationData): EmailNotificationData {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    
    return {
      ...data,
      logoUrl: `${baseUrl}/assets/taskflow-logo.png`,
      unsubscribeUrl: data.unsubscribeUrl || `${baseUrl}/unsubscribe`,
      preferencesUrl: data.preferencesUrl || `${baseUrl}/home`,
      priorityLabel: data.priority ? data.priority.charAt(0).toUpperCase() + data.priority.slice(1) : 'Medium',
      isUrgent: data.priority === 'high' || data.priority === 'critical'
    };
  }

  async sendTaskAssignedEmail(data: EmailNotificationData): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn(`EmailService: Email service not configured. Cannot send email to ${data.to}`);
      return false;
    }
    return this.sendTemplatedEmail('taskAssigned', data);
  }

  async sendTaskDueSoonEmail(data: EmailNotificationData): Promise<boolean> {
    return this.sendTemplatedEmail('taskDueSoon', data);
  }

  async sendTaskOverdueEmail(data: EmailNotificationData): Promise<boolean> {
    return this.sendTemplatedEmail('taskOverdue', data);
  }

  async sendProjectDeadlineEmail(data: EmailNotificationData): Promise<boolean> {
    return this.sendTemplatedEmail('projectDeadline', data);
  }

  async sendPasswordResetEmail(data: EmailNotificationData & { resetLink: string }): Promise<boolean> {
    return this.sendTemplatedEmail('passwordReset', data);
  }

  private async sendTemplatedEmail(templateName: string, data: EmailNotificationData): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn(`Email service not configured. Skipping ${templateName} email to ${data.to}`);
      return false;
    }

    try {
      const template = await this.loadTemplate(templateName);
      if (!template) {
        console.error(`Template ${templateName} not found`);
        return false;
      }

      const enhancedData = this.enhanceEmailData(data);
      const htmlContent = template(enhancedData);
      const subject = this.getEmailSubject(templateName, enhancedData);

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'TaskFlow <noreply@taskflow.com>',
        to: data.to,
        subject: subject,
        html: htmlContent,
        // Add text version for better deliverability
        text: this.generateTextVersion(templateName, enhancedData)
      };

      await this.transporter!.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error(`Failed to send ${templateName} email to ${data.to}:`, error);
      return false;
    }
  }

  private generateTextVersion(templateName: string, data: EmailNotificationData): string {
    switch (templateName) {
      case 'taskAssigned':
        return `
Hi ${data.userName}!

You've been assigned a new task: ${data.taskName}
Project: ${data.projectName}
Due Date: ${data.dueDate}
Priority: ${data.priorityLabel}
Fee: KSh ${data.feeAmount}

Description: ${data.taskDescription}

View task details: ${data.taskUrl}
Update progress: ${data.updateUrl}

Best regards,
TaskFlow Team
        `.trim();
      
      case 'taskDueSoon':
        return `
Hi ${data.userName}!

Reminder: Your task "${data.taskName}" is due ${data.dueDate}.
Project: ${data.projectName}
Priority: ${data.priorityLabel}

Please update your progress: ${data.updateUrl}

Best regards,
TaskFlow Team
        `.trim();
      
      case 'taskOverdue':
        return `
Hi ${data.userName}!

URGENT: Your task "${data.taskName}" is now overdue.
Project: ${data.projectName}
Original Due Date: ${data.dueDate}

Please update this task immediately: ${data.updateUrl}

Best regards,
TaskFlow Team
        `.trim();
      
      case 'passwordReset':
        return `
Hi ${data.userName}!

You requested a password reset for your TaskFlow account.

Click the link below to reset your password:
${(data as any).resetLink}

This link will expire in 1 hour for security reasons.

If you didn't request this reset, please ignore this email.

Best regards,
TaskFlow Team
        `.trim();
      
      default:
        return `TaskFlow Notification for ${data.userName}`;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.transporter!.verify();
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }

  // Generic email sending method for custom emails
  async sendEmail(options: { to: string; subject: string; text?: string; html?: string }): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn(`EmailService: Email service not configured. Cannot send email to ${options.to}`);
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'TaskFlow <noreply@taskflow.com>',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      await this.transporter!.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error(`Failed to send email to ${options.to}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
