import type { Entitlement, EntitlementUpdate, IsoInstant, UserId } from './types.js';

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
    readonly latestOccurredAt: IsoInstant | null;
  },
  update: EntitlementUpdate,
): UpdateDecision {
  if (input.seenEvent) {
    return 'duplicate';
  }
  if (input.latestOccurredAt !== null && update.occurredAt <= input.latestOccurredAt) {
    return 'stale';
  }
  return 'apply';
}

export function reduceEntitlement(
  current: Entitlement | null,
  seenEvent: boolean,
  update: EntitlementUpdate,
): Reduction {
  const decision = decideEntitlementUpdate(
    {
      seenEvent,
      latestOccurredAt: current?.occurredAt ?? null,
    },
    update,
  );
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
