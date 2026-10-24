import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  InvalidIdentifierError,
  InvalidPeriodError,
  InvalidWebhookPayloadError,
  InvalidWebhookSignatureError,
} from '../../errors.js';
import {
  activeSubscription,
  cancelAtPeriodEnd,
  eventId,
  expiredSubscription,
  isoInstant,
  planId,
  userId,
  type NormalizedWebhookEvent,
  type Subscription,
} from '../../types.js';

export const FAKE_SIGNATURE_HEADER = 'x-fake-signature';

export function signBody(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function serializeEvent(event: NormalizedWebhookEvent): string {
  return JSON.stringify(event);
}

export function verifySignature(
  rawBody: string,
  headers: Readonly<Record<string, string>>,
  secret: string,
): void {
  const received = headerValue(headers, FAKE_SIGNATURE_HEADER);
  if (received === undefined) {
    throw new InvalidWebhookSignatureError();
  }
  const expected = signBody(rawBody, secret);
  if (!signaturesMatch(expected, received)) {
    throw new InvalidWebhookSignatureError();
  }
}

export function parseEvent(rawBody: string): NormalizedWebhookEvent {
  let raw: unknown;
  try {
    raw = JSON.parse(rawBody) as unknown;
  } catch {
    throw new InvalidWebhookPayloadError();
  }
  if (!isRecord(raw)) {
    throw new InvalidWebhookPayloadError();
  }

  try {
    return {
      eventId: eventId(readString(raw, 'eventId')),
      occurredAt: isoInstant(readString(raw, 'occurredAt')),
      userId: userId(readString(raw, 'userId')),
      subscription: parseSubscription(raw.subscription),
    };
  } catch (error) {
    if (
      error instanceof InvalidIdentifierError ||
      error instanceof InvalidPeriodError ||
      error instanceof InvalidWebhookPayloadError
    ) {
      throw new InvalidWebhookPayloadError();
    }
    throw error;
  }
}

function parseSubscription(value: unknown): Subscription {
  if (!isRecord(value) || typeof value.state !== 'string') {
    throw new InvalidWebhookPayloadError();
  }
  switch (value.state) {
    case 'active':
      return activeSubscription({
        planId: planId(readString(value, 'planId')),
        currentPeriodStart: isoInstant(readString(value, 'currentPeriodStart')),
        currentPeriodEnd: isoInstant(readString(value, 'currentPeriodEnd')),
      });
    case 'cancel_at_period_end':
      return cancelAtPeriodEnd({
        planId: planId(readString(value, 'planId')),
        currentPeriodStart: isoInstant(readString(value, 'currentPeriodStart')),
        currentPeriodEnd: isoInstant(readString(value, 'currentPeriodEnd')),
      });
    case 'expired':
      return expiredSubscription({
        planId: planId(readString(value, 'planId')),
        currentPeriodEnd: isoInstant(readString(value, 'currentPeriodEnd')),
      });
    default:
      throw new InvalidWebhookPayloadError();
  }
}

function signaturesMatch(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  if (expectedBytes.length !== receivedBytes.length) {
    return false;
  }
  return timingSafeEqual(expectedBytes, receivedBytes);
}

function headerValue(headers: Readonly<Record<string, string>>, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return undefined;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new InvalidWebhookPayloadError();
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
