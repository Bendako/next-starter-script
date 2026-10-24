import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  admitHttpRequest,
  authorizeToolCall,
  callerKey,
  identityAllows,
  MCP_CLOSED,
  takeCallBudget,
  type RateBucket,
} from './gate.js';

function request(url: string, headers?: Record<string, string>): Request {
  return new Request(url, { headers });
}

const opened = { NEXT_STARTER_MCP_ALLOW_LOCAL: '1' };

function toolCall(url: string, env: NodeJS.ProcessEnv) {
  return authorizeToolCall({
    request: request(url),
    env,
    tool: 'dry_run',
    args: { name: 'verify-app' },
  });
}

describe('authorizeToolCall', () => {
  test('opens only when local use is explicit and the process is not on Vercel', () => {
    assert.deepEqual(toolCall('http://203.0.113.10/mcp', opened), { allowed: true });
    assert.equal(identityAllows({
      request: request('http://127.0.0.1/mcp'),
      env: opened,
      tool: 'test_script',
      args: {},
    }), true);
  });

  test('refuses a localhost URL, local dev, and the old production flag', () => {
    for (const env of [
      {},
      { NODE_ENV: 'development' },
      { NODE_ENV: 'production' },
      { VERCEL_ENV: 'preview' },
      { VERCEL_ENV: 'production', NEXT_STARTER_MCP_ALLOW_PRODUCTION: '1' },
      { ...opened, VERCEL: '1' },
    ]) {
      const closed = toolCall('http://127.0.0.1/mcp', env);
      assert.equal(closed.allowed, false);
      if (!closed.allowed) {
        assert.equal(closed.status, 403);
        assert.equal(closed.message, MCP_CLOSED);
      }
      assert.equal(identityAllows({
        request: request('http://127.0.0.1/mcp'),
        env,
        tool: 'test_script',
        args: {},
      }), false);
    }
  });
});

describe('admitHttpRequest', () => {
  test('rejects an Origin outside the localhost default', () => {
    const denied = admitHttpRequest({
      request: request('http://127.0.0.1:3457/mcp', { origin: 'https://evil.example' }),
      env: opened,
      now: 0,
      store: new Map(),
    });
    assert.equal(denied.allowed, false);
    if (!denied.allowed) assert.equal(denied.status, 403);
  });

  test('allows a missing Origin and a configured origin when local use is explicit', () => {
    const store = new Map<string, RateBucket>();
    assert.equal(
      admitHttpRequest({
        request: request('http://203.0.113.10/mcp'),
        env: opened,
        now: 0,
        store,
      }).allowed,
      true,
    );
    assert.equal(
      admitHttpRequest({
        request: request('http://203.0.113.10/mcp', { origin: 'https://app.example' }),
        env: { ...opened, NEXT_STARTER_MCP_ORIGINS: 'https://app.example' },
        now: 0,
        store,
      }).allowed,
      true,
    );
  });

  test('shares one budget off Vercel and evicts expired keys', () => {
    const store = new Map<string, RateBucket>();
    const first = request('http://127.0.0.1:3457/mcp', { 'x-real-ip': '198.51.100.4' });
    const spoofed = request('http://127.0.0.1:3457/mcp', { 'x-real-ip': '198.51.100.5' });
    assert.equal(callerKey(first, undefined, opened), 'local');
    assert.equal(callerKey(spoofed, undefined, opened), 'local');
    assert.equal(callerKey(first, { clientId: 'client-1' }, opened), 'id:client-1');
    assert.equal(
      callerKey(first, undefined, { VERCEL: '1' }),
      'ip:198.51.100.4',
    );
    const input = { request: first, env: opened, now: 1_000, store, limit: 1 };
    assert.equal(admitHttpRequest(input).allowed, true);
    const blocked = admitHttpRequest({ ...input, request: spoofed });
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) assert.equal(blocked.status, 429);

    takeCallBudget(store, 'old', 0, 60, 1_000, 1);
    takeCallBudget(store, 'new', 5_000, 60, 1_000, 1);
    assert.equal(store.has('old'), false);
    assert.equal(store.has('new'), true);
  });
});
