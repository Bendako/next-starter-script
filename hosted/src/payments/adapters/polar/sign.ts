import { createHmac } from 'node:crypto';

export const WEBHOOK_ID_HEADER = 'webhook-id';
export const WEBHOOK_TIMESTAMP_HEADER = 'webhook-timestamp';
export const WEBHOOK_SIGNATURE_HEADER = 'webhook-signature';

export function signPolarWebhook(
  rawBody: string,
  secret: string,
  webhookId: string,
  timestampSeconds: number,
): Record<string, string> {
  const timestamp = String(Math.floor(timestampSeconds));
  const remainder = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const key = Buffer.from(remainder, 'base64');
  const signature = createHmac('sha256', key).update(`${webhookId}.${timestamp}.${rawBody}`).digest('base64');
  return {
    [WEBHOOK_ID_HEADER]: webhookId,
    [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
    [WEBHOOK_SIGNATURE_HEADER]: `v1,${signature}`,
  };
}
