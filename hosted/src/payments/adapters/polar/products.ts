import { PaymentsError } from '../../errors.js';
import type { PlanId } from '../../types.js';

export type PolarProductConfig = {
  readonly planId: PlanId;
  readonly productId: string;
};

export type PolarProductIndex = {
  readonly byPlan: ReadonlyMap<PlanId, string>;
  readonly byProduct: ReadonlyMap<string, PlanId>;
};

export function indexProducts(products: readonly PolarProductConfig[]): PolarProductIndex {
  const byPlan = new Map<PlanId, string>();
  const byProduct = new Map<string, PlanId>();
  for (const product of products) {
    if (product.productId.length === 0 || /\s/u.test(product.productId)) {
      throw new PaymentsError('Polar product id must be a non-empty token');
    }
    if (byPlan.has(product.planId) || byProduct.has(product.productId)) {
      throw new PaymentsError('Polar plan and product ids must be one to one');
    }
    byPlan.set(product.planId, product.productId);
    byProduct.set(product.productId, product.planId);
  }
  return { byPlan, byProduct };
}
