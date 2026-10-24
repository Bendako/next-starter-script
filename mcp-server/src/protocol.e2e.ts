import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { HOSTED_ENV_FLAG, listTools, type ServerConfig } from './tools.js';

const SLOW_SCRIPT = `#!/bin/bash
(sleep 2 && touch finished) &
wait
`;

type Suite = 'ci' | 'qa';
type Expectation = 'ok' | 'error';

type CaseContext = {
  root: string;
  sentinel: string;
  outside: string;
};

type CallArgs = Record<string, unknown> | ((ctx: CaseContext) => Record<string, unknown>);

type ProtocolCall = {
  tool: string;
  args: CallArgs;
  expectation: Expectation;
  text: RegExp;
};

type ProtocolCase = {
  id: string;
  suite: Suite;
  hosted: boolean;
  checkInitialize?: boolean;
  checkList?: boolean;
  calls: ProtocolCall[];
  scriptTimeoutMs?: number;
  scriptBody?: string;
  settleMs?: number;
  absent?: string[];
  project?: string;
  clientTimeoutMs?: number;
  testTimeoutMs?: number;
};

const PROTOCOL_CASES: ProtocolCase[] = [
  {
    id: 'initialize',
    suite: 'ci',
    hosted: false,
    checkInitialize: true,
    calls: [],
  },
  {
    id: 'tools-list-local',
    suite: 'ci',
    hosted: false,
    checkList: true,
    calls: [],
  },
  {
    id: 'tools-list-hosted',
    suite: 'ci',
    hosted: true,
    checkList: true,
    calls: [],
  },
  {
    id: 'call-script-help',
    suite: 'ci',
    hosted: false,
    calls: [
      {
        tool: 'script_help',
        args: {},
        expectation: 'ok',
        text: /Next\.js Starter Script Help[\s\S]*USAGE/,
      },
    ],
  },
  {
    id: 'call-test-script',
    suite: 'ci',
    hosted: false,
    calls: [
      {
        tool: 'test_script',
        args: {},
        expectation: 'ok',
        text: /Script is ready to use/,
      },
    ],
  },
  {
    id: 'call-dry-run',
    suite: 'ci',
    hosted: false,
    calls: [
      {
        tool: 'dry_run',
        args: {
          name: 'protocol-app',
          template: 'minimal',
          skipConvex: true,
          skipClerk: true,
        },
        expectation: 'ok',
        text: /Dry Run Preview for: protocol-app[\s\S]*DRY RUN MODE/,
      },
    ],
  },
  {
    id: 'invalid-name-type',
    suite: 'ci',
    hosted: false,
    calls: [
      {
        tool: 'dry_run',
        args: { name: 1 },
        expectation: 'error',
        text: /Invalid input for dry_run/,
      },
    ],
  },
  {
    id: 'invalid-missing-name',
    suite: 'ci',
    hosted: false,
    calls: [
      {
        tool: 'create_nextjs_app',
        args: {},
        expectation: 'error',
        text: /Invalid input for create_nextjs_app/,
      },
    ],
  },
  {
    id: 'invalid-extra-key',
    suite: 'ci',
    hosted: false,
    calls: [
      {
        tool: 'test_script',
        args: { name: 'ok-app' },
        expectation: 'error',
        text: /Invalid input for test_script/,
      },
    ],
  },
  {
    id: 'invalid-template',
    suite: 'ci',
    hosted: false,
    calls: [
      {
        tool: 'dry_run',
        args: { name: 'ok-app', template: 'nope' },
        expectation: 'error',
        text: /Invalid input for dry_run/,
      },
    ],
  },
  {
    id: 'injection-semicolon',
    suite: 'ci',
    hosted: false,
    calls: [
      {
        tool: 'create_nextjs_app',
        args: (ctx) => ({ name: `foo; touch ${ctx.sentinel}` }),
        expectation: 'error',
        text: /Invalid input for create_nextjs_app/,
      },
    ],
  },
  {
    id: 'injection-command-substitution',
    suite: 'ci',
    hosted: false,
    calls: [
      {
        tool: 'dry_run',
        args: (ctx) => ({ name: `$(touch ${ctx.sentinel})` }),
        expectation: 'error',
        text: /Invalid input for dry_run/,
      },
    ],
  },
  {
    id: 'injection-backtick',
    suite: 'ci',
    hosted: false,
    calls: [
      {
        tool: 'dry_run',
        args: (ctx) => ({ name: `\`touch ${ctx.sentinel}\`` }),
        expectation: 'error',
        text: /Invalid input for dry_run/,
      },
    ],
  },
  {
    id: 'injection-directory',
    suite: 'ci',
    hosted: false,
    calls: [
      {
        tool: 'create_nextjs_app',
        args: (ctx) => ({
          name: 'ok-app',
          directory: `${ctx.outside}; touch ${ctx.sentinel}`,
        }),
        expectation: 'error',
        text: /Cannot write to directory/,
      },
    ],
  },
  {
    id: 'path-dotdot-name',
    suite: 'ci',
    hosted: true,
    calls: [
      {
        tool: 'create_nextjs_app',
        args: { name: '../escape-app' },
        expectation: 'error',
        text: /Invalid input for create_nextjs_app/,
      },
    ],
    absent: ['escape-app', 'nextjs-starter-mcp/escape-app'],
  },
  {
    id: 'path-dotdot-directory',
    suite: 'ci',
    hosted: true,
    calls: [
      {
        tool: 'create_nextjs_app',
        args: { name: 'ok-app', directory: '../outside' },
        expectation: 'error',
        text: /Invalid input for create_nextjs_app/,
      },
    ],
    absent: ['outside/ok-app'],
  },
  {
    id: 'path-absolute-directory',
    suite: 'ci',
    hosted: true,
    calls: [
      {
        tool: 'create_nextjs_app',
        args: (ctx) => ({ name: 'ok-app', directory: ctx.outside }),
        expectation: 'error',
        text: /Invalid input for create_nextjs_app/,
      },
    ],
    absent: ['outside/ok-app'],
  },
  {
    id: 'timeout-kills-long-call',
    suite: 'ci',
    hosted: false,
    scriptBody: SLOW_SCRIPT,
    scriptTimeoutMs: 500,
    settleMs: 2_500,
    calls: [
      {
        tool: 'test_script',
        args: {},
        expectation: 'error',
        text: /Script timed out/,
      },
    ],
    absent: ['finished'],
    testTimeoutMs: 20_000,
  },
  {
    id: 'create-nextjs-app',
    suite: 'qa',
    hosted: true,
    clientTimeoutMs: 15 * 60 * 1000,
    testTimeoutMs: 15 * 60 * 1000,
    calls: [
      {
        tool: 'create_nextjs_app',
        args: {
          name: 'qa-app',
          template: 'minimal',
          skipConvex: true,
          skipClerk: true,
        },
        expectation: 'ok',
        text: /Successfully created Next\.js app: qa-app/,
      },
    ],
    project: 'qa-app',
  },
];

const suite = process.env.MCP_CHECK;
if (suite !== 'ci' && suite !== 'qa') {
  throw new Error('MCP_CHECK must be ci or qa');
}

const selected = PROTOCOL_CASES.filter((spec) => spec.suite === suite);
if (selected.length === 0) {
  throw new Error(`No protocol cases for MCP_CHECK=${suite}`);
}

for (const spec of selected) {
  test(spec.id, { timeout: spec.testTimeoutMs ?? 20_000 }, async () => {
    await runCase(spec);
  });
}

function serverJs(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/index.js');
}

function resolveArgs(args: CallArgs, ctx: CaseContext): Record<string, unknown> {
  return typeof args === 'function' ? args(ctx) : args;
}

function toolText(result: unknown): string {
  if (!result || typeof result !== 'object' || !('content' in result)) return '';
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return '';
  return content
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const record = item as { type?: string; text?: string };
      return record.type === 'text' ? (record.text ?? '') : '';
    })
    .join('\n');
}

function isToolError(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'isError' in result &&
    (result as { isError?: boolean }).isError === true
  );
}

async function assertToolList(client: Client, hosted: boolean): Promise<void> {
  const listed = await client.listTools();
  const config: ServerConfig = hosted
    ? { mode: 'hosted', outputRoot: '/unused' }
    : { mode: 'local' };
  const expected = listTools(config).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
  const actual = listed.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
  assert.deepEqual(actual, expected);
}

async function runCase(spec: ProtocolCase): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-protocol-'));
  const sentinel = path.join(root, 'pwned');
  const outside = path.join(root, 'outside');
  const ctx: CaseContext = { root, sentinel, outside };
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'marker'), 'keep');

  const env: Record<string, string> = { TMPDIR: root, TMP: root };
  if (spec.hosted) env[HOSTED_ENV_FLAG] = 'true';
  if (spec.scriptTimeoutMs !== undefined) {
    env.NEXT_STARTER_MCP_SCRIPT_TIMEOUT_MS = String(spec.scriptTimeoutMs);
  }
  if (spec.scriptBody) {
    const scriptPath = path.join(root, 'slow.sh');
    await fs.writeFile(scriptPath, spec.scriptBody, { mode: 0o755 });
    env.NEXT_STARTER_MCP_SCRIPT_PATH = scriptPath;
  }

  const stderr: Buffer[] = [];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverJs()],
    cwd: root,
    env,
    stderr: 'pipe',
  });
  transport.stderr?.on('data', (chunk: Buffer | string) => {
    stderr.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  });
  const client = new Client(
    { name: 'mcp-protocol-test', version: '0.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    const version = client.getServerVersion();
    assert.equal(version?.name, 'nextjs-starter-script');
    assert.equal(version?.version, '1.0.0');
    if (spec.checkInitialize) {
      assert.ok(client.getServerCapabilities()?.tools);
    }
    if (spec.checkList) {
      await assertToolList(client, spec.hosted);
    }

    for (const call of spec.calls) {
      const result = await client.callTool(
        { name: call.tool, arguments: resolveArgs(call.args, ctx) },
        undefined,
        { timeout: spec.clientTimeoutMs ?? 60_000 },
      );
      const text = toolText(result);
      const detail = `${text}\n${Buffer.concat(stderr).toString('utf8')}`;
      if (call.expectation === 'error') {
        assert.equal(isToolError(result), true, detail);
      } else {
        assert.equal(isToolError(result), false, detail);
      }
      assert.match(text, call.text, detail);
    }

    const listed = await client.listTools();
    assert.equal(listed.tools.length, 4);
    if (spec.settleMs) {
      await new Promise((resolve) => setTimeout(resolve, spec.settleMs));
    }

    assert.equal(await fs.readFile(path.join(outside, 'marker'), 'utf8'), 'keep');
    assert.deepEqual(await fs.readdir(outside), ['marker']);
    await assertAbsent(sentinel);
    for (const relative of spec.absent ?? []) {
      await assertAbsent(path.join(root, relative));
    }
    if (spec.project) {
      const hostedRoot = path.join(root, 'nextjs-starter-mcp');
      const project = path.join(hostedRoot, spec.project);
      const relative = path.relative(hostedRoot, project);
      assert.equal(relative.startsWith('..'), false, project);
      assert.equal(path.isAbsolute(relative), false, project);
      await fs.access(path.join(project, 'package.json'));
    }
  } finally {
    await client.close().catch(() => undefined);
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function assertAbsent(target: string): Promise<void> {
  try {
    await fs.access(target);
  } catch (error) {
    if (isErrno(error, 'ENOENT')) return;
    throw error;
  }
  assert.fail(`${target} exists`);
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
