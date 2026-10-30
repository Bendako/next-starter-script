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
  readonly pastDueAt: string | null;
};

const STATUS_KIND = {
  incomplete: 'pending',
  incomplete_expired: 'ended',
  trialing: 'access',
  active: 'access',
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
  if (kind === undefined) {
    throw new InvalidWebhookPayloadError();
  }
  if (kind === 'pending') {
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
  readonly pastDueGraceSeconds: number;
}): readonly NormalizedWebhookEvent[] {
  const updates: NormalizedWebhookEvent[] = [];
  for (const subscription of input.subscriptions) {
    const update = mapOne(
      input.eventId,
      input.occurredAt,
      subscription,
      input.productPlans,
      input.pastDueGraceSeconds,
    );
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
  pastDueGraceSeconds: number,
): NormalizedWebhookEvent | null {
  try {
    const mapped = toSubscription(subscription, occurredAt, productPlans, pastDueGraceSeconds);
    if (mapped === null || subscription.externalCustomerId === null) {
      return null;
    }
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

function toSubscription(
  subscription: PolarSubscriptionFields,
  occurredAt: string,
  productPlans: ReadonlyMap<string, PlanId>,
  pastDueGraceSeconds: number,
): Subscription | null {
  if (subscription.status === 'past_due') {
    const plan = knownPlan(subscription, productPlans);
    if (plan === null) {
      return null;
    }
    return pastDueSubscription(plan, subscription, occurredAt, pastDueGraceSeconds);
  }
  const state = mapPolarStatus(subscription.status, subscription.cancelAtPeriodEnd);
  if (state === null) {
    return null;
  }
  const plan = knownPlan(subscription, productPlans);
  if (plan === null) {
    return null;
  }
  const periodEnd = instant(subscription.currentPeriodEnd);
  const periodStart = instant(subscription.currentPeriodStart);
  if (state === 'expired') {
    return expiredSubscription({ planId: plan, currentPeriodEnd: periodEnd });
  }
  if (state === 'active') {
    return activeSubscription({
      planId: plan,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });
  }
  return cancelAtPeriodEnd({
    planId: plan,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  });
}

function knownPlan(
  subscription: PolarSubscriptionFields,
  productPlans: ReadonlyMap<string, PlanId>,
): PlanId | null {
  if (subscription.externalCustomerId === null) {
    return null;
  }
  return productPlans.get(subscription.productId) ?? null;
}

function pastDueSubscription(
  plan: PlanId,
  subscription: PolarSubscriptionFields,
  occurredAt: string,
  graceSeconds: number,
): Subscription {
  const pastDueAt = instant(subscription.pastDueAt ?? occurredAt);
  const periodStart = instant(subscription.currentPeriodStart);
  const periodEnd = instant(subscription.currentPeriodEnd);
  const pastDueMs = Date.parse(pastDueAt);
  const deadlineMs = pastDueMs + graceSeconds * 1000;
  // Polar opens the next period before the charge lands, so current_period_end is the unpaid period.
  const capMs = Math.min(deadlineMs, Date.parse(periodEnd));
  const cap = instant(new Date(capMs).toISOString());
  if (capMs <= pastDueMs || Date.parse(periodStart) > capMs) {
    return expiredSubscription({ planId: plan, currentPeriodEnd: cap });
  }
  return activeSubscription({
    planId: plan,
    currentPeriodStart: periodStart,
    currentPeriodEnd: cap,
  });
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
