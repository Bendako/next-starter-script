import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { runScript } from './run.js';
import {
  dispatchTool,
  HOSTED_ENV_FLAG,
  listTools,
  readServerConfig,
  type ScriptCall,
  type ServerConfig,
} from './tools.js';

const localConfig: ServerConfig = { mode: 'local' };

const injectionNames = [
  'a; rm -rf ~',
  '; rm -rf',
  '$(id)',
  '`id`',
  '../etc',
  'foo\nbar',
  'a;rm',
  '-rf',
  '_hidden',
  'MyApp',
  'app',
  'a'.repeat(215),
  'a'.repeat(10_000),
];

const injectionTemplates = [
  'nope',
  'default; rm -rf ~',
  '$(id)',
  '`id`',
  '../',
  'full\nbad',
  'x'.repeat(500),
];

function recordingRunner() {
  const calls: ScriptCall[] = [];
  return {
    calls,
    run: async (call: ScriptCall) => {
      calls.push(call);
      return { stdout: 'created', stderr: 'warn' };
    },
  };
}

async function expectRejected(tool: string, args: unknown, config: ServerConfig) {
  const runner = recordingRunner();
  const result = await dispatchTool({ name: tool, args, config, run: runner.run });
  assert.equal(result.isError, true);
  assert.equal(runner.calls.length, 0);
  assert.equal(result.content[0]?.type, 'text');
  assert.ok(result.content[0].text.length > 0);
  return result;
}

describe('tool input validation', () => {
  for (const name of injectionNames) {
    for (const config of [localConfig, hostedConfig('/tmp/unused-hosted-root')] as const) {
      test(`create_nextjs_app rejects ${JSON.stringify(name)} in ${config.mode} mode`, async () => {
        await expectRejected('create_nextjs_app', { name }, config);
      });

      test(`dry_run rejects ${JSON.stringify(name)} in ${config.mode} mode`, async () => {
        await expectRejected('dry_run', { name }, config);
      });
    }
  }

  for (const template of injectionTemplates) {
    test(`create_nextjs_app rejects template ${JSON.stringify(template)}`, async () => {
      await expectRejected('create_nextjs_app', { name: 'my-app', template }, localConfig);
    });

    test(`dry_run rejects template ${JSON.stringify(template)}`, async () => {
      await expectRejected('dry_run', { name: 'my-app', template }, localConfig);
    });
  }

  test('rejects unknown keys and non-booleans without running the script', async () => {
    await expectRejected('create_nextjs_app', { name: 'my-app', extra: true }, localConfig);
    await expectRejected('dry_run', { name: 'my-app', directory: '/tmp' }, localConfig);
    await expectRejected('test_script', { name: 'my-app' }, localConfig);
    await expectRejected('script_help', { force: true }, localConfig);
    await expectRejected('create_nextjs_app', { name: 'my-app', force: 'true' }, localConfig);
    await expectRejected('create_nextjs_app', { name: 'my-app', skipConvex: 'false' }, localConfig);
  });

  test('rejects an overlong directory without running the script', async () => {
    await expectRejected(
      'create_nextjs_app',
      { name: 'my-app', directory: 'a'.repeat(4097) },
      localConfig,
    );
    await expectRejected(
      'create_nextjs_app',
      { name: 'my-app', directory: 'ok\0hidden' },
      localConfig,
    );
  });

  test('a missing local directory does not run the script', async () => {
    const missing = path.join(os.tmpdir(), `mcp-missing-${process.pid}-${Date.now()}`);
    await expectRejected('create_nextjs_app', { name: 'my-app', directory: missing }, localConfig);
  });
});

describe('hosted mode', () => {
  test('refuses directory and force and does not create the output root', async () => {
    const outputRoot = path.join(os.tmpdir(), `mcp-hosted-refuse-${process.pid}-${Date.now()}`);
    const config = hostedConfig(outputRoot);
    const directoryResult = await expectRejected(
      'create_nextjs_app',
      { name: 'my-app', directory: '/tmp/elsewhere' },
      config,
    );
    const forceResult = await expectRejected(
      'create_nextjs_app',
      { name: 'my-app', force: true },
      config,
    );
    assert.match(directoryResult.content[0].text, /directory/);
    assert.match(forceResult.content[0].text, /force/);
    await assert.rejects(fs.access(outputRoot));
  });

  test('tools/list omits directory and force', () => {
    const tools = listTools(hostedConfig('/tmp/hosted-list'));
    const create = tools.find((tool) => tool.name === 'create_nextjs_app');
    assert.ok(create);
    assert.equal(create.inputSchema.properties.directory, undefined);
    assert.equal(create.inputSchema.properties.force, undefined);
    assert.equal(create.inputSchema.additionalProperties, false);
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ['create_nextjs_app', 'test_script', 'script_help', 'dry_run'],
    );
  });

  test('writes under the server output root', async () => {
    const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-hosted-ok-'));
    try {
      const runner = recordingRunner();
      const result = await dispatchTool({
        name: 'create_nextjs_app',
        args: {
          name: 'my-app',
          template: 'minimal',
          skipConvex: true,
          skipClerk: true,
        },
        config: hostedConfig(outputRoot),
        run: runner.run,
      });
      assert.notEqual(result.isError, true);
      assert.deepEqual(runner.calls, [
        {
          cwd: outputRoot,
          args: ['--skip-convex', '--skip-clerk', '--template', 'minimal', 'my-app'],
        },
      ]);
      assert.equal(runner.calls[0].args.includes('--force'), false);
      assert.match(result.content[0].text, new RegExp(`Location: ${outputRoot}/my-app`));
      const stat = await fs.stat(outputRoot);
      assert.equal(stat.isDirectory(), true);
    } finally {
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  });
});

describe('local mode', () => {
  test('tools/list still advertises directory and force', () => {
    const create = listTools(localConfig).find((tool) => tool.name === 'create_nextjs_app');
    assert.ok(create);
    assert.ok(create.inputSchema.properties.directory);
    assert.ok(create.inputSchema.properties.force);
    assert.deepEqual(create.inputSchema.required, ['name']);
  });

  test('accepts a 214 character name and passes it as one argument', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-local-long-'));
    const name = 'a'.repeat(214);
    try {
      const runner = recordingRunner();
      const result = await dispatchTool({
        name: 'create_nextjs_app',
        args: { name, directory },
        config: localConfig,
        run: runner.run,
      });
      assert.equal(result.isError, undefined);
      assert.equal(runner.calls.length, 1);
      assert.equal(runner.calls[0].args.at(-1), name);
      assert.equal(runner.calls[0].cwd, directory);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  test('passes flags and the project name as separate argv entries', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-local-ok-'));
    try {
      const runner = recordingRunner();
      const result = await dispatchTool({
        name: 'create_nextjs_app',
        args: {
          name: 'my-app',
          directory,
          template: 'full',
          skipConvex: true,
          skipClerk: false,
          verbose: true,
          force: true,
        },
        config: localConfig,
        run: runner.run,
      });
      assert.equal(result.isError, undefined);
      assert.deepEqual(runner.calls, [
        {
          cwd: directory,
          args: ['--skip-convex', '--template', 'full', '--verbose', '--force', 'my-app'],
        },
      ]);
      assert.match(result.content[0].text, /Successfully created Next.js app: my-app/);
      assert.match(result.content[0].text, /Additional info:\nwarn/);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  test('dry_run, test_script, and script_help keep their argv', async () => {
    const runner = recordingRunner();
    const dry = await dispatchTool({
      name: 'dry_run',
      args: { name: 'my-app', template: 'minimal', skipClerk: true },
      config: localConfig,
      run: runner.run,
    });
    const tested = await dispatchTool({
      name: 'test_script',
      args: {},
      config: localConfig,
      run: runner.run,
    });
    const help = await dispatchTool({
      name: 'script_help',
      args: {},
      config: localConfig,
      run: runner.run,
    });
    assert.equal(dry.isError, undefined);
    assert.equal(tested.isError, undefined);
    assert.equal(help.isError, undefined);
    assert.deepEqual(
      runner.calls.map((call) => call.args),
      [
        ['--dry-run', '--skip-clerk', '--template', 'minimal', 'my-app'],
        ['--test'],
        ['--help'],
      ],
    );
    assert.match(dry.content[0].text, /Dry Run Preview for: my-app/);
  });

  test('unknown tool does not run the script', async () => {
    const result = await expectRejected('create_app', { name: 'my-app' }, localConfig);
    assert.match(result.content[0].text, /Unknown tool: create_app/);
  });
});

describe('server config', () => {
  test('hosted mode is an explicit env flag', () => {
    assert.deepEqual(readServerConfig({}), { mode: 'local' });
    assert.deepEqual(readServerConfig({ [HOSTED_ENV_FLAG]: '0' }), { mode: 'local' });
    assert.deepEqual(readServerConfig({ [HOSTED_ENV_FLAG]: 'false' }), { mode: 'local' });
    assert.deepEqual(readServerConfig({ [HOSTED_ENV_FLAG]: '' }), { mode: 'local' });
    const hosted = readServerConfig({ [HOSTED_ENV_FLAG]: '1' });
    const hostedWord = readServerConfig({ [HOSTED_ENV_FLAG]: ' TRUE ' });
    assert.equal(hosted.mode, 'hosted');
    assert.equal(hostedWord.mode, 'hosted');
    if (hosted.mode === 'hosted') {
      assert.equal(hosted.outputRoot, path.resolve(os.tmpdir(), 'nextjs-starter-mcp'));
    }
  });
});

describe('script runner', () => {
  test('passes metacharacters through argv without shell expansion', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-argv-'));
    const scriptPath = path.join(directory, 'print-args.sh');
    const args = ['$(echo SENTINEL_DOLLAR)', '`echo SENTINEL_TICK`', '; echo SENTINEL_SEMI'];
    try {
      await fs.writeFile(scriptPath, '#!/bin/bash\nprintf "%s\\n" "$@"\n');
      const output = await runScript(scriptPath, { args, cwd: directory });
      assert.equal(output.stdout, `${args.join('\n')}\n`);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});

function hostedConfig(outputRoot: string): ServerConfig {
  return { mode: 'hosted', outputRoot };
}
