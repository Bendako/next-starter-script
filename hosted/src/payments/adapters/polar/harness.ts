import type { PaymentsContractHarness } from '../../contract.js';
import { createMemoryEntitlementStore } from '../../memory-store.js';
import type { WebhookRequest } from '../../provider.js';
import { planId, type NormalizedWebhookEvent, type Subscription } from '../../types.js';
import { createPolarPaymentsProvider } from './provider.js';
import type { PolarBillingClient } from './client.js';
import { signPolarWebhook, WEBHOOK_SIGNATURE_HEADER } from './sign.js';

export const FIXTURE_PRODUCT_ID = 'prod_TBD_BY_BEN';
export const FIXTURE_WEBHOOK_SECRET = `whsec_${Buffer.from('test-only-not-a-credential').toString('base64')}`;

const KNOWN_PLAN = planId('plan_contract');

export function createPolarPaymentsHarness(): PaymentsContractHarness {
  const knownPlan = { id: KNOWN_PLAN };
  return {
    provider: createPolarPaymentsProvider({
      webhookSecret: FIXTURE_WEBHOOK_SECRET,
      products: [{ planId: KNOWN_PLAN, productId: FIXTURE_PRODUCT_ID }],
      client: stubClient(),
    }),
    store: createMemoryEntitlementStore(),
    knownPlan,
    unknownPlanId: planId('plan_missing'),
    signedRequest(rawBody: string): WebhookRequest {
      return {
        rawBody,
        headers: signPolarWebhook(rawBody, FIXTURE_WEBHOOK_SECRET, 'evt_contract_body', Date.now() / 1000),
      };
    },
    webhookRequest(event: NormalizedWebhookEvent): WebhookRequest {
      const rawBody = serializeContractEvent(event);
      return {
        rawBody,
        headers: signPolarWebhook(rawBody, FIXTURE_WEBHOOK_SECRET, event.eventId, Date.now() / 1000),
      };
    },
    withBadSignature(request: WebhookRequest): WebhookRequest {
      return {
        rawBody: request.rawBody,
        headers: {
          ...request.headers,
          [WEBHOOK_SIGNATURE_HEADER]: 'v1,bm90LWEtdmFsaWQtc2lnbmF0dXJl',
        },
      };
    },
  };
}

function serializeContractEvent(event: NormalizedWebhookEvent): string {
  const subscription = event.subscription;
  return JSON.stringify({
    type: polarType(subscription),
    timestamp: event.occurredAt,
    api_version: '2026-10',
    data: {
      id: 'sub_fixture',
      status: subscription.state === 'expired' ? 'canceled' : 'active',
      cancel_at_period_end: subscription.state === 'cancel_at_period_end',
      current_period_start:
        subscription.state === 'expired' ? subscription.currentPeriodEnd : subscription.currentPeriodStart,
      current_period_end: subscription.currentPeriodEnd,
      product_id: FIXTURE_PRODUCT_ID,
      customer: {
        id: 'cus_fixture',
        external_id: event.userId,
        email: 'buyer@example.com',
      },
    },
  });
}

function polarType(subscription: Subscription): string {
  if (subscription.state === 'expired') {
    return 'subscription.revoked';
  }
  if (subscription.state === 'cancel_at_period_end') {
    return 'subscription.canceled';
  }
  return 'subscription.updated';
}

function stubClient(): PolarBillingClient {
  return {
    async createCheckout(input) {
      const url = new URL('https://example.com/checkout');
      url.searchParams.set('product', input.productId);
      url.searchParams.set('customer', input.externalCustomerId);
      return { url: url.toString() };
    },
    async createCustomerPortal(input) {
      const url = new URL('https://example.com/portal');
      url.searchParams.set('customer', input.externalCustomerId);
      return { url: url.toString() };
    },
  };
}
