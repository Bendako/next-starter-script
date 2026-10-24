import { verifyClerkToken } from '@clerk/mcp-tools/server';
import type { MachineAuthObject } from '@clerk/backend';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterEach, describe, test } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorizeToolCall } from './gate.js';
import { createHostedMcpHandler } from './mcp-http.js';

function authenticated(userId: string): MachineAuthObject<'oauth_token'> {
  return {
    isAuthenticated: true,
    tokenType: 'oauth_token',
    userId,
    clientId: 'client_a',
    scopes: ['openid', 'profile', 'email'],
    id: 'oat_a',
    subject: userId,
    getToken: () => Promise.resolve('token'),
    has: () => false,
    debug: () => ({}),
  } as MachineAuthObject<'oauth_token'>;
}

const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../create-next-starter.sh');

const ENV_KEYS = ['NODE_ENV', 'VERCEL', 'VERCEL_ENV', 'NEXT_STARTER_MCP_ALLOW_LOCAL'] as const;
const savedEnv: Record<string, string | undefined> = {};
let gateOpened = false;

function openLocalGate(): void {
  if (gateOpened) return;
  gateOpened = true;
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  process.env.NEXT_STARTER_MCP_ALLOW_LOCAL = '1';
}

function restoreEnv(): void {
  if (!gateOpened) return;
  gateOpened = false;
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function serve(handler: (request: Request) => Promise<Response>): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('test server has no port');
      }
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const item of value) headers.append(key, item);
        } else {
          headers.set(key, value);
        }
      }
      const response = await handler(
        new Request(`http://127.0.0.1:${address.port}${req.url ?? '/'}`, {
          method: req.method,
          headers,
          body: body && body.length > 0 ? body : undefined,
        }),
      );
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        if (key === 'transfer-encoding') return;
        res.setHeader(key, value);
      });
      if (!response.body) {
        res.end();
        return;
      }
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(value);
      }
      res.end();
    } catch {
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    }
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('test server has no port');
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

afterEach(() => {
  restoreEnv();
});

describe('hosted MCP handler', () => {
  test('requires a Clerk token, then passes that user id into the tool gate', async () => {
    openLocalGate();
    const seen: Array<{ toolName: string; clerkUserId?: string; args: unknown; credential?: string }> = [];
    const handler = createHostedMcpHandler({
      env: {
        NEXT_PUBLIC_CONVEX_URL: '',
        NODE_ENV: 'development',
        NEXT_STARTER_MCP_ALLOW_LOCAL: '1',
      },
      scriptPath,
      verifyToken: async (_request, token) => {
        if (token !== 'token-a') return undefined;
        return verifyClerkToken(authenticated('user_a'), token);
      },
      authorize: (input) => {
        const decision = authorizeToolCall(input);
        seen.push({
          toolName: input.tool,
          args: input.args,
          clerkUserId: decision.allowed ? decision.clerkUserId : undefined,
          credential: decision.allowed ? decision.caller?.credential : undefined,
        });
        return decision;
      },
    });
    const server = await serve(handler);
    try {
      const anonymous = await fetch(`${server.url}/mcp`, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      });
      assert.equal(anonymous.status, 401);
      const challenge = anonymous.headers.get('www-authenticate') ?? '';
      assert.match(challenge, /resource_metadata=/);
      assert.match(challenge, /\/\.well-known\/oauth-protected-resource\/mcp/);

      const forged = await fetch(`${server.url}/mcp`, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          authorization: 'Bearer header.payload.signature',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      assert.equal(forged.status, 401);
      assert.equal(seen.length, 0);

      const client = new Client({ name: 'hosted-auth-test', version: '1.0.0' });
      const transport = new StreamableHTTPClientTransport(new URL(`${server.url}/mcp`), {
        requestInit: { headers: { Authorization: 'Bearer token-a' } },
      });
      await client.connect(transport);
      try {
        const dry = await client.callTool({
          name: 'dry_run',
          arguments: {
            name: 'verify-app',
            template: 'minimal',
            skipConvex: true,
            skipClerk: true,
          },
        });
        assert.equal(Boolean(dry.isError), false);
        const text = dry.content?.find((block) => block.type === 'text');
        assert.equal(text && 'text' in text && text.text.includes('verify-app'), true);
        const rejected = await client.callTool({
          name: 'create_nextjs_app',
          arguments: { name: 'MyApp' },
        });
        assert.equal(rejected.isError, true);
      } finally {
        await client.close();
      }
      assert.equal(seen.length >= 1, true);
      assert.equal(seen[0]?.toolName, 'dry_run');
      assert.equal(seen[0]?.clerkUserId, 'user_a');
      assert.equal(seen[0]?.credential, '_TBD_');
      const firstArgs = seen[0]?.args;
      assert.equal(
        typeof firstArgs === 'object' && firstArgs !== null && 'name' in firstArgs && firstArgs.name === 'verify-app',
        true,
      );
    } finally {
      await server.close();
    }
  });

  test('stays closed when the local flag is unset', async () => {
    const handler = createHostedMcpHandler({
      env: { NODE_ENV: 'development', NEXT_PUBLIC_CONVEX_URL: '' },
      verifyToken: async () => verifyClerkToken(authenticated('user_a'), 'token-a'),
    });
    const server = await serve(handler);
    try {
      const response = await fetch(`${server.url}/mcp`, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          authorization: 'Bearer token-a',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      });
      assert.equal(response.status, 403);
      assert.equal(await response.text(), 'MCP stays closed until authentication is enabled.');
    } finally {
      await server.close();
    }
  });
});
