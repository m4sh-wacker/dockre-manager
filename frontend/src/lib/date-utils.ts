import { 
  addDays, 
  addMonths, 
  format, 
  formatDistanceToNow,
  differenceInDays,
  differenceInHours,
  differenceInMinutes
} from 'date-fns';

export type DurationUnit = 'days' | 'months';

export interface DurationConfig {
  value: number;
  unit: DurationUnit;
}

/**
 * Calculate expiration date from now
 */
export function calculateExpirationDate(duration: DurationConfig): Date {
  const now = new Date();
  if (duration.unit === 'days') {
    return addDays(now, duration.value);
  } else {
    return addMonths(now, duration.value);
  }
}

/**
 * Extend an existing expiration date
 */
export function extendExpirationDate(currentExpiration: Date, duration: DurationConfig): Date {
  if (duration.unit === 'days') {
    return addDays(currentExpiration, duration.value);
  } else {
    return addMonths(currentExpiration, duration.value);
  }
}

/**
 * Format date for display (e.g., "Oct 25, 2026")
 */
export function formatExpirationDate(date: Date): string {
  return format(date, 'MMM d, yyyy');
}

/**
 * Format date with time (e.g., "Oct 25, 2026 at 2:30 PM")
 */
export function formatExpirationDateTime(date: Date): string {
  return format(date, 'MMM d, yyyy \'at\' h:mm a');
}

/**
 * Calculate remaining time and return formatted string
 */
export function getTimeRemaining(expiresAt: Date): {
  text: string;
  isUrgent: boolean;
  isCritical: boolean;
  totalHours: number;
} {
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return {
      text: 'Expired',
      isUrgent: true,
      isCritical: true,
      totalHours: 0,
    };
  }
  
  const days = differenceInDays(expiresAt, now);
  const hours = differenceInHours(expiresAt, now) % 24;
  const minutes = differenceInMinutes(expiresAt, now) % 60;
  
  const totalHours = differenceInHours(expiresAt, now);
  const isCritical = totalHours < 24;
  const isUrgent = totalHours < 72;
  
  let text = '';
  
  if (days > 0) {
    text = `${days}d ${hours}h left`;
  } else if (hours > 0) {
    text = `${hours}h ${minutes}m left`;
  } else {
    text = `${minutes}m left`;
  }
  
  return {
    text,
    isUrgent,
    isCritical,
    totalHours,
  };
}

/**
 * Get relative time string (e.g., "in 29 days")
 */
export function getRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}
