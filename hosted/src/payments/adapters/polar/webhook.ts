import { webhooks } from '@polar-sh/sdk/2026-10';

import { InvalidWebhookPayloadError, InvalidWebhookSignatureError } from '../../errors.js';
import type { NormalizedWebhookEvent, PlanId } from '../../types.js';
import {
  mapPolarSubscriptions,
  type PolarSubscriptionFields,
} from './map.js';

export async function readPolarWebhook(input: {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly secret: string;
  readonly productPlans: ReadonlyMap<string, PlanId>;
  readonly pastDueGraceSeconds: number;
}): Promise<readonly NormalizedWebhookEvent[]> {
  let event: Awaited<ReturnType<typeof webhooks.validateEvent>>;
  try {
    event = await webhooks.validateEvent(input.rawBody, { ...input.headers }, input.secret);
  } catch (error) {
    if (error instanceof webhooks.PolarWebhookVerificationError) {
      throw new InvalidWebhookSignatureError();
    }
    if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
      return [];
    }
    if (error instanceof webhooks.PolarWebhookError) {
      throw new InvalidWebhookPayloadError();
    }
    throw error;
  }

  const id = headerValue(input.headers, 'webhook-id');
  if (id === undefined || id.length === 0) {
    throw new InvalidWebhookPayloadError();
  }

  return mapPolarSubscriptions({
    eventId: id,
    occurredAt: event.timestamp,
    subscriptions: subscriptionsFrom(event),
    productPlans: input.productPlans,
    pastDueGraceSeconds: input.pastDueGraceSeconds,
  });
}

function subscriptionsFrom(
  event: Awaited<ReturnType<typeof webhooks.validateEvent>>,
): readonly PolarSubscriptionFields[] {
  switch (event.type) {
    case 'customer.state_changed':
      // An empty active_subscriptions list has no plan id, so it cannot expire an entitlement.
      // subscription.revoked carries the plan and is what ends access.
      return customerStateSubscriptions(event.data);
    case 'subscription.created':
    case 'subscription.active':
    case 'subscription.updated':
    case 'subscription.uncanceled':
    case 'subscription.cycled':
    case 'subscription.canceled':
    case 'subscription.past_due':
    case 'subscription.revoked':
    case 'subscription.paused':
    case 'subscription.resumed':
    case 'subscription.migrated':
      return [subscriptionFields(event.data)];
    default:
      return [];
  }
}

function customerStateSubscriptions(data: unknown): readonly PolarSubscriptionFields[] {
  if (!isRecord(data) || !Array.isArray(data.active_subscriptions)) {
    throw new InvalidWebhookPayloadError();
  }
  const externalCustomerId = stringOrNull(data.external_id);
  return data.active_subscriptions.map((subscription) => {
    if (!isRecord(subscription)) {
      throw new InvalidWebhookPayloadError();
    }
    return fieldsFrom(subscription, externalCustomerId);
  });
}

function subscriptionFields(data: unknown): PolarSubscriptionFields {
  if (!isRecord(data) || !isRecord(data.customer)) {
    throw new InvalidWebhookPayloadError();
  }
  return fieldsFrom(data, stringOrNull(data.customer.external_id));
}

function fieldsFrom(data: Record<string, unknown>, externalCustomerId: string | null): PolarSubscriptionFields {
  if (
    typeof data.status !== 'string' ||
    typeof data.product_id !== 'string' ||
    typeof data.cancel_at_period_end !== 'boolean' ||
    typeof data.current_period_start !== 'string' ||
    typeof data.current_period_end !== 'string' ||
    (data.past_due_at !== undefined && data.past_due_at !== null && typeof data.past_due_at !== 'string')
  ) {
    throw new InvalidWebhookPayloadError();
  }
  return {
    productId: data.product_id,
    status: data.status,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    currentPeriodStart: data.current_period_start,
    currentPeriodEnd: data.current_period_end,
    externalCustomerId,
    pastDueAt: typeof data.past_due_at === 'string' ? data.past_due_at : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function headerValue(headers: Readonly<Record<string, string>>, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return undefined;
}
