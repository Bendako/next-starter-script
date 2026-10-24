import { PaymentsError, UnknownPlanError } from '../../errors.js';
import { createMemoryEntitlementStore } from '../../memory-store.js';
import type { CreateCheckoutInput, PaymentsProvider, WebhookRequest } from '../../provider.js';
import type {
  CheckoutSession,
  CustomerPortalSession,
  SubscriptionStatus,
  UserId,
} from '../../types.js';
import { createPolarBillingClient, type PolarBillingClient } from './client.js';
import { loadPolarConfig, type PolarConfig } from './config.js';
import { indexProducts, type PolarProductConfig } from './products.js';
import { readPolarWebhook } from './webhook.js';

export type PolarPaymentsOptions = {
  readonly webhookSecret: string;
  readonly products: readonly PolarProductConfig[];
  readonly client: PolarBillingClient;
  readonly pastDueGraceSeconds?: number;
};

export function createPolarPaymentsProvider(options: PolarPaymentsOptions): PaymentsProvider {
  if (options.webhookSecret.length === 0) {
    throw new PaymentsError('Missing POLAR_WEBHOOK_SECRET');
  }
  const pastDueGraceSeconds = graceSeconds(options.pastDueGraceSeconds);
  const products = indexProducts(options.products);
  const mirror = createMemoryEntitlementStore();

  return {
    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      const productId = products.byPlan.get(input.planId);
      if (productId === undefined) {
        throw new UnknownPlanError(input.planId);
      }
      const session = await options.client.createCheckout({
        productId,
        externalCustomerId: input.userId,
        successUrl: input.successUrl,
        ...(input.cancelUrl !== undefined ? { returnUrl: input.cancelUrl } : {}),
      });
      return {
        url: session.url,
        customer: { userId: input.userId },
        plan: { id: input.planId },
      };
    },

    async getSubscriptionStatus(userId: UserId): Promise<SubscriptionStatus> {
      // Process-local and unbounded. A process that has not handled the webhook returns none.
      // Durable status is EntitlementStore. This mirror stays private so a caller's applyUpdates is not a duplicate.
      const entitlement = await mirror.getEntitlement(userId);
      return entitlement?.subscription ?? { state: 'none' };
    },

    async handleWebhook(request: WebhookRequest) {
      const updates = await readPolarWebhook({
        rawBody: request.rawBody,
        headers: request.headers,
        secret: options.webhookSecret,
        productPlans: products.byProduct,
        pastDueGraceSeconds,
      });
      await mirror.applyUpdates(updates);
      return updates;
    },

    async createCustomerPortalUrl(userId: UserId): Promise<CustomerPortalSession> {
      const portal = await options.client.createCustomerPortal({
        externalCustomerId: userId,
      });
      return {
        url: portal.url,
        customer: { userId },
      };
    },
  };
}

export function createPolarPaymentsProviderFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): PaymentsProvider {
  return createPolarPaymentsProviderFromConfig(loadPolarConfig(env));
}

export function createPolarPaymentsProviderFromConfig(config: PolarConfig): PaymentsProvider {
  return createPolarPaymentsProvider({
    webhookSecret: config.webhookSecret,
    products: config.products,
    pastDueGraceSeconds: config.pastDueGraceSeconds,
    client: createPolarBillingClient({
      accessToken: config.accessToken,
      environment: config.environment,
    }),
  });
}

function graceSeconds(value: number | undefined): number {
  const grace = value ?? 0;
  if (!Number.isSafeInteger(grace) || grace < 0) {
    throw new PaymentsError('POLAR_PAST_DUE_GRACE_SECONDS must be a non-negative integer');
  }
  return grace;
}
