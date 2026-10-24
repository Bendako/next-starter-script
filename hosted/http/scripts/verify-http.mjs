import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const httpRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(httpRoot, '../..');
const children = [];
const issuerHost = 'fixture.clerk.accounts.dev';

function publishableKeyForIssuer(host) {
  return `pk_test_${Buffer.from(`${host}$`).toString('base64url')}`;
}

function forgedToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: 'user_forged', exp: Math.floor(Date.now() / 1000) + 600 }),
  ).toString('base64url');
  const signature = Buffer.from('not-a-signature').toString('base64url');
  return `${header}.${payload}.${signature}`;
}

function textOf(result) {
  const block = result.content?.find((item) => item.type === 'text');
  return block && 'text' in block ? block.text : '';
}

function startServer(port, extraEnv, host = '127.0.0.1') {
  const child = spawn('npx', ['next', 'start', '-p', String(port), '-H', host], {
    cwd: httpRoot,
    env: {
      ...process.env,
      NEXT_STARTER_GENERATION_STUB: '1',
      NEXT_PUBLIC_CONVEX_URL: '',
      VERCEL: '',
      VERCEL_ENV: '',
      NEXT_STARTER_MCP_ALLOW_PRODUCTION: '',
      NEXT_STARTER_MCP_ALLOW_LOCAL: '',
      CLERK_SECRET_KEY: '',
      ...extraEnv,
    },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  return child;
}

function stopAll() {
  for (const child of children) {
    if (!child.pid) continue;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

async function waitForServer(child, base) {
  const started = Date.now();
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  while (Date.now() - started < 30_000) {
    if (child.exitCode !== null) {
      throw new Error(`next start exited ${child.exitCode}\n${output}`);
    }
    try {
      const response = await fetch(`${base}/`);
      if (response.ok || response.status === 403) return;
    } catch {
      // the listener is not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`timed out waiting for ${base}\n${output}`);
}

function lanAddress() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.internal || entry.family !== 'IPv4') continue;
      return entry.address;
    }
  }
  throw new Error('no non-loopback IPv4 address');
}

async function expectClosed(url, label) {
  let response;
  try {
    response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'script_help', arguments: {} },
    }),
  });
    const body = await response.text();
    console.log(`\n## ${label}`);
    console.log(`status=${response.status}`);
    console.log(body.slice(0, 200));
    if (response.status !== 403) {
      throw new Error(`${label} returned ${response.status}`);
    }
  } catch (error) {
    if (error instanceof Error && 'cause' in error) {
      const code = error.cause && typeof error.cause === 'object' && 'code' in error.cause ? error.cause.code : '';
      if (code === 'ECONNREFUSED' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
        console.log(`\n## ${label}`);
        console.log(`closed ${code}`);
        return;
      }
    }
    if (error instanceof Error && error.message.startsWith(`${label} returned`)) throw error;
    throw error;
  }
}

async function expectGateClosed(url, label) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'script_help', arguments: {} },
    }),
  });
  const body = await response.text();
  console.log(`\n## ${label}`);
  console.log(`status=${response.status}`);
  console.log(body.slice(0, 200));
  if (response.status !== 403) {
    throw new Error(`${label} returned ${response.status}`);
  }
}

const port = 3457;
const base = `http://127.0.0.1:${port}`;
const lan = lanAddress();
const server = startServer(port, {
  NEXT_STARTER_MCP_ALLOW_LOCAL: '1',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKeyForIssuer(issuerHost),
});
const closed = startServer(3460, {});
const production = startServer(3458, {
  VERCEL: '1',
  VERCEL_ENV: 'production',
  NEXT_STARTER_MCP_ALLOW_PRODUCTION: '1',
  NEXT_STARTER_MCP_ALLOW_LOCAL: '1',
});
const preview = startServer(3459, {
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  NEXT_STARTER_MCP_ALLOW_LOCAL: '1',
});
const wide = startServer(3461, { NEXT_STARTER_MCP_ALLOW_LOCAL: '' }, '0.0.0.0');

try {
  await Promise.all([
    waitForServer(server, base),
    waitForServer(closed, 'http://127.0.0.1:3460'),
    waitForServer(production, 'http://127.0.0.1:3458'),
    waitForServer(preview, 'http://127.0.0.1:3459'),
    waitForServer(wide, `http://${lan}:3461`),
  ]);
  await expectClosed('http://127.0.0.1:3460/mcp', 'no local allow');
  await expectClosed(`http://${lan}:${port}/mcp`, 'loopback bind');
  await expectGateClosed(`http://${lan}:3461/mcp`, 'non-loopback gate');
  await expectClosed('http://127.0.0.1:3458/mcp', 'production closed');
  await expectClosed('http://127.0.0.1:3459/mcp', 'preview closed');

  const home = await fetch(`${base}/`);
  if (!home.ok) throw new Error(`home status ${home.status}`);

  const evil = await fetch(`${base}/mcp`, { headers: { origin: 'https://evil.example' } });
  console.log('\n## bad origin');
  console.log(`status=${evil.status}`);
  if (evil.status !== 403) {
    throw new Error(`bad origin returned ${evil.status}`);
  }

  const anonymous = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'hosted-verify', version: '1.0.0' },
      },
    }),
  });
  const challenge = anonymous.headers.get('www-authenticate') ?? '';
  console.log('\n## anonymous');
  console.log(`status=${anonymous.status}`);
  console.log(challenge);
  if (anonymous.status !== 401) throw new Error(`expected 401, got ${anonymous.status}`);
  if (!challenge.includes('resource_metadata=')) throw new Error('missing resource_metadata challenge');
  if (!challenge.includes('/.well-known/oauth-protected-resource/mcp')) {
    throw new Error('challenge does not point at the protected-resource metadata');
  }

  const forged = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      authorization: `Bearer ${forgedToken()}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  console.log('\n## forged');
  console.log(`status=${forged.status}`);
  if (forged.status !== 401) throw new Error(`forged token status ${forged.status}`);

  const metadataPaths = [
    ['/.well-known/oauth-protected-resource', base],
    ['/.well-known/oauth-protected-resource/mcp', `${base}/mcp`],
  ];
  for (const [metadataPath, resource] of metadataPaths) {
    const response = await fetch(`${base}${metadataPath}`);
    const body = await response.json();
    console.log(metadataPath, response.status, body.resource, (body.authorization_servers ?? []).join(','));
    if (response.status !== 200) throw new Error(`${metadataPath} status ${response.status}`);
    if (body.resource !== resource) throw new Error(`${metadataPath} resource ${body.resource}`);
    if (!Array.isArray(body.authorization_servers) || body.authorization_servers[0] !== `https://${issuerHost}`) {
      throw new Error(`${metadataPath} did not name the Clerk authorization server`);
    }
    if (!Array.isArray(body.scopes_supported) || !body.scopes_supported.includes('openid')) {
      throw new Error(`${metadataPath} did not list scopes`);
    }
    if (JSON.stringify(body).includes('pk_test_')) {
      throw new Error(`${metadataPath} echoed the publishable key`);
    }
  }
  console.log('\nhttp-ok');
} finally {
  stopAll();
}

const stdio = new Client({ name: 'stdio-verify', version: '1.0.0' });
const stdioTransport = new StdioClientTransport({
  command: 'node',
  args: [path.join(repo, 'mcp-server', 'dist', 'index.js')],
  cwd: repo,
  stderr: 'pipe',
});
await stdio.connect(stdioTransport);
const stdioTools = await stdio.listTools();
console.log('stdio-tools', stdioTools.tools.map((tool) => tool.name).join(','));
const stdioHelp = await stdio.callTool({ name: 'script_help', arguments: {} });
if (stdioHelp.isError) {
  throw new Error(`stdio script_help failed: ${textOf(stdioHelp).slice(0, 300)}`);
}
const stdioCreate = stdioTools.tools.find((tool) => tool.name === 'create_nextjs_app');
if (!stdioCreate?.inputSchema?.properties?.directory) {
  throw new Error('stdio tools/list dropped directory');
}
await stdio.close();
console.log('stdio-ok');
process.exit(0);
