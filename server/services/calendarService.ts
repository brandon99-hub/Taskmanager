import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

interface CalendarEventData {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  reminderMinutes?: number;
  attendees?: string[];
}

interface CalendarCredentials {
  accessToken: string;
  refreshToken: string;
}

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Generate OAuth2 authorization URL
   */
  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<CalendarCredentials> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to obtain required tokens');
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to authenticate with Google Calendar');
    }
  }

  /**
   * Set credentials for API calls
   */
  setCredentials(credentials: CalendarCredentials): void {
    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken
    });
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      return credentials.access_token;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh Google Calendar access');
    }
  }

  /**
   * Get user's primary calendar ID and info
   */
  async getUserCalendarInfo(): Promise<{ id: string; summary: string; timeZone: string }> {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const response = await calendar.calendars.get({
        calendarId: 'primary'
      });

      const calendarData = response.data;
      
      return {
        id: calendarData.id || 'primary',
        summary: calendarData.summary || 'Primary Calendar',
        timeZone: calendarData.timeZone || 'UTC'
      };
    } catch (error) {
      console.error('Error getting calendar info:', error);
      throw new Error('Failed to get calendar information');
    }
  }

  /**
   * Create a calendar event for a task deadline
   */
  async createTaskEvent(eventData: CalendarEventData, calendarId: string = 'primary'): Promise<string> {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const event = {
        summary: eventData.summary,
        description: eventData.description,
        start: {
          dateTime: eventData.start.toISOString(),
          timeZone: 'Africa/Nairobi', // Kenya timezone
        },
        end: {
          dateTime: eventData.end.toISOString(),
          timeZone: 'Africa/Nairobi',
        },
        attendees: eventData.attendees?.map(email => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: eventData.reminderMinutes || 60 },
            { method: 'popup', minutes: eventData.reminderMinutes || 60 }
          ]
        },
        // Add TaskFlow branding
        source: {
          title: 'TaskFlow',
          url: process.env.FRONTEND_URL || 'http://localhost:5000'
        }
      };

      const response = await calendar.events.insert({
        calendarId: calendarId,
        requestBody: event,
        sendUpdates: 'none' // Don't send email notifications (we handle our own)
      });

      if (!response.data.id) {
        throw new Error('No event ID returned from Google Calendar');
      }

      console.log(`Calendar event created successfully: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateTaskEvent(
    eventId: string, 
    eventData: CalendarEventData, 
    calendarId: string = 'primary'
  ): Promise<void> {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const event = {
        summary: eventData.summary,
        description: eventData.description,
        start: {
          dateTime: eventData.start.toISOString(),
          timeZone: 'Africa/Nairobi',
        },
        end: {
          dateTime: eventData.end.toISOString(),
          timeZone: 'Africa/Nairobi',
        },
        attendees: eventData.attendees?.map(email => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: eventData.reminderMinutes || 60 },
            { method: 'popup', minutes: eventData.reminderMinutes || 60 }
          ]
        }
      };

      await calendar.events.update({
        calendarId: calendarId,
        eventId: eventId,
        requestBody: event,
        sendUpdates: 'none'
      });

      console.log(`Calendar event updated successfully: ${eventId}`);
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteTaskEvent(eventId: string, calendarId: string = 'primary'): Promise<void> {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      await calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId,
        sendUpdates: 'none'
      });

      console.log(`Calendar event deleted successfully: ${eventId}`);
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      // Don't throw error for deletion failures - event might already be deleted
      console.warn(`Failed to delete calendar event ${eventId}, continuing...`);
    }
  }

  /**
   * Check if the connection is valid
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getUserCalendarInfo();
      return true;
    } catch (error) {
      console.error('Calendar connection test failed:', error);
      return false;
    }
  }

  /**
   * Generate task event data from task information
   */
  static generateTaskEventData(task: any, project: any): CalendarEventData {
    const taskUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/tasks/${task.id}`;
    
    // Set event time to 2 hours before due date, or 9 AM if due date is earlier
    const dueDate = new Date(task.dueDate);
    const eventStart = new Date(dueDate);
    eventStart.setHours(Math.max(9, dueDate.getHours() - 2), 0, 0, 0);
    
    const eventEnd = new Date(eventStart);
    eventEnd.setHours(eventStart.getHours() + 1); // 1 hour duration

    const description = `
TaskFlow Milestone Deadline

Project: ${project.name}
Task: ${task.name}
${task.description ? `\nDescription: ${task.description}` : ''}
Due Date: ${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString()}
Priority: ${task.priority}
${task.feeAmount ? `Fee: KSh ${task.feeAmount}` : ''}

View task details: ${taskUrl}

Managed by TaskFlow - AppKings Solutions Limited
    `.trim();

    return {
      summary: `TaskFlow: ${task.name}`,
      description: description,
      start: eventStart,
      end: eventEnd,
      reminderMinutes: 60, // Default 1 hour reminder
      attendees: task.assignedUser ? [task.assignedUser.email] : []
    };
  }

  /**
   * Encrypt token for database storage
   */
  static encryptToken(token: string): string {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET required for token encryption');
    }
    
    const cipher = crypto.createCipher('aes-256-cbc', process.env.JWT_SECRET);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt token from database storage
   */
  static decryptToken(encryptedToken: string): string {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET required for token decryption');
    }
    
    const decipher = crypto.createDecipher('aes-256-cbc', process.env.JWT_SECRET);
    let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// Export singleton instance
export const calendarService = new GoogleCalendarService();
