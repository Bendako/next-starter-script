import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const httpRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(httpRoot, '../..');
const children = [];

function textOf(result) {
  const block = result.content?.find((item) => item.type === 'text');
  return block && 'text' in block ? block.text : '';
}

function startServer(port, extraEnv) {
  const child = spawn('npx', ['next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: httpRoot,
    env: {
      ...process.env,
      NEXT_STARTER_GENERATION_STUB: '1',
      NEXT_PUBLIC_CONVEX_URL: '',
      VERCEL: '',
      VERCEL_ENV: '',
      NEXT_STARTER_MCP_ALLOW_PRODUCTION: '',
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

async function expectClosed(port, label) {
  const base = `http://127.0.0.1:${port}`;
  const response = await fetch(`${base}/mcp`, {
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

async function callTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  const text = textOf(result);
  console.log(`\n## ${name}`);
  console.log(`isError=${Boolean(result.isError)}`);
  console.log(text.slice(0, 500));
  if (result.isError) {
    throw new Error(`${name} failed: ${text.slice(0, 500)}`);
  }
  return text;
}

const port = 3457;
const base = `http://127.0.0.1:${port}`;
const server = startServer(port, {});
const production = startServer(3458, {
  VERCEL_ENV: 'production',
  NEXT_STARTER_MCP_ALLOW_PRODUCTION: '1',
});
const preview = startServer(3459, { VERCEL_ENV: 'preview' });

try {
  await Promise.all([
    waitForServer(server, base),
    waitForServer(production, 'http://127.0.0.1:3458'),
    waitForServer(preview, 'http://127.0.0.1:3459'),
  ]);
  await expectClosed(3458, 'production closed');
  await expectClosed(3459, 'preview closed');

  const evil = await fetch(`${base}/mcp`, { headers: { origin: 'https://evil.example' } });
  console.log('\n## bad origin');
  console.log(`status=${evil.status}`);
  if (evil.status !== 403) {
    throw new Error(`bad origin returned ${evil.status}`);
  }

  const client = new Client({ name: 'hosted-verify', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`));
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  console.log('tools', names.join(','));
  const create = listed.tools.find((tool) => tool.name === 'create_nextjs_app');
  const properties = create?.inputSchema?.properties ?? {};
  if ('directory' in properties || 'force' in properties) {
    throw new Error('hosted tools/list still advertises directory or force');
  }
  if (!names.includes('script_help') || !names.includes('test_script') || !names.includes('dry_run')) {
    throw new Error(`missing tools: ${names.join(',')}`);
  }
  const help = await callTool(client, 'script_help', {});
  if (!help.includes('app-name') && !help.includes('Usage')) {
    throw new Error('script_help did not return script usage');
  }
  await callTool(client, 'test_script', {});
  const dry = await callTool(client, 'dry_run', {
    name: 'verify-app',
    template: 'minimal',
    skipConvex: true,
    skipClerk: true,
  });
  if (!dry.includes('verify-app')) {
    throw new Error('dry_run did not name the app');
  }
  const created = await callTool(client, 'create_nextjs_app', {
    name: 'verify-app',
    template: 'minimal',
    skipConvex: true,
    skipClerk: true,
  });
  if (created !== 'generation succeeded, delivery not yet available') {
    throw new Error(`unexpected create result: ${created}`);
  }
  const rejected = await client.callTool({
    name: 'create_nextjs_app',
    arguments: { name: 'MyApp' },
  });
  console.log('\n## create_nextjs_app MyApp');
  console.log(`isError=${Boolean(rejected.isError)}`);
  console.log(textOf(rejected).slice(0, 300));
  if (!rejected.isError) {
    throw new Error('uppercase name was accepted');
  }
  await client.close();
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
