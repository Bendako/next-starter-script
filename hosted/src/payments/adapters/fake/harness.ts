import type { PaymentsContractHarness } from '../../contract.js';
import { createMemoryEntitlementStore } from '../../memory-store.js';
import type { WebhookRequest } from '../../provider.js';
import { planId, type NormalizedWebhookEvent } from '../../types.js';
import { createFakePaymentsProvider } from './fake-provider.js';
import { FAKE_SIGNATURE_HEADER, serializeEvent, signBody } from './webhook.js';

const WEBHOOK_SECRET = 'test-only-not-a-credential';

export function createFakePaymentsHarness(): PaymentsContractHarness {
  const knownPlan = { id: planId('plan_contract') };
  const signedRequest = (rawBody: string): WebhookRequest => ({
    rawBody,
    headers: {
      [FAKE_SIGNATURE_HEADER]: signBody(rawBody, WEBHOOK_SECRET),
    },
  });
  return {
    provider: createFakePaymentsProvider({
      plans: [knownPlan],
      webhookSecret: WEBHOOK_SECRET,
    }),
    store: createMemoryEntitlementStore(),
    knownPlan,
    unknownPlanId: planId('plan_missing'),
    signedRequest,
    webhookRequest(event: NormalizedWebhookEvent): WebhookRequest {
      return signedRequest(serializeEvent(event));
    },
    withBadSignature(request: WebhookRequest): WebhookRequest {
      return {
        rawBody: request.rawBody,
        headers: {
          ...request.headers,
          [FAKE_SIGNATURE_HEADER]: 'not-a-valid-signature',
        },
      };
    },
  };
}
