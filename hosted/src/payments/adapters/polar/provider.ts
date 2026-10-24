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
};

export function createPolarPaymentsProvider(options: PolarPaymentsOptions): PaymentsProvider {
  if (options.webhookSecret.length === 0) {
    throw new PaymentsError('Missing POLAR_WEBHOOK_SECRET');
  }
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
      const entitlement = await mirror.getEntitlement(userId);
      return entitlement?.subscription ?? { state: 'none' };
    },

    async handleWebhook(request: WebhookRequest) {
      const updates = await readPolarWebhook({
        rawBody: request.rawBody,
        headers: request.headers,
        secret: options.webhookSecret,
        productPlans: products.byProduct,
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
    client: createPolarBillingClient({
      accessToken: config.accessToken,
      environment: config.environment,
    }),
  });
}
