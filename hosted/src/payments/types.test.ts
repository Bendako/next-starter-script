import { describe, expect, it } from 'vitest';

import { InvalidIdentifierError, InvalidPeriodError } from './errors.js';
import { activeSubscription, eventId, isoInstant, planId, userId } from './types.js';

describe('payment identifiers', () => {
  it('accepts a canonical UTC instant and rejects a value that is not that instant', () => {
    expect(isoInstant('2026-02-01T00:00:00.000Z')).toBe('2026-02-01T00:00:00.000Z');
    expect(() => isoInstant('2026-02-31T00:00:00.000Z')).toThrow(InvalidIdentifierError);
    expect(() => isoInstant('2026-02-01T00:00:00Z')).toThrow(InvalidIdentifierError);
    expect(() => isoInstant('')).toThrow(InvalidIdentifierError);
  });

  it('rejects an empty id', () => {
    expect(() => userId('')).toThrow(InvalidIdentifierError);
    expect(() => userId(' user ')).toThrow(InvalidIdentifierError);
    expect(() => planId('')).toThrow(InvalidIdentifierError);
    expect(() => eventId(' ')).toThrow(InvalidIdentifierError);
  });

  it('rejects a period that ends before it starts', () => {
    const plan = planId('plan_contract');
    expect(() =>
      activeSubscription({
        planId: plan,
        currentPeriodStart: isoInstant('2026-03-01T00:00:00.000Z'),
        currentPeriodEnd: isoInstant('2026-02-01T00:00:00.000Z'),
      }),
    ).toThrow(InvalidPeriodError);
  });
});
