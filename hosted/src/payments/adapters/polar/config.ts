import { PaymentsError } from '../../errors.js';
import { planId } from '../../types.js';
import type { PolarEnvironment } from './client.js';
import type { PolarProductConfig } from './products.js';

export const POLAR_ACCESS_TOKEN = 'POLAR_ACCESS_TOKEN';
export const POLAR_WEBHOOK_SECRET = 'POLAR_WEBHOOK_SECRET';
export const POLAR_ENVIRONMENT = 'POLAR_ENVIRONMENT';
export const POLAR_PRODUCT_ID_TBD_BY_BEN = 'POLAR_PRODUCT_ID_TBD_BY_BEN';
export const TBD_BY_BEN_PLAN_ID = 'TBD_BY_BEN';

export type PolarConfig = {
  readonly accessToken: string;
  readonly webhookSecret: string;
  readonly environment: PolarEnvironment;
  readonly products: readonly PolarProductConfig[];
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
        planId: planId(TBD_BY_BEN_PLAN_ID),
        productId: required(env, POLAR_PRODUCT_ID_TBD_BY_BEN),
      },
    ],
  };
}

function required(env: Readonly<Record<string, string | undefined>>, name: string): string {
  const value = env[name];
  if (value === undefined || value.length === 0 || /\s/u.test(value)) {
    throw new PaymentsError(`Missing ${name}`);
  }
  return value;
}
