import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import schema from '../convex/schema.js';

const viewer = makeFunctionReference<'query', Record<string, never>, { clerkUserId: string }>('identity:viewer');
const listOwned = makeFunctionReference<
  'query',
  { userId?: string },
  { jobs: Array<{ userId: string }>; downloads: Array<{ userId: string }> }
>('identity:listOwned');

const modules = {
  './_generated/api.js': async () => ({}),
  './identity.js': () => import('../convex/identity.js'),
};

describe('Clerk identity on Convex', () => {
  test('a signed-in session returns its own Clerk user id', async () => {
    const t = convexTest(schema, modules);
    const asA = t.withIdentity({ subject: 'user_a' });
    assert.deepEqual(await asA.query(viewer, {}), { clerkUserId: 'user_a' });
  });

  test('a signed-out call is rejected', async () => {
    const t = convexTest(schema, modules);
    await assert.rejects(() => t.query(viewer, {}), /Not authenticated/);
    await assert.rejects(() => t.query(listOwned, { userId: 'user_a' }), /Not authenticated/);
  });

  test('user A cannot see user B jobs or downloads, even if the client sends user B id', async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const jobA = await ctx.db.insert('jobs', { userId: 'user_a', status: 'ready', createdAt: 1 });
      const jobB = await ctx.db.insert('jobs', { userId: 'user_b', status: 'ready', createdAt: 2 });
      await ctx.db.insert('downloads', { userId: 'user_a', jobId: jobA, createdAt: 3 });
      await ctx.db.insert('downloads', { userId: 'user_b', jobId: jobB, createdAt: 4 });
    });

    const asA = t.withIdentity({ subject: 'user_a' });
    const asB = t.withIdentity({ subject: 'user_b' });
    const seenByA = await asA.query(listOwned, { userId: 'user_b' });
    const seenByB = await asB.query(listOwned, {});
    assert.deepEqual(seenByA, {
      jobs: [{ userId: 'user_a' }],
      downloads: [{ userId: 'user_a' }],
    });
    assert.deepEqual(seenByB, {
      jobs: [{ userId: 'user_b' }],
      downloads: [{ userId: 'user_b' }],
    });
  });
});
