import type { Entitlement, EntitlementUpdate, SubscriptionStatus, UserId } from './types.js';

// Providers often stamp several events in the same second. At that instant the
// stricter state wins, so a lost ordering cannot leave access in place.
// expired has ended. cancel_at_period_end will not renew. active still renews.
// none has no subscription. The same state then keeps the later period end.
const RESTRICTIVENESS = {
  none: 0,
  active: 1,
  cancel_at_period_end: 2,
  expired: 3,
} as const satisfies Record<SubscriptionStatus['state'], number>;

export type ApplyResult = {
  readonly applied: number;
  readonly duplicates: number;
  readonly stale: number;
};

export type UpdateDecision = 'apply' | 'duplicate' | 'stale';

export type Reduction =
  | {
      readonly decision: 'duplicate';
      readonly entitlement: Entitlement | null;
    }
  | {
      readonly decision: 'stale';
      readonly entitlement: Entitlement | null;
    }
  | {
      readonly decision: 'apply';
      readonly entitlement: Entitlement;
    };

export interface EntitlementStore {
  applyUpdates(updates: readonly EntitlementUpdate[]): Promise<ApplyResult>;
  getEntitlement(userId: UserId): Promise<Entitlement | null>;
}

export function decideEntitlementUpdate(
  input: {
    readonly seenEvent: boolean;
    readonly current: Entitlement | null;
  },
  update: EntitlementUpdate,
): UpdateDecision {
  if (input.seenEvent) {
    return 'duplicate';
  }
  if (input.current === null) {
    return 'apply';
  }
  if (update.occurredAt < input.current.occurredAt) {
    return 'stale';
  }
  if (update.occurredAt > input.current.occurredAt) {
    return 'apply';
  }
  return sameInstantDecision(input.current, update);
}

export function reduceEntitlement(
  current: Entitlement | null,
  seenEvent: boolean,
  update: EntitlementUpdate,
): Reduction {
  const decision = decideEntitlementUpdate({ seenEvent, current }, update);
  if (decision === 'duplicate') {
    return { decision, entitlement: current };
  }
  if (decision === 'stale') {
    return { decision, entitlement: current };
  }
  return {
    decision: 'apply',
    entitlement: {
      userId: update.userId,
      occurredAt: update.occurredAt,
      subscription: copySubscription(update.subscription),
    },
  };
}

function sameInstantDecision(current: Entitlement, update: EntitlementUpdate): UpdateDecision {
  const currentRank = RESTRICTIVENESS[current.subscription.state];
  const nextRank = RESTRICTIVENESS[update.subscription.state];
  if (nextRank > currentRank) {
    return 'apply';
  }
  if (nextRank < currentRank) {
    return 'stale';
  }
  if (update.subscription.currentPeriodEnd > current.subscription.currentPeriodEnd) {
    return 'apply';
  }
  return 'stale';
}

function copySubscription(subscription: EntitlementUpdate['subscription']): EntitlementUpdate['subscription'] {
  switch (subscription.state) {
    case 'active':
      return {
        state: 'active',
        planId: subscription.planId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      };
    case 'cancel_at_period_end':
      return {
        state: 'cancel_at_period_end',
        planId: subscription.planId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      };
    case 'expired':
      return {
        state: 'expired',
        planId: subscription.planId,
        currentPeriodEnd: subscription.currentPeriodEnd,
      };
    default: {
      const unreachable: never = subscription;
      return unreachable;
    }
  }
}
