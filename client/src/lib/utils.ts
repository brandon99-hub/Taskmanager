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
 * Calculate weight-based progress for milestones based on priority and completion status
 * @param milestones Array of milestones with priority and status fields
 * @returns Progress percentage (0-100)
 */
export function calculateWeightBasedProgress(milestones: any[]): number {
  if (!milestones || milestones.length === 0) return 0;
  
  let totalWeight = 0;
  let completedWeight = 0;
  
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
    
    // If milestone is completed, add its weight to completed total
    if (milestone.status === 'done') {
      completedWeight += weight;
    }
  });
  
  return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
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
  
  subtasks.forEach((subtask: any) => {
    const priorityWeight = priorityWeights[subtask.priority] || 1;
    
    const progress = subtask.status === 'finished' ? 100 : 
                    subtask.status === 'ongoing' ? 75 :
                    subtask.status === 'in_progress' ? 25 : 0;
    
    totalWeight += priorityWeight;
    weightedProgress += (progress * priorityWeight);
  });
  
  return totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
}
