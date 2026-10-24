import type { PaymentsProvider, WebhookRequest } from './provider.js';
import type { EntitlementStore } from './store.js';
import type { NormalizedWebhookEvent, Plan, PlanId } from './types.js';

export interface PaymentsContractHarness {
  readonly provider: PaymentsProvider;
  readonly store: EntitlementStore;
  readonly knownPlan: Plan;
  readonly unknownPlanId: PlanId;
  signedRequest(rawBody: string): WebhookRequest;
  webhookRequest(event: NormalizedWebhookEvent): WebhookRequest;
  withBadSignature(request: WebhookRequest): WebhookRequest;
}
