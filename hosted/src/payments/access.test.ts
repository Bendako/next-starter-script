import { describe, expect, it } from 'vitest';

import { hasAccess } from './access.js';
import { activeSubscription, cancelAtPeriodEnd, expiredSubscription, isoInstant, planId } from './types.js';

const plan = planId('plan_contract');
const periodEnd = isoInstant('2026-04-01T00:00:00.000Z');
const beforeEnd = new Date('2026-03-31T23:59:59.999Z');
const atEnd = new Date('2026-04-01T00:00:00.000Z');
const afterEnd = new Date('2026-04-01T00:00:00.001Z');

const active = activeSubscription({
  planId: plan,
  currentPeriodStart: isoInstant('2026-03-01T00:00:00.000Z'),
  currentPeriodEnd: periodEnd,
});

const ending = cancelAtPeriodEnd({
  planId: plan,
  currentPeriodStart: isoInstant('2026-03-01T00:00:00.000Z'),
  currentPeriodEnd: periodEnd,
});

const expired = expiredSubscription({
  planId: plan,
  currentPeriodEnd: periodEnd,
});

describe('hasAccess', () => {
  it('allows active and cancel-at-period-end only before the period end', () => {
    expect(hasAccess(active, beforeEnd)).toBe(true);
    expect(hasAccess(ending, beforeEnd)).toBe(true);
    expect(hasAccess(active, atEnd)).toBe(false);
    expect(hasAccess(ending, atEnd)).toBe(false);
    expect(hasAccess(active, afterEnd)).toBe(false);
    expect(hasAccess(ending, afterEnd)).toBe(false);
  });

  it('denies expired, none, null, and an invalid clock', () => {
    expect(hasAccess(expired, beforeEnd)).toBe(false);
    expect(hasAccess({ state: 'none' }, beforeEnd)).toBe(false);
    expect(hasAccess(null, beforeEnd)).toBe(false);
    expect(hasAccess(active, new Date(Number.NaN))).toBe(false);
  });
});
