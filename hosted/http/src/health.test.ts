import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { healthForTool, readConvexHealth } from './health.js';

describe('readConvexHealth', () => {
  test('skips the query when the Convex URL is unset', async () => {
    let called = false;
    const result = await readConvexHealth({}, async () => {
      called = true;
      return 'OK';
    });
    assert.equal(result, 'skipped');
    assert.equal(called, false);
  });

  test('returns OK when the query does', async () => {
    const result = await readConvexHealth(
      { NEXT_PUBLIC_CONVEX_URL: 'https://example.convex.cloud' },
      async (url) => {
        assert.equal(url, 'https://example.convex.cloud');
        return 'OK';
      },
    );
    assert.equal(result, 'OK');
  });

  test('fails when the query returns anything else', async () => {
    await assert.rejects(
      readConvexHealth({ NEXT_PUBLIC_CONVEX_URL: 'https://example.convex.cloud' }, async () => 'no'),
      /did not return OK/,
    );
  });
});

describe('healthForTool', () => {
  test('does not query Convex for tools other than create', async () => {
    let called = false;
    const result = await healthForTool('script_help', { NEXT_PUBLIC_CONVEX_URL: 'https://example.convex.cloud' }, async () => {
      called = true;
      return 'OK';
    });
    assert.equal(result, undefined);
    assert.equal(called, false);
  });

  test('returns a tool error when create cannot reach Convex', async () => {
    const result = await healthForTool('create_nextjs_app', { NEXT_PUBLIC_CONVEX_URL: 'https://example.convex.cloud' }, async () => 'no');
    assert.equal(result, 'Convex health query did not return OK');
  });
});
