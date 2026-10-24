import { UnknownPlanError } from '../../errors.js';
import { createMemoryEntitlementStore } from '../../memory-store.js';
import type { CreateCheckoutInput, PaymentsProvider, WebhookRequest } from '../../provider.js';
import type {
  CheckoutSession,
  CustomerPortalSession,
  NormalizedWebhookEvent,
  Plan,
  PlanId,
  SubscriptionStatus,
  UserId,
} from '../../types.js';
import { parseEvent, verifySignature } from './webhook.js';

export type FakePaymentsOptions = {
  readonly plans: readonly Plan[];
  readonly webhookSecret: string;
};

export function createFakePaymentsProvider(options: FakePaymentsOptions): PaymentsProvider {
  const knownPlans = new Set<PlanId>(options.plans.map((plan) => plan.id));
  const mirror = createMemoryEntitlementStore();

  return {
    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      if (!knownPlans.has(input.planId)) {
        throw new UnknownPlanError(input.planId);
      }
      return {
        url: checkoutUrl(input),
        customer: { userId: input.userId },
        plan: { id: input.planId },
      };
    },

    async getSubscriptionStatus(userId: UserId): Promise<SubscriptionStatus> {
      const entitlement = await mirror.getEntitlement(userId);
      return entitlement?.subscription ?? { state: 'none' };
    },

    async handleWebhook(request: WebhookRequest): Promise<readonly NormalizedWebhookEvent[]> {
      verifySignature(request.rawBody, request.headers, options.webhookSecret);
      const event = parseEvent(request.rawBody);
      await mirror.applyUpdates([event]);
      return [event];
    },

    async createCustomerPortalUrl(userId: UserId): Promise<CustomerPortalSession> {
      const url = new URL('https://example.com/portal');
      url.searchParams.set('user', userId);
      return {
        url: url.toString(),
        customer: { userId },
      };
    },
  };
}

function checkoutUrl(input: CreateCheckoutInput): string {
  const url = new URL('https://example.com/checkout');
  url.searchParams.set('user', input.userId);
  url.searchParams.set('plan', input.planId);
  url.searchParams.set('success', input.successUrl);
  if (input.cancelUrl !== undefined) {
    url.searchParams.set('cancel', input.cancelUrl);
  }
  return url.toString();
}
