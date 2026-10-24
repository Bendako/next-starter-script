import type { MachineAuthObject } from '@clerk/backend';
import { verifyClerkToken } from '@clerk/mcp-tools/server';
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { verifyHostedMcpToken } from './clerk-token.js';

function authenticated(userId: string): MachineAuthObject<'oauth_token'> {
  return {
    isAuthenticated: true,
    tokenType: 'oauth_token',
    userId,
    clientId: 'client_a',
    scopes: ['openid', 'profile'],
    id: 'oat_a',
    subject: userId,
    getToken: () => Promise.resolve('token'),
    has: () => false,
    debug: () => ({}),
  } as MachineAuthObject<'oauth_token'>;
}

function rejected(): MachineAuthObject<'oauth_token'> {
  return {
    isAuthenticated: false,
    tokenType: 'oauth_token',
    userId: null,
    clientId: null,
    scopes: null,
    id: null,
    subject: null,
    getToken: () => Promise.resolve(null),
    has: () => false,
    debug: () => ({}),
  } as MachineAuthObject<'oauth_token'>;
}

describe('verifyHostedMcpToken', () => {
  test('does not call Clerk when the bearer token is missing', async () => {
    let called = false;
    const info = await verifyHostedMcpToken(new Request('http://127.0.0.1/mcp'), undefined, async () => {
      called = true;
      return authenticated('user_a');
    });
    assert.equal(called, false);
    assert.equal(info, undefined);
  });

  test('returns undefined when Clerk rejects an expired or invalid token', async () => {
    const expired = 'header.payload.signature';
    assert.equal(verifyClerkToken(rejected(), expired), undefined);
    const info = await verifyHostedMcpToken(new Request('http://127.0.0.1/mcp'), expired, async (options) => {
      assert.equal(options?.acceptsToken, 'oauth_token');
      return rejected();
    });
    assert.equal(info, undefined);
  });

  test('returns Clerk auth info for a token Clerk accepted', async () => {
    const info = await verifyHostedMcpToken(new Request('http://127.0.0.1/mcp'), 'token-a', async () =>
      authenticated('user_a'),
    );
    assert.equal(info?.extra?.userId, 'user_a');
    assert.equal(info?.extra?.verifiedBy, 'clerk');
    assert.equal(info?.clientId, 'client_a');
  });

  test('fails closed when Clerk throws', async () => {
    const info = await verifyHostedMcpToken(new Request('http://127.0.0.1/mcp'), 'token-a', async () => {
      throw new Error('Clerk is not configured');
    });
    assert.equal(info, undefined);
  });
});
