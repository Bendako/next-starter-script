import type {
  CheckoutSession,
  CustomerPortalSession,
  NormalizedWebhookEvent,
  PlanId,
  SubscriptionStatus,
  UserId,
} from './types.js';

export type CreateCheckoutInput = {
  readonly userId: UserId;
  readonly planId: PlanId;
  readonly successUrl: string;
  readonly cancelUrl?: string;
};

export type WebhookRequest = {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string>>;
};

export interface PaymentsProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  getSubscriptionStatus(userId: UserId): Promise<SubscriptionStatus>;
  handleWebhook(request: WebhookRequest): Promise<readonly NormalizedWebhookEvent[]>;
  createCustomerPortalUrl(userId: UserId): Promise<CustomerPortalSession>;
}
