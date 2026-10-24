import type { SubscriptionStatus } from './types.js';

export function hasAccess(status: SubscriptionStatus | null, now: Date): boolean {
  if (status === null || status.state === 'none' || status.state === 'expired') {
    return false;
  }
  const instant = now.getTime();
  if (Number.isNaN(instant)) {
    return false;
  }
  return instant < Date.parse(status.currentPeriodEnd);
}
