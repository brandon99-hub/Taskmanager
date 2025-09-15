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

  // Billing status to progress percentage mapping (weighted by priority)
  const getBillingStatusProgress = (billingStatus: string, priority: string): number => {
    let baseProgress = 0;
    
    // Base progress based on billing status
    switch (billingStatus) {
      case 'none':
      case 'to_send':
        baseProgress = 0;
        break;
      case 'sent':
        baseProgress = 50; // Sent milestone is 50% complete
        break;
      case 'paid':
        baseProgress = 100; // Paid milestone is 100% complete
        break;
      case 'overdue':
        baseProgress = 25; // Overdue milestone has some progress
        break;
      case 'processing':
        baseProgress = 75; // Processing milestone is almost complete
        break;
      default:
        baseProgress = 0;
    }
    
    // Apply priority weighting to billing status progress
    let priorityWeight = 1; // default weight
    switch (priority) {
      case 'low':
        priorityWeight = 0.8; // Low priority gets 80% of base progress
        break;
      case 'medium':
        priorityWeight = 1.0; // Medium priority gets full base progress
        break;
      case 'high':
        priorityWeight = 1.2; // High priority gets 120% of base progress
        break;
      case 'critical':
        priorityWeight = 1.5; // Critical priority gets 150% of base progress
        break;
    }
    
    // Apply priority weight but cap at 100%
    return Math.min(100, Math.round(baseProgress * priorityWeight));
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
    
    // Calculate weighted progress based on status and billing status
    let statusProgress = getStatusProgress(milestone.status);
    
    // For milestones, also consider billing status (milestones from /api/milestones always have billingStatus)
    if (milestone.billingStatus) {
      const billingProgress = getBillingStatusProgress(milestone.billingStatus, milestone.priority);
      // Use the higher of the two progress values
      statusProgress = Math.max(statusProgress, billingProgress);
    }
    
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

/**
 * Calculate comprehensive project progress combining milestones and subtasks
 * @param milestones Array of milestones with priority, status, and billingStatus fields
 * @param subtasks Array of subtasks with priority and status fields
 * @returns Combined progress percentage (0-100)
 */
export function calculateProjectProgress(milestones: any[], subtasks: any[]): number {
  if ((!milestones || milestones.length === 0) && (!subtasks || subtasks.length === 0)) return 0;
  
  // Calculate milestone progress (weighted by priority)
  const milestoneProgress = calculateWeightBasedProgress(milestones || []);
  const milestoneWeight = milestones?.length || 0;
  
  // Calculate subtask progress (weighted by priority)
  const subtaskProgress = calculateSubtaskWeightBasedProgress(subtasks || []);
  const subtaskWeight = subtasks?.length || 0;
  
  // If we only have one type of data, return that progress
  if (milestoneWeight === 0) return subtaskProgress;
  if (subtaskWeight === 0) return milestoneProgress;
  
  // Combine both with equal weighting (50% milestones, 50% subtasks)
  // This gives a balanced view of both high-level progress (milestones) and detailed progress (subtasks)
  const combinedProgress = Math.round((milestoneProgress + subtaskProgress) / 2);
  
  return combinedProgress;
}
