/**
 * Centralized date utility functions to eliminate duplication
 */

export interface DateDifference {
  days: number;
  hours: number;
  minutes: number;
  isOverdue: boolean;
  isPast: boolean;
}

/**
 * Calculate the difference between now and a target date
 */
export function getDateDifference(targetDate: string | Date): DateDifference {
  const now = new Date();
  const target = new Date(targetDate);
  const diffTime = target.getTime() - now.getTime();
  
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const hours = Math.ceil(diffTime / (1000 * 60 * 60));
  const minutes = Math.ceil(diffTime / (1000 * 60));
  
  return {
    days,
    hours,
    minutes,
    isOverdue: diffTime < 0,
    isPast: target < now
  };
}

/**
 * Format a due date in a human-readable way
 */
export function formatDueDate(dueDate: string | Date): string {
  const diff = getDateDifference(dueDate);
  
  if (diff.isOverdue) {
    const daysPast = Math.abs(diff.days);
    if (daysPast === 1) return 'Yesterday';
    return `${daysPast} days ago`;
  }
  
  if (diff.days === 0) return 'Today';
  if (diff.days === 1) return 'Tomorrow';
  if (diff.days <= 7) return `In ${diff.days} days`;
  
  return new Date(dueDate).toLocaleDateString();
}

/**
 * Format a due date for overdue scenarios
 */
export function formatOverdueDate(dueDate: string | Date): string {
  const diff = getDateDifference(dueDate);
  
  if (!diff.isOverdue) return formatDueDate(dueDate);
  
  const daysPast = Math.abs(diff.days);
  if (daysPast === 0) return 'Due today (overdue)';
  if (daysPast === 1) return 'Due yesterday (1 day overdue)';
  return `Due ${daysPast} days ago (overdue)`;
}

/**
 * Get urgency level based on due date
 */
export function getUrgencyLevel(dueDate: string | Date): 'overdue' | 'critical' | 'warning' | 'normal' {
  const diff = getDateDifference(dueDate);
  
  if (diff.isOverdue) return 'overdue';
  if (diff.days <= 1) return 'critical';
  if (diff.days <= 3) return 'warning';
  return 'normal';
}

/**
 * Get urgency color classes for UI
 */
export function getUrgencyColorClasses(dueDate: string | Date) {
  const level = getUrgencyLevel(dueDate);
  
  const colorMap = {
    overdue: {
      bg: 'bg-red-50 border-red-200',
      dot: 'bg-red-500',
      text: 'text-red-700',
      badge: 'bg-red-100 text-red-800'
    },
    critical: {
      bg: 'bg-orange-50 border-orange-200',
      dot: 'bg-orange-500',
      text: 'text-orange-700',
      badge: 'bg-orange-100 text-orange-800'
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      dot: 'bg-yellow-500',
      text: 'text-yellow-700',
      badge: 'bg-yellow-100 text-yellow-800'
    },
    normal: {
      bg: 'bg-blue-50 border-blue-200',
      dot: 'bg-blue-500',
      text: 'text-blue-700',
      badge: 'bg-blue-100 text-blue-800'
    }
  };
  
  return colorMap[level];
}

/**
 * Format date for display in lists
 */
export function formatDisplayDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format date for export/reports
 */
export function formatExportDate(date: string | Date): string {
  return new Date(date).toLocaleDateString();
}

/**
 * Format relative time (for notifications)
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diffInMinutes = Math.floor((now.getTime() - target.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
}

/**
 * Check if a task should receive a due soon notification
 */
export function shouldSendDueSoonNotification(
  dueDate: string | Date, 
  priority: string = 'medium'
): boolean {
  const diff = getDateDifference(dueDate);
  
  // Don't send notifications for past due tasks
  if (diff.isOverdue) return false;
  
  // Don't send notifications for tasks due too far in the future
  if (diff.days > 14) return false;
  
  // Priority-based notification timing
  const notificationThreshold = priority?.toLowerCase() === 'critical' ? 14 : 7;
  
  return diff.days <= notificationThreshold && diff.days > 0;
}

/**
 * Get notification timing based on priority
 */
export function getNotificationThreshold(priority: string = 'medium'): number {
  switch (priority?.toLowerCase()) {
    case 'critical':
      return 14; // 2 weeks before
    case 'high':
      return 7;  // 1 week before
    case 'medium':
      return 7;  // 1 week before
    case 'low':
      return 7;  // 1 week before
    default:
      return 7;  // Default to 1 week
  }
}
