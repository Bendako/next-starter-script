import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { admitHttpRequest, authorizeToolCall, callerKey, MCP_CLOSED, type RateBucket } from './gate.js';

function request(url: string, headers?: Record<string, string>): Request {
  return new Request(url, { headers });
}

const local = { NODE_ENV: 'development' };
const started = { NODE_ENV: 'production' };

function toolCall(url: string, env: NodeJS.ProcessEnv) {
  return authorizeToolCall({
    request: request(url),
    env,
    tool: 'dry_run',
    args: { name: 'verify-app' },
  });
}

describe('authorizeToolCall', () => {
  test('allows local dev and a loopback next start', () => {
    assert.deepEqual(toolCall('http://localhost:3000/mcp', local), { allowed: true });
    assert.deepEqual(toolCall('http://127.0.0.1:3457/mcp', started), { allowed: true });
    assert.deepEqual(toolCall('http://[::1]:3457/mcp', started), { allowed: true });
  });

  test('refuses production even when the old flag is set', () => {
    const closed = toolCall('http://127.0.0.1/mcp', {
      ...started,
      VERCEL_ENV: 'production',
      NEXT_STARTER_MCP_ALLOW_PRODUCTION: '1',
    });
    assert.equal(closed.allowed, false);
    if (!closed.allowed) {
      assert.equal(closed.status, 403);
      assert.equal(closed.message, MCP_CLOSED);
    }
  });

  test('refuses preview', () => {
    const closed = toolCall('http://127.0.0.1/mcp', { ...started, VERCEL_ENV: 'preview' });
    assert.equal(closed.allowed, false);
  });

  test('refuses a self-hosted next start that is not loopback', () => {
    const closed = toolCall('http://203.0.113.10/mcp', started);
    assert.equal(closed.allowed, false);
    if (!closed.allowed) assert.equal(closed.status, 403);
  });
});

describe('admitHttpRequest', () => {
  test('rejects an Origin outside the localhost default', () => {
    const denied = admitHttpRequest({
      request: request('http://127.0.0.1:3457/mcp', { origin: 'https://evil.example' }),
      env: local,
      now: 0,
      store: new Map(),
    });
    assert.equal(denied.allowed, false);
    if (!denied.allowed) assert.equal(denied.status, 403);
  });

  test('allows a missing Origin and a configured origin', () => {
    const store = new Map<string, RateBucket>();
    assert.equal(
      admitHttpRequest({
        request: request('http://127.0.0.1:3457/mcp'),
        env: local,
        now: 0,
        store,
      }).allowed,
      true,
    );
    assert.equal(
      admitHttpRequest({
        request: request('http://203.0.113.10/mcp', { origin: 'https://app.example' }),
        env: { ...local, NEXT_STARTER_MCP_ORIGINS: 'https://app.example' },
        now: 0,
        store,
      }).allowed,
      true,
    );
  });

  test('returns 429 after the caller budget is spent', () => {
    const store = new Map<string, RateBucket>();
    const input = {
      request: request('http://127.0.0.1:3457/mcp', { 'x-real-ip': '198.51.100.4' }),
      env: local,
      now: 1_000,
      store,
      limit: 1,
    };
    assert.equal(admitHttpRequest(input).allowed, true);
    const blocked = admitHttpRequest(input);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) assert.equal(blocked.status, 429);
    assert.equal(callerKey(input.request, { sub: 'user-1' }), 'id:user-1');
  });
});
