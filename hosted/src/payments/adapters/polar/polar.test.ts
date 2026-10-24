import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import type { Polar } from '@polar-sh/sdk/2026-10';

import { PaymentsError, UnknownPlanError, InvalidWebhookPayloadError, InvalidWebhookSignatureError } from '../../errors.js';
import { createMemoryEntitlementStore } from '../../memory-store.js';
import {
  activeSubscription,
  cancelAtPeriodEnd,
  expiredSubscription,
  isoInstant,
  planId,
  userId,
} from '../../types.js';
import { billingClientFromPolar, type PolarBillingClient, type PolarCheckoutRequest } from './client.js';
import { loadPolarConfig, POLAR_ACCESS_TOKEN, POLAR_ENVIRONMENT, POLAR_PRODUCT_ID_TBD_BY_BEN, POLAR_WEBHOOK_SECRET, TBD_BY_BEN_PLAN_ID } from './config.js';
import { FIXTURE_PRODUCT_ID, FIXTURE_WEBHOOK_SECRET } from './harness.js';
import { createPolarPaymentsProvider } from './provider.js';
import { signPolarWebhook, WEBHOOK_SIGNATURE_HEADER } from './sign.js';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const owner = userId('user_1');
const knownPlan = planId('plan_contract');
const laterPlan = planId('plan_later');

describe('Polar adapter', () => {
  it('maps fixture subscription events onto entitlements and ignores a second delivery', async () => {
    const provider = providerWithPlans();
    const store = createMemoryEntitlementStore();
    const active = await deliver(provider, 'subscription-updated-active.json', 'evt_active');
    expect(active).toEqual([
      {
        eventId: 'evt_active',
        occurredAt: isoInstant('2026-03-01T00:00:00.000Z'),
        userId: owner,
        subscription: activeSubscription({
          planId: knownPlan,
          currentPeriodStart: isoInstant('2026-03-01T00:00:00.000Z'),
          currentPeriodEnd: isoInstant('2026-04-01T00:00:00.000Z'),
        }),
      },
    ]);
    expect(await store.applyUpdates(active)).toEqual({ applied: 1, duplicates: 0, stale: 0 });
    const again = await deliver(provider, 'subscription-updated-active.json', 'evt_active');
    expect(again).toEqual(active);
    expect(await store.applyUpdates(again)).toEqual({ applied: 0, duplicates: 1, stale: 0 });
    expect(await provider.getSubscriptionStatus(owner)).toEqual(active[0]?.subscription);

    const canceled = await deliver(provider, 'subscription-canceled.json', 'evt_cancel');
    expect(canceled[0]?.subscription).toEqual(
      cancelAtPeriodEnd({
        planId: knownPlan,
        currentPeriodStart: isoInstant('2026-03-01T00:00:00.000Z'),
        currentPeriodEnd: isoInstant('2026-04-01T00:00:00.000Z'),
      }),
    );

    const revoked = await deliver(provider, 'subscription-revoked.json', 'evt_revoked');
    expect(revoked[0]?.subscription).toEqual(
      expiredSubscription({
        planId: knownPlan,
        currentPeriodEnd: isoInstant('2026-04-01T00:00:00.000Z'),
      }),
    );
    expect(await provider.getSubscriptionStatus(owner)).toEqual(revoked[0]?.subscription);
  });

  it('keeps the later entitlement when an earlier fixture arrives second', async () => {
    const provider = providerWithPlans();
    const store = createMemoryEntitlementStore();
    const revoked = await deliver(provider, 'subscription-revoked.json', 'evt_revoked');
    expect(await store.applyUpdates(revoked)).toEqual({ applied: 1, duplicates: 0, stale: 0 });
    const earlier = await deliver(provider, 'subscription-updated-active.json', 'evt_active');
    expect(await store.applyUpdates(earlier)).toEqual({ applied: 0, duplicates: 0, stale: 1 });
    expect(await provider.getSubscriptionStatus(owner)).toEqual(revoked[0]?.subscription);
    expect(await store.getEntitlement(owner)).toEqual({
      userId: owner,
      occurredAt: revoked[0]?.occurredAt,
      subscription: revoked[0]?.subscription,
    });
  });

  it('rejects a bad signature and still accepts the fixture body', async () => {
    const provider = providerWithPlans();
    const rawBody = readFileSync(path.join(fixtureDir, 'subscription-updated-active.json'), 'utf8');
    const headers = signPolarWebhook(rawBody, FIXTURE_WEBHOOK_SECRET, 'evt_active', Date.now() / 1000);
    await expect(
      provider.handleWebhook({
        rawBody,
        headers: { ...headers, [WEBHOOK_SIGNATURE_HEADER]: 'v1,bm90LWEtdmFsaWQtc2lnbmF0dXJl' },
      }),
    ).rejects.toBeInstanceOf(InvalidWebhookSignatureError);
    expect(await provider.getSubscriptionStatus(owner)).toEqual({ state: 'none' });

    const accepted = await provider.handleWebhook({ rawBody, headers });
    expect(accepted[0]?.subscription.state).toBe('active');
  });

  it('rejects a signed subscription body that is missing its status', async () => {
    const provider = providerWithPlans();
    const rawBody = JSON.stringify({
      type: 'subscription.updated',
      timestamp: '2026-03-01T00:00:00.000Z',
      api_version: '2026-10',
      data: {
        id: 'sub_fixture',
        cancel_at_period_end: false,
        current_period_start: '2026-03-01T00:00:00.000Z',
        current_period_end: '2026-04-01T00:00:00.000Z',
        product_id: FIXTURE_PRODUCT_ID,
        customer: { id: 'cus_fixture', external_id: 'user_1' },
      },
    });
    await expect(deliverBody(provider, rawBody, 'evt_bad')).rejects.toBeInstanceOf(InvalidWebhookPayloadError);
    expect(await provider.getSubscriptionStatus(owner)).toEqual({ state: 'none' });
  });

  it('maps customer.state_changed and ignores unrelated or unknown events', async () => {
    const provider = providerWithPlans();
    const changed = await deliver(provider, 'customer-state-changed.json', 'evt_state');
    expect(changed[0]?.subscription.state).toBe('active');
    expect(await provider.getSubscriptionStatus(owner)).toEqual(changed[0]?.subscription);

    const paid = await deliver(provider, 'order-paid.json', 'evt_order');
    expect(paid).toEqual([]);
    expect(await provider.getSubscriptionStatus(owner)).toEqual(changed[0]?.subscription);

    const unknown = await deliver(provider, 'unknown-type.json', 'evt_unknown');
    expect(unknown).toEqual([]);
    expect(await provider.getSubscriptionStatus(owner)).toEqual(changed[0]?.subscription);
  });

  it('does not expire access when customer.state_changed lists no active subscription', async () => {
    const provider = providerWithPlans();
    await deliver(provider, 'subscription-updated-active.json', 'evt_active');
    const empty = JSON.parse(readFileSync(path.join(fixtureDir, 'customer-state-changed.json'), 'utf8')) as {
      data: { active_subscriptions: unknown[] };
    };
    empty.data.active_subscriptions = [];
    const updates = await deliverBody(provider, JSON.stringify(empty), 'evt_empty');
    expect(updates).toEqual([]);
    expect((await provider.getSubscriptionStatus(owner)).state).toBe('active');
  });

  it('keeps access for past_due, trialing, and a scheduled pause, and ends it when Polar revokes', async () => {
    const provider = providerWithPlans();
    const pastDue = await deliverBody(provider, subscriptionBody({ type: 'subscription.past_due', status: 'past_due' }), 'evt_past_due');
    expect(pastDue[0]?.subscription.state).toBe('active');

    const trialing = await deliverBody(
      provider,
      subscriptionBody({ type: 'subscription.updated', status: 'trialing', at: '2026-03-02T00:00:00.000Z' }),
      'evt_trial',
    );
    expect(trialing[0]?.subscription.state).toBe('active');

    const paused = await deliverBody(
      provider,
      subscriptionBody({ type: 'subscription.paused', status: 'paused', at: '2026-04-01T00:00:00.000Z' }),
      'evt_paused',
    );
    expect(paused[0]?.subscription.state).toBe('expired');

    const scheduledPause = providerWithPlans();
    const stillActive = await deliverBody(
      scheduledPause,
      subscriptionBody({ type: 'subscription.updated', status: 'active', pauseAtPeriodEnd: true }),
      'evt_pause_scheduled',
    );
    expect(stillActive[0]?.subscription.state).toBe('active');

    const fresh = providerWithPlans();
    const incomplete = await deliverBody(
      fresh,
      subscriptionBody({ type: 'subscription.created', status: 'incomplete' }),
      'evt_incomplete',
    );
    expect(incomplete).toEqual([]);
    const ended = await deliverBody(
      fresh,
      subscriptionBody({
        type: 'subscription.updated',
        status: 'incomplete_expired',
        at: '2026-03-02T00:00:00.000Z',
      }),
      'evt_incomplete_expired',
    );
    expect(ended[0]?.subscription.state).toBe('expired');
    const unpaid = await deliverBody(
      fresh,
      subscriptionBody({ type: 'subscription.updated', status: 'unpaid', at: '2026-03-03T00:00:00.000Z' }),
      'evt_unpaid',
    );
    expect(unpaid[0]?.subscription.state).toBe('expired');
    expect(await fresh.getSubscriptionStatus(owner)).toEqual(unpaid[0]?.subscription);
  });

  it('ignores an unknown product and a subscription with no external id', async () => {
    const provider = providerWithPlans();
    const unknownProduct = await deliverBody(
      provider,
      subscriptionBody({ type: 'subscription.updated', status: 'active', productId: 'prod_other' }),
      'evt_other',
    );
    expect(unknownProduct).toEqual([]);
    const noCustomer = await deliverBody(
      provider,
      subscriptionBody({ type: 'subscription.updated', status: 'active', externalId: null }),
      'evt_no_customer',
    );
    expect(noCustomer).toEqual([]);
    expect(await provider.getSubscriptionStatus(owner)).toEqual({ state: 'none' });
  });

  it('keeps the later period when one webhook lists two known products', async () => {
    const provider = providerWithPlans();
    const body = JSON.parse(readFileSync(path.join(fixtureDir, 'customer-state-changed.json'), 'utf8')) as {
      data: { active_subscriptions: Array<Record<string, unknown>> };
    };
    body.data.active_subscriptions.push({
      id: 'sub_later',
      status: 'active',
      cancel_at_period_end: true,
      current_period_start: '2026-03-01T00:00:00.000Z',
      current_period_end: '2026-06-01T00:00:00.000Z',
      product_id: 'prod_later',
    });
    const updates = await deliverBody(provider, JSON.stringify(body), 'evt_two');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.subscription).toEqual(
      cancelAtPeriodEnd({
        planId: laterPlan,
        currentPeriodStart: isoInstant('2026-03-01T00:00:00.000Z'),
        currentPeriodEnd: isoInstant('2026-06-01T00:00:00.000Z'),
      }),
    );
  });

  it('normalizes Polar timestamps that use microseconds', async () => {
    const provider = providerWithPlans();
    const updates = await deliver(provider, 'subscription-microseconds.json', 'evt_micro');
    expect(updates[0]?.occurredAt).toBe('2026-03-01T00:00:00.000Z');
    expect(updates[0]?.subscription.currentPeriodEnd).toBe('2026-04-01T00:00:00.000Z');
  });

  it('sends the documented checkout and portal fields and rejects an unknown plan first', async () => {
    const checkouts: PolarCheckoutRequest[] = [];
    const portals: string[] = [];
    const client: PolarBillingClient = {
      async createCheckout(input) {
        checkouts.push(input);
        return { url: 'https://example.com/checkout' };
      },
      async createCustomerPortal(input) {
        portals.push(input.externalCustomerId);
        return { url: 'https://example.com/portal' };
      },
    };
    const provider = createPolarPaymentsProvider({
      webhookSecret: FIXTURE_WEBHOOK_SECRET,
      products: [{ planId: knownPlan, productId: FIXTURE_PRODUCT_ID }],
      client,
    });

    await expect(
      provider.createCheckout({
        userId: owner,
        planId: planId('plan_missing'),
        successUrl: 'https://example.com/done',
      }),
    ).rejects.toBeInstanceOf(UnknownPlanError);
    expect(checkouts).toEqual([]);

    const session = await provider.createCheckout({
      userId: owner,
      planId: knownPlan,
      successUrl: 'https://example.com/done',
      cancelUrl: 'https://example.com/cancel',
    });
    expect(session.url).toBe('https://example.com/checkout');
    expect(checkouts).toEqual([
      {
        productId: FIXTURE_PRODUCT_ID,
        externalCustomerId: owner,
        successUrl: 'https://example.com/done',
        returnUrl: 'https://example.com/cancel',
      },
    ]);

    const portal = await provider.createCustomerPortalUrl(owner);
    expect(portal).toEqual({ url: 'https://example.com/portal', customer: { userId: owner } });
    expect(portals).toEqual([owner]);
  });

  it('passes Polar checkout and portal field names through the SDK client', async () => {
    const calls: unknown[] = [];
    const polar = {
      checkouts: {
        create: async (body: unknown) => {
          calls.push(body);
          return { url: 'https://example.com/from-sdk' };
        },
      },
      customerSessions: {
        create: async (body: unknown) => {
          calls.push(body);
          return { customer_portal_url: 'https://example.com/from-sdk-portal' };
        },
      },
    };
    const client = billingClientFromPolar(polar as Pick<Polar, 'checkouts' | 'customerSessions'>);
    const checkout = await client.createCheckout({
      productId: FIXTURE_PRODUCT_ID,
      externalCustomerId: 'user_1',
      successUrl: 'https://example.com/done',
      returnUrl: 'https://example.com/cancel',
    });
    const portal = await client.createCustomerPortal({ externalCustomerId: 'user_1' });
    expect(checkout.url).toBe('https://example.com/from-sdk');
    expect(portal.url).toBe('https://example.com/from-sdk-portal');
    expect(calls).toEqual([
      {
        products: [FIXTURE_PRODUCT_ID],
        external_customer_id: 'user_1',
        success_url: 'https://example.com/done',
        return_url: 'https://example.com/cancel',
      },
      { external_customer_id: 'user_1' },
    ]);
  });

  it('reads placeholder product config from env names and rejects a bad environment', () => {
    const config = loadPolarConfig({
      [POLAR_ACCESS_TOKEN]: 'test-only-not-a-credential',
      [POLAR_WEBHOOK_SECRET]: 'test-only-not-a-credential',
      [POLAR_ENVIRONMENT]: 'sandbox',
      [POLAR_PRODUCT_ID_TBD_BY_BEN]: FIXTURE_PRODUCT_ID,
    });
    expect(config.environment).toBe('sandbox');
    expect(config.products).toEqual([{ planId: planId(TBD_BY_BEN_PLAN_ID), productId: FIXTURE_PRODUCT_ID }]);
    expect(() => loadPolarConfig({})).toThrow(PaymentsError);
    expect(() =>
      loadPolarConfig({
        [POLAR_ACCESS_TOKEN]: 'test-only-not-a-credential',
        [POLAR_WEBHOOK_SECRET]: 'test-only-not-a-credential',
        [POLAR_ENVIRONMENT]: 'staging',
        [POLAR_PRODUCT_ID_TBD_BY_BEN]: FIXTURE_PRODUCT_ID,
      }),
    ).toThrow(/POLAR_ENVIRONMENT/);
  });

  it('rejects two plans that share one product id', () => {
    expect(() =>
      createPolarPaymentsProvider({
        webhookSecret: FIXTURE_WEBHOOK_SECRET,
        products: [
          { planId: knownPlan, productId: FIXTURE_PRODUCT_ID },
          { planId: laterPlan, productId: FIXTURE_PRODUCT_ID },
        ],
        client: {
          async createCheckout() {
            return { url: 'https://example.com/checkout' };
          },
          async createCustomerPortal() {
            return { url: 'https://example.com/portal' };
          },
        },
      }),
    ).toThrow(PaymentsError);
  });
});

function providerWithPlans() {
  return createPolarPaymentsProvider({
    webhookSecret: FIXTURE_WEBHOOK_SECRET,
    products: [
      { planId: knownPlan, productId: FIXTURE_PRODUCT_ID },
      { planId: laterPlan, productId: 'prod_later' },
    ],
    client: {
      async createCheckout() {
        return { url: 'https://example.com/checkout' };
      },
      async createCustomerPortal() {
        return { url: 'https://example.com/portal' };
      },
    },
  });
}

async function deliver(
  provider: ReturnType<typeof providerWithPlans>,
  name: string,
  webhookId: string,
) {
  return deliverBody(provider, readFileSync(path.join(fixtureDir, name), 'utf8'), webhookId);
}

async function deliverBody(
  provider: ReturnType<typeof providerWithPlans>,
  rawBody: string,
  webhookId: string,
) {
  return provider.handleWebhook({
    rawBody,
    headers: signPolarWebhook(rawBody, FIXTURE_WEBHOOK_SECRET, webhookId, Date.now() / 1000),
  });
}

function subscriptionBody(input: {
  readonly type: string;
  readonly status: string;
  readonly at?: string;
  readonly productId?: string;
  readonly externalId?: string | null;
  readonly pauseAtPeriodEnd?: boolean;
}): string {
  return JSON.stringify({
    type: input.type,
    timestamp: input.at ?? '2026-03-01T00:00:00.000Z',
    api_version: '2026-10',
    data: {
      id: 'sub_fixture',
      status: input.status,
      cancel_at_period_end: false,
      pause_at_period_end: input.pauseAtPeriodEnd ?? false,
      current_period_start: '2026-03-01T00:00:00.000Z',
      current_period_end: '2026-04-01T00:00:00.000Z',
      product_id: input.productId ?? FIXTURE_PRODUCT_ID,
      customer: {
        id: 'cus_fixture',
        external_id: input.externalId === undefined ? 'user_1' : input.externalId,
        email: 'buyer@example.com',
      },
    },
  });
}
