/**
 * Timezone utilities for Kenya/Nairobi timezone
 */

export const KENYA_TIMEZONE = 'Africa/Nairobi';

/**
 * Get current time in Kenya timezone
 */
export function getKenyaTime(): Date {
  return new Date();
}

/**
 * Format date for Kenya timezone display
 */
export function formatKenyaTime(date: Date): string {
  return date.toLocaleString('en-KE', {
    timeZone: KENYA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Convert UTC date to Kenya timezone
 */
export function toKenyaTime(utcDate: Date): Date {
  // Create a new date object and adjust for Kenya timezone (UTC+3)
  const kenyaTime = new Date(utcDate.getTime() + (3 * 60 * 60 * 1000));
  return kenyaTime;
}

/**
 * Format date for Kenya timezone display (server-side)
 */
export function formatKenyaTimeServer(date: Date): string {
  const kenyaTime = toKenyaTime(date);
  return kenyaTime.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Get Kenya timezone offset in minutes
 */
export function getKenyaTimezoneOffset(): number {
  const now = new Date();
  const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  const kenya = new Date(utc.getTime() + (3 * 3600000)); // UTC+3
  return (kenya.getTime() - now.getTime()) / 60000;
}
