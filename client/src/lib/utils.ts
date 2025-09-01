import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency amount in Kenyan Shillings (KSh)
 * @param amount Amount to format
 * @returns Formatted currency string
 */
export function formatCurrency(amount: string | number | undefined): string {
  if (amount === undefined || amount === null) return 'KSh 0';
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return 'KSh 0';
  return `KSh ${numAmount.toLocaleString()}`;
}

/**
 * Calculate weight-based progress for milestones based on priority and status progression
 * @param milestones Array of milestones with priority and status fields
 * @returns Progress percentage (0-100)
 */
export function calculateWeightBasedProgress(milestones: any[]): number {
  if (!milestones || milestones.length === 0) return 0;
  
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
  
  milestones.forEach((milestone: any) => {
    // Calculate weight based on priority
    let weight = 2; // default medium weight
    switch (milestone.priority) {
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
    const statusProgress = getStatusProgress(milestone.status);
    weightedProgress += (statusProgress * weight);
  });
  
  return totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
}

/**
 * Calculate weight-based progress for subtasks within a milestone
 * @param subtasks Array of subtasks with priority and status fields
 * @returns Progress percentage (0-100)
 */
export function calculateSubtaskWeightBasedProgress(subtasks: any[]): number {
  if (!subtasks || subtasks.length === 0) return 0;
  
  let totalWeight = 0;
  let weightedProgress = 0;
  
  const priorityWeights: Record<string, number> = {
    'low': 1,
    'medium': 2,
    'high': 3,
    'critical': 4
  };
  
  // Status to progress percentage mapping (same as milestones)
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
      case 'finished':
        return 100;
      case 'on_hold':
        return 10; // Minimal progress for on hold items
      case 'cancelled':
        return 0;
      default:
        return 0;
    }
  };
  
  subtasks.forEach((subtask: any) => {
    const priorityWeight = priorityWeights[subtask.priority] || 1;
    const statusProgress = getStatusProgress(subtask.status);
    
    totalWeight += priorityWeight;
    weightedProgress += (statusProgress * priorityWeight);
  });
  
  return totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
}
