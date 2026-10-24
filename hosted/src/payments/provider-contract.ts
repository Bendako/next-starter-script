import { beforeEach, describe, expect, it } from 'vitest';

import type { PaymentsContractHarness } from './contract.js';
import {
  InvalidWebhookPayloadError,
  InvalidWebhookSignatureError,
  UnknownPlanError,
} from './errors.js';
import type { ApplyResult } from './store.js';
import {
  activeSubscription,
  cancelAtPeriodEnd,
  eventId,
  expiredSubscription,
  isoInstant,
  userId,
  type NormalizedWebhookEvent,
  type Subscription,
  type UserId,
} from './types.js';

export function runPaymentsContract(name: string, create: () => PaymentsContractHarness): void {
  describe(`${name} payments adapter`, () => {
    let harness: PaymentsContractHarness;
    let owner: UserId;

    beforeEach(() => {
      harness = create();
      owner = userId('user_1');
    });

    it('returns a checkout URL for a known plan and rejects an unknown plan', async () => {
      const session = await harness.provider.createCheckout({
        userId: owner,
        planId: harness.knownPlan.id,
        successUrl: 'https://example.com/done',
        cancelUrl: 'https://example.com/cancel',
      });

      const url = new URL(session.url);
      expect(url.protocol === 'https:' || url.protocol === 'http:').toBe(true);
      expect(session.customer).toEqual({ userId: owner });
      expect(session.plan).toEqual(harness.knownPlan);
      expect(await harness.provider.getSubscriptionStatus(owner)).toEqual({ state: 'none' });
      expect(await harness.store.getEntitlement(owner)).toBeNull();

      const rejection: unknown = await harness.provider
        .createCheckout({
          userId: owner,
          planId: harness.unknownPlanId,
          successUrl: 'https://example.com/done',
        })
        .then(() => null)
        .catch((error: unknown) => error);

      expect(rejection).toBeInstanceOf(UnknownPlanError);
      expect(rejection).toMatchObject({
        code: 'unknown_plan',
        planId: harness.unknownPlanId,
      });
    });

    it('reports no subscription for a user who has none', async () => {
      expect(await harness.provider.getSubscriptionStatus(userId('user_unknown'))).toEqual({
        state: 'none',
      });
    });

    it('moves a subscription from active to cancel-at-period-end to expired', async () => {
      const active = eventAt({
        event: 'evt_active',
        at: '2026-03-01T00:00:00.000Z',
        user: owner,
        subscription: activeSubscription({
          planId: harness.knownPlan.id,
          currentPeriodStart: isoInstant('2026-03-01T00:00:00.000Z'),
          currentPeriodEnd: isoInstant('2026-04-01T00:00:00.000Z'),
        }),
      });
      const cancelled = eventAt({
        event: 'evt_cancel',
        at: '2026-03-10T00:00:00.000Z',
        user: owner,
        subscription: cancelAtPeriodEnd({
          planId: harness.knownPlan.id,
          currentPeriodStart: isoInstant('2026-03-01T00:00:00.000Z'),
          currentPeriodEnd: isoInstant('2026-04-01T00:00:00.000Z'),
        }),
      });
      const expired = eventAt({
        event: 'evt_expired',
        at: '2026-04-01T00:00:00.000Z',
        user: owner,
        subscription: expiredSubscription({
          planId: harness.knownPlan.id,
          currentPeriodEnd: isoInstant('2026-04-01T00:00:00.000Z'),
        }),
      });

      expect(await harness.provider.getSubscriptionStatus(owner)).toEqual({ state: 'none' });
      await deliver(harness, active);
      expect(await harness.provider.getSubscriptionStatus(owner)).toEqual(active.subscription);
      await deliver(harness, cancelled);
      expect(await harness.provider.getSubscriptionStatus(owner)).toEqual(cancelled.subscription);
      await deliver(harness, expired);
      expect(await harness.provider.getSubscriptionStatus(owner)).toEqual(expired.subscription);
      expect(await harness.store.getEntitlement(owner)).toEqual({
        userId: owner,
        occurredAt: expired.occurredAt,
        subscription: expired.subscription,
      });
    });

    it('rejects a webhook with a bad signature and still accepts the original body', async () => {
      const active = subscribed(harness, owner);
      const request = harness.webhookRequest(active);

      await expect(harness.provider.handleWebhook(harness.withBadSignature(request))).rejects.toBeInstanceOf(
        InvalidWebhookSignatureError,
      );
      expect(await harness.provider.getSubscriptionStatus(owner)).toEqual({ state: 'none' });
      expect(await harness.store.getEntitlement(owner)).toBeNull();

      const accepted = await harness.provider.handleWebhook(request);
      expect(await harness.store.applyUpdates(accepted)).toEqual<ApplyResult>({
        applied: 1,
        duplicates: 0,
        stale: 0,
      });
      expect(await harness.provider.getSubscriptionStatus(owner)).toEqual(active.subscription);
    });

    it('rejects a signed body that is not a subscription event', async () => {
      await expect(harness.provider.handleWebhook(harness.signedRequest('{"eventId":'))).rejects.toBeInstanceOf(
        InvalidWebhookPayloadError,
      );
      expect(await harness.provider.getSubscriptionStatus(owner)).toEqual({ state: 'none' });
      expect(await harness.store.getEntitlement(owner)).toBeNull();
    });

    it('treats a second delivery of the same webhook as the same event id', async () => {
      const active = subscribed(harness, owner);
      const request = harness.webhookRequest(active);

      const first = await harness.provider.handleWebhook(request);
      const second = await harness.provider.handleWebhook(request);
      expect(second).toEqual(first);
      expect(first.map((event) => event.eventId)).toEqual([active.eventId]);

      expect(await harness.store.applyUpdates(first)).toEqual<ApplyResult>({
        applied: 1,
        duplicates: 0,
        stale: 0,
      });
      expect(await harness.store.applyUpdates(second)).toEqual<ApplyResult>({
        applied: 0,
        duplicates: 1,
        stale: 0,
      });
      expect(await harness.store.getEntitlement(owner)).toEqual({
        userId: owner,
        occurredAt: active.occurredAt,
        subscription: active.subscription,
      });
      expect(await harness.provider.getSubscriptionStatus(owner)).toEqual(active.subscription);
    });

    it('does not regress when an earlier event arrives after a later one', async () => {
      const later = eventAt({
        event: 'evt_later',
        at: '2026-03-15T00:00:00.000Z',
        user: owner,
        subscription: expiredSubscription({
          planId: harness.knownPlan.id,
          currentPeriodEnd: isoInstant('2026-03-01T00:00:00.000Z'),
        }),
      });
      const earlier = eventAt({
        event: 'evt_earlier',
        at: '2026-03-01T00:00:00.000Z',
        user: owner,
        subscription: activeSubscription({
          planId: harness.knownPlan.id,
          currentPeriodStart: isoInstant('2026-03-01T00:00:00.000Z'),
          currentPeriodEnd: isoInstant('2026-06-01T00:00:00.000Z'),
        }),
      });

      await deliver(harness, later);
      const replay = await harness.provider.handleWebhook(harness.webhookRequest(earlier));
      expect(await harness.provider.getSubscriptionStatus(owner)).toEqual(later.subscription);
      expect(await harness.store.applyUpdates(replay)).toEqual<ApplyResult>({
        applied: 0,
        duplicates: 0,
        stale: 1,
      });
      expect(await harness.provider.getSubscriptionStatus(owner)).toEqual(later.subscription);
      expect(await harness.store.getEntitlement(owner)).toEqual({
        userId: owner,
        occurredAt: later.occurredAt,
        subscription: later.subscription,
      });
    });

    it('returns a customer portal URL', async () => {
      const portal = await harness.provider.createCustomerPortalUrl(owner);
      const url = new URL(portal.url);
      expect(url.protocol === 'https:' || url.protocol === 'http:').toBe(true);
      expect(portal.customer).toEqual({ userId: owner });
    });
  });
}

function subscribed(harness: PaymentsContractHarness, owner: UserId): NormalizedWebhookEvent {
  return eventAt({
    event: 'evt_active',
    at: '2026-03-01T00:00:00.000Z',
    user: owner,
    subscription: activeSubscription({
      planId: harness.knownPlan.id,
      currentPeriodStart: isoInstant('2026-03-01T00:00:00.000Z'),
      currentPeriodEnd: isoInstant('2026-04-01T00:00:00.000Z'),
    }),
  });
}

function eventAt(input: {
  readonly event: string;
  readonly at: string;
  readonly user: UserId;
  readonly subscription: Subscription;
}): NormalizedWebhookEvent {
  return {
    eventId: eventId(input.event),
    occurredAt: isoInstant(input.at),
    userId: input.user,
    subscription: input.subscription,
  };
}

async function deliver(harness: PaymentsContractHarness, event: NormalizedWebhookEvent): Promise<void> {
  const updates = await harness.provider.handleWebhook(harness.webhookRequest(event));
  const result = await harness.store.applyUpdates(updates);
  expect(result).toEqual<ApplyResult>({ applied: 1, duplicates: 0, stale: 0 });
}
