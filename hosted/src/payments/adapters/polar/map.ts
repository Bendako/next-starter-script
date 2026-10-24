import { InvalidIdentifierError, InvalidPeriodError, InvalidWebhookPayloadError } from '../../errors.js';
import {
  activeSubscription,
  cancelAtPeriodEnd,
  eventId,
  expiredSubscription,
  isoInstant,
  userId,
  type NormalizedWebhookEvent,
  type PlanId,
  type Subscription,
} from '../../types.js';

export type PolarSubscriptionFields = {
  readonly productId: string;
  readonly status: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly externalCustomerId: string | null;
};

const STATUS_KIND = {
  incomplete: 'pending',
  incomplete_expired: 'ended',
  trialing: 'access',
  active: 'access',
  past_due: 'access',
  canceled: 'ended',
  unpaid: 'ended',
  paused: 'ended',
  granted: 'access',
  disabled: 'ended',
} as const satisfies Record<string, 'pending' | 'access' | 'ended'>;

export function mapPolarStatus(
  status: string,
  cancelAtPeriodEndFlag: boolean,
): Subscription['state'] | null {
  const kind = STATUS_KIND[status as keyof typeof STATUS_KIND];
  if (kind === undefined || kind === 'pending') {
    return null;
  }
  if (kind === 'ended') {
    return 'expired';
  }
  return cancelAtPeriodEndFlag ? 'cancel_at_period_end' : 'active';
}

export function mapPolarSubscriptions(input: {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly subscriptions: readonly PolarSubscriptionFields[];
  readonly productPlans: ReadonlyMap<string, PlanId>;
}): readonly NormalizedWebhookEvent[] {
  const updates: NormalizedWebhookEvent[] = [];
  for (const subscription of input.subscriptions) {
    const update = mapOne(input.eventId, input.occurredAt, subscription, input.productPlans);
    if (update !== null) {
      updates.push(update);
    }
  }
  const chosen = choose(updates);
  return chosen === null ? [] : [chosen];
}

function mapOne(
  rawEventId: string,
  occurredAt: string,
  subscription: PolarSubscriptionFields,
  productPlans: ReadonlyMap<string, PlanId>,
): NormalizedWebhookEvent | null {
  const plan = productPlans.get(subscription.productId);
  if (plan === undefined || subscription.externalCustomerId === null) {
    return null;
  }
  const state = mapPolarStatus(subscription.status, subscription.cancelAtPeriodEnd);
  if (state === null) {
    return null;
  }
  try {
    const periodEnd = instant(subscription.currentPeriodEnd);
    const periodStart = instant(subscription.currentPeriodStart);
    const mapped =
      state === 'expired'
        ? expiredSubscription({ planId: plan, currentPeriodEnd: periodEnd })
        : state === 'active'
          ? activeSubscription({
              planId: plan,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            })
          : cancelAtPeriodEnd({
              planId: plan,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            });
    return {
      eventId: eventId(rawEventId),
      occurredAt: instant(occurredAt),
      userId: userId(subscription.externalCustomerId),
      subscription: mapped,
    };
  } catch (error) {
    if (
      error instanceof InvalidIdentifierError ||
      error instanceof InvalidPeriodError ||
      error instanceof InvalidWebhookPayloadError
    ) {
      throw new InvalidWebhookPayloadError();
    }
    throw error;
  }
}

function instant(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidWebhookPayloadError();
  }
  return isoInstant(parsed.toISOString());
}

function choose(updates: readonly NormalizedWebhookEvent[]): NormalizedWebhookEvent | null {
  let best: NormalizedWebhookEvent | null = null;
  for (const update of updates) {
    if (best === null || beats(update, best)) {
      best = update;
    }
  }
  return best;
}

function beats(candidate: NormalizedWebhookEvent, current: NormalizedWebhookEvent): boolean {
  if (candidate.subscription.currentPeriodEnd !== current.subscription.currentPeriodEnd) {
    return candidate.subscription.currentPeriodEnd > current.subscription.currentPeriodEnd;
  }
  return accessRank(candidate.subscription.state) < accessRank(current.subscription.state);
}

function accessRank(state: Subscription['state']): number {
  if (state === 'active') {
    return 0;
  }
  if (state === 'cancel_at_period_end') {
    return 1;
  }
  return 2;
}
