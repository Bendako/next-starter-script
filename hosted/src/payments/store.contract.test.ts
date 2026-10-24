import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryEntitlementStore } from './memory-store.js';
import type { ApplyResult, EntitlementStore } from './store.js';
import {
  activeSubscription,
  eventId,
  expiredSubscription,
  isoInstant,
  planId,
  userId,
  type EntitlementUpdate,
  type UserId,
} from './types.js';

const stores: ReadonlyArray<readonly [string, () => EntitlementStore]> = [
  ['memory', createMemoryEntitlementStore],
];

const plan = planId('plan_contract');
const start = isoInstant('2026-03-01T00:00:00.000Z');
const end = isoInstant('2026-04-01T00:00:00.000Z');

function update(input: {
  readonly event: string;
  readonly at: string;
  readonly user?: string;
  readonly subscription: EntitlementUpdate['subscription'];
}): EntitlementUpdate {
  return {
    eventId: eventId(input.event),
    occurredAt: isoInstant(input.at),
    userId: userId(input.user ?? 'user_1'),
    subscription: input.subscription,
  };
}

function active(event: string, at: string, periodEnd: string, user?: string): EntitlementUpdate {
  return update({
    event,
    at,
    ...(user === undefined ? {} : { user }),
    subscription: activeSubscription({
      planId: plan,
      currentPeriodStart: start,
      currentPeriodEnd: isoInstant(periodEnd),
    }),
  });
}

describe.each(stores)('%s entitlement store', (_name, create) => {
  let store: EntitlementStore;
  let owner: UserId;

  beforeEach(() => {
    store = create();
    owner = userId('user_1');
  });

  it('returns null when the user has no entitlement', async () => {
    expect(await store.getEntitlement(owner)).toBeNull();
  });

  it('applies an event id once and reports the second delivery as a duplicate', async () => {
    const event = active('evt_1', '2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');

    expect(await store.applyUpdates([event])).toEqual<ApplyResult>({
      applied: 1,
      duplicates: 0,
      stale: 0,
    });
    const stored = await store.getEntitlement(owner);

    expect(await store.applyUpdates([event])).toEqual<ApplyResult>({
      applied: 0,
      duplicates: 1,
      stale: 0,
    });
    expect(await store.getEntitlement(owner)).toEqual(stored);
  });

  it('keeps the first payload when the same event id arrives with a different subscription', async () => {
    const first = active('evt_1', '2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');
    const conflicting = update({
      event: 'evt_1',
      at: '2026-05-01T00:00:00.000Z',
      subscription: expiredSubscription({
        planId: plan,
        currentPeriodEnd: end,
      }),
    });

    await store.applyUpdates([first]);
    expect(await store.applyUpdates([conflicting])).toEqual<ApplyResult>({
      applied: 0,
      duplicates: 1,
      stale: 0,
    });
    expect(await store.getEntitlement(owner)).toEqual({
      userId: owner,
      occurredAt: first.occurredAt,
      subscription: first.subscription,
    });
  });

  it('counts a repeated event id inside one batch as a duplicate', async () => {
    const event = active('evt_1', '2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');
    expect(await store.applyUpdates([event, event])).toEqual<ApplyResult>({
      applied: 1,
      duplicates: 1,
      stale: 0,
    });
    expect((await store.getEntitlement(owner))?.subscription).toEqual(event.subscription);
  });

  it('does not let an earlier event replace a later one, even when its period end is later', async () => {
    const later = update({
      event: 'evt_later',
      at: '2026-03-15T00:00:00.000Z',
      subscription: expiredSubscription({
        planId: plan,
        currentPeriodEnd: isoInstant('2026-03-01T00:00:00.000Z'),
      }),
    });
    const earlier = active('evt_earlier', '2026-03-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');

    await store.applyUpdates([later]);
    expect(await store.applyUpdates([earlier])).toEqual<ApplyResult>({
      applied: 0,
      duplicates: 0,
      stale: 1,
    });
    expect(await store.getEntitlement(owner)).toEqual({
      userId: owner,
      occurredAt: later.occurredAt,
      subscription: later.subscription,
    });
  });

  it('treats an event at the stored time as stale', async () => {
    const first = active('evt_1', '2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');
    const sameTime = active('evt_2', '2026-03-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');

    await store.applyUpdates([first]);
    expect(await store.applyUpdates([sameTime])).toEqual<ApplyResult>({
      applied: 0,
      duplicates: 0,
      stale: 1,
    });
    expect((await store.getEntitlement(owner))?.subscription.state).toBe('active');
    expect((await store.getEntitlement(owner))?.occurredAt).toBe(first.occurredAt);
    expect((await store.getEntitlement(owner))?.subscription).toEqual(first.subscription);
  });

  it('reports a second delivery of a stale event as a duplicate', async () => {
    const later = active('evt_later', '2026-04-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z');
    const earlier = active('evt_earlier', '2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');

    await store.applyUpdates([later]);
    expect(await store.applyUpdates([earlier])).toEqual<ApplyResult>({
      applied: 0,
      duplicates: 0,
      stale: 1,
    });
    expect(await store.applyUpdates([earlier])).toEqual<ApplyResult>({
      applied: 0,
      duplicates: 1,
      stale: 0,
    });
    expect((await store.getEntitlement(owner))?.occurredAt).toBe(later.occurredAt);
  });

  it('keeps the newer event when a batch arrives oldest first or newest first', async () => {
    const older = active('evt_old', '2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');
    const newer = update({
      event: 'evt_new',
      at: '2026-04-02T00:00:00.000Z',
      subscription: expiredSubscription({
        planId: plan,
        currentPeriodEnd: end,
      }),
    });

    const oldestFirst = create();
    expect(await oldestFirst.applyUpdates([older, newer])).toEqual<ApplyResult>({
      applied: 2,
      duplicates: 0,
      stale: 0,
    });
    expect((await oldestFirst.getEntitlement(owner))?.subscription).toEqual(newer.subscription);

    const newestFirst = create();
    expect(await newestFirst.applyUpdates([newer, older])).toEqual<ApplyResult>({
      applied: 1,
      duplicates: 0,
      stale: 1,
    });
    expect((await newestFirst.getEntitlement(owner))?.subscription).toEqual(newer.subscription);
  });

  it('dedupes an event id across users', async () => {
    const firstUser = active('evt_shared', '2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', 'user_1');
    const secondUser = active('evt_shared', '2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', 'user_2');

    expect(await store.applyUpdates([firstUser, secondUser])).toEqual<ApplyResult>({
      applied: 1,
      duplicates: 1,
      stale: 0,
    });
    expect(await store.getEntitlement(userId('user_2'))).toBeNull();
    expect((await store.getEntitlement(owner))?.subscription).toEqual(firstUser.subscription);
  });
});
