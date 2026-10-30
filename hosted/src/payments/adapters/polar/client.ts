import { createPolar, type Polar } from '@polar-sh/sdk/2026-10';

export type PolarCheckoutRequest = {
  readonly productId: string;
  readonly externalCustomerId: string;
  readonly successUrl: string;
  readonly returnUrl?: string;
};

export type PolarBillingClient = {
  createCheckout(input: PolarCheckoutRequest): Promise<{ readonly url: string }>;
  createCustomerPortal(input: { readonly externalCustomerId: string }): Promise<{ readonly url: string }>;
};

export type PolarEnvironment = 'sandbox' | 'production';

export function createPolarBillingClient(options: {
  readonly accessToken: string;
  readonly environment: PolarEnvironment;
}): PolarBillingClient {
  return billingClientFromPolar(
    createPolar({
      accessToken: options.accessToken,
      environment: options.environment,
    }),
  );
}

export function billingClientFromPolar(
  polar: Pick<Polar, 'checkouts' | 'customerSessions'>,
): PolarBillingClient {
  return {
    async createCheckout(input: PolarCheckoutRequest): Promise<{ readonly url: string }> {
      const checkout = await polar.checkouts.create({
        products: [input.productId],
        external_customer_id: input.externalCustomerId,
        success_url: input.successUrl,
        ...(input.returnUrl !== undefined ? { return_url: input.returnUrl } : {}),
      });
      return { url: checkout.url };
    },

    async createCustomerPortal(input: {
      readonly externalCustomerId: string;
    }): Promise<{ readonly url: string }> {
      const session = await polar.customerSessions.create({
        external_customer_id: input.externalCustomerId,
      });
      return { url: session.customer_portal_url };
    },
  };
}
