export class PaymentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidIdentifierError extends PaymentsError {
  readonly code = 'invalid_identifier' as const;

  constructor(readonly kind: 'user' | 'plan' | 'event' | 'instant') {
    super(`Invalid ${kind}`);
  }
}

export class InvalidPeriodError extends PaymentsError {
  readonly code = 'invalid_period' as const;

  constructor() {
    super('Period start is after period end');
  }
}

export class UnknownPlanError extends PaymentsError {
  readonly code = 'unknown_plan' as const;

  constructor(readonly planId: string) {
    super('Unknown plan');
  }
}

export class InvalidWebhookSignatureError extends PaymentsError {
  readonly code = 'invalid_signature' as const;

  constructor() {
    super('Invalid webhook signature');
  }
}

export class InvalidWebhookPayloadError extends PaymentsError {
  readonly code = 'invalid_payload' as const;

  constructor() {
    super('Invalid webhook payload');
  }
}
