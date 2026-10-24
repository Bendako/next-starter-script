import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  metadataRequestUrl,
  protectedResourceResponse,
  publishableKeyForIssuer,
  resourceUrlForMetadata,
} from './protected-resource.js';

const issuerHost = 'fixture.clerk.accounts.dev';

describe('protected resource metadata', () => {
  test('names the resource from the well-known path', () => {
    assert.equal(
      resourceUrlForMetadata('http://127.0.0.1:3457/.well-known/oauth-protected-resource'),
      'http://127.0.0.1:3457',
    );
    assert.equal(
      resourceUrlForMetadata('http://127.0.0.1:3457/.well-known/oauth-protected-resource/mcp'),
      'http://127.0.0.1:3457/mcp',
    );
    assert.equal(
      metadataRequestUrl(
        new Request('http://localhost:3457/.well-known/oauth-protected-resource/mcp', {
          headers: { host: '127.0.0.1:3457' },
        }),
      ),
      'http://127.0.0.1:3457/.well-known/oauth-protected-resource/mcp',
    );
  });

  test('names the Clerk authorization server', async () => {
    const key = publishableKeyForIssuer(issuerHost);
    const response = protectedResourceResponse(
      new Request('http://127.0.0.1:3457/.well-known/oauth-protected-resource/mcp'),
      key,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.resource, 'http://127.0.0.1:3457/mcp');
    assert.deepEqual(body.authorization_servers, [`https://${issuerHost}`]);
    assert.deepEqual(body.scopes_supported, ['openid', 'profile', 'email']);
    assert.equal(JSON.stringify(body).includes(key), false);
  });

  test('fails closed when the publishable key is missing or unreadable', async () => {
    const missing = protectedResourceResponse(
      new Request('http://127.0.0.1/.well-known/oauth-protected-resource'),
      undefined,
    );
    assert.equal(missing.status, 500);
    const missingBody = await missing.json();
    assert.equal(missingBody.error, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set');

    const broken = protectedResourceResponse(
      new Request('http://127.0.0.1/.well-known/oauth-protected-resource/mcp'),
      'not-a-key',
    );
    assert.equal(broken.status, 500);
    const brokenBody = await broken.json();
    assert.equal(brokenBody.error, 'Clerk publishable key could not be read');
    assert.equal(JSON.stringify(brokenBody).includes('not-a-key'), false);
  });
});
