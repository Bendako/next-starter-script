import { InvalidIdentifierError, InvalidPeriodError } from './errors.js';

declare const brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;
export type PlanId = Brand<string, 'PlanId'>;
export type EventId = Brand<string, 'EventId'>;
export type IsoInstant = Brand<string, 'IsoInstant'>;

function brandedId<B extends string>(value: string, kind: 'user' | 'plan' | 'event'): Brand<string, B> {
  if (value.length === 0 || /\s/u.test(value)) {
    throw new InvalidIdentifierError(kind);
  }
  return value as Brand<string, B>;
}

export function userId(value: string): UserId {
  return brandedId(value, 'user');
}

export function planId(value: string): PlanId {
  return brandedId(value, 'plan');
}

export function eventId(value: string): EventId {
  return brandedId(value, 'event');
}

export function isoInstant(value: string): IsoInstant {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new InvalidIdentifierError('instant');
  }
  return value as IsoInstant;
}

export type Customer = {
  readonly userId: UserId;
};

export type Plan = {
  readonly id: PlanId;
};

export type ActiveSubscription = {
  readonly state: 'active';
  readonly planId: PlanId;
  readonly currentPeriodStart: IsoInstant;
  readonly currentPeriodEnd: IsoInstant;
};

export type CancelAtPeriodEnd = {
  readonly state: 'cancel_at_period_end';
  readonly planId: PlanId;
  readonly currentPeriodStart: IsoInstant;
  readonly currentPeriodEnd: IsoInstant;
};

export type ExpiredSubscription = {
  readonly state: 'expired';
  readonly planId: PlanId;
  readonly currentPeriodEnd: IsoInstant;
};

export type Subscription = ActiveSubscription | CancelAtPeriodEnd | ExpiredSubscription;

export type SubscriptionStatus = { readonly state: 'none' } | Subscription;

export type CheckoutSession = {
  readonly url: string;
  readonly customer: Customer;
  readonly plan: Plan;
};

export type CustomerPortalSession = {
  readonly url: string;
  readonly customer: Customer;
};

export type NormalizedWebhookEvent = {
  readonly eventId: EventId;
  readonly occurredAt: IsoInstant;
  readonly userId: UserId;
  readonly subscription: Subscription;
};

export type EntitlementUpdate = NormalizedWebhookEvent;

export type Entitlement = {
  readonly userId: UserId;
  readonly occurredAt: IsoInstant;
  readonly subscription: Subscription;
};

export function activeSubscription(input: {
  readonly planId: PlanId;
  readonly currentPeriodStart: IsoInstant;
  readonly currentPeriodEnd: IsoInstant;
}): ActiveSubscription {
  assertPeriod(input.currentPeriodStart, input.currentPeriodEnd);
  return {
    state: 'active',
    planId: input.planId,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
  };
}

export function cancelAtPeriodEnd(input: {
  readonly planId: PlanId;
  readonly currentPeriodStart: IsoInstant;
  readonly currentPeriodEnd: IsoInstant;
}): CancelAtPeriodEnd {
  assertPeriod(input.currentPeriodStart, input.currentPeriodEnd);
  return {
    state: 'cancel_at_period_end',
    planId: input.planId,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
  };
}

export function expiredSubscription(input: {
  readonly planId: PlanId;
  readonly currentPeriodEnd: IsoInstant;
}): ExpiredSubscription {
  return {
    state: 'expired',
    planId: input.planId,
    currentPeriodEnd: input.currentPeriodEnd,
  };
}

function assertPeriod(start: IsoInstant, end: IsoInstant): void {
  if (start > end) {
    throw new InvalidPeriodError();
  }
}
