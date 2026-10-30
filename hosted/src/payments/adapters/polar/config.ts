import { PaymentsError } from '../../errors.js';
import { planId } from '../../types.js';
import type { PolarEnvironment } from './client.js';
import type { PolarProductConfig } from './products.js';

export const POLAR_ACCESS_TOKEN = 'POLAR_ACCESS_TOKEN';
export const POLAR_WEBHOOK_SECRET = 'POLAR_WEBHOOK_SECRET';
export const POLAR_ENVIRONMENT = 'POLAR_ENVIRONMENT';
export const POLAR_PRODUCT_ID_TBD = 'POLAR_PRODUCT_ID_TBD';
export const TBD_PLAN_ID = 'TBD';
export const POLAR_PAST_DUE_GRACE_SECONDS = 'POLAR_PAST_DUE_GRACE_SECONDS';

export type PolarConfig = {
  readonly accessToken: string;
  readonly webhookSecret: string;
  readonly environment: PolarEnvironment;
  readonly products: readonly PolarProductConfig[];
  readonly pastDueGraceSeconds: number;
};

export function loadPolarConfig(env: Readonly<Record<string, string | undefined>>): PolarConfig {
  const environment = required(env, POLAR_ENVIRONMENT);
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new PaymentsError('POLAR_ENVIRONMENT must be sandbox or production');
  }
  return {
    accessToken: required(env, POLAR_ACCESS_TOKEN),
    webhookSecret: required(env, POLAR_WEBHOOK_SECRET),
    environment,
    products: [
      {
        planId: planId(TBD_PLAN_ID),
        productId: required(env, POLAR_PRODUCT_ID_TBD),
      },
    ],
    pastDueGraceSeconds: pastDueGraceSeconds(env[POLAR_PAST_DUE_GRACE_SECONDS]),
  };
}

function pastDueGraceSeconds(value: string | undefined): number {
  if (value === undefined || value.length === 0) {
    return 0;
  }
  if (!/^\d+$/u.test(value)) {
    throw new PaymentsError('POLAR_PAST_DUE_GRACE_SECONDS must be a non-negative integer');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new PaymentsError('POLAR_PAST_DUE_GRACE_SECONDS must be a non-negative integer');
  }
  return parsed;
}

function required(env: Readonly<Record<string, string | undefined>>, name: string): string {
  const value = env[name];
  if (value === undefined || value.length === 0 || /\s/u.test(value)) {
    throw new PaymentsError(`Missing ${name}`);
  }
  return value;
}
