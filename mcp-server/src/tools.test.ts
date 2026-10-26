import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runScript } from './run.js';
import {
  dispatchTool,
  HOSTED_ENV_FLAG,
  listTools,
  readServerConfig,
  type ScriptCall,
  type ServerConfig,
} from './tools.js';

const require = createRequire(import.meta.url);
const validateNpmPackageName = require('validate-npm-package-name') as (name: string) => {
  validForNewPackages: boolean;
};

const localConfig: ServerConfig = { mode: 'local' };

const injectionNames = [
  'a; rm -rf ~',
  '; rm -rf',
  '$(id)',
  '`id`',
  '../etc',
  'foo\nbar',
  'a;rm',
  'my_app',
  '_hidden',
  'MyApp',
  'A1',
  '-rf',
  '--test',
  '--force',
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
      assert.equal(runner.calls.length, 1);
      const firstCwd = runner.calls[0].cwd;
      assert.equal(path.dirname(firstCwd), outputRoot);
      assert.deepEqual(runner.calls[0].args, [
        '--skip-convex', '--skip-clerk', '--template', 'minimal', '--', 'my-app',
      ]);
      assert.equal(runner.calls[0].args.includes('--force'), false);
      assert.ok(result.content[0].text.includes(`Location: ${firstCwd}/my-app`));
      assert.equal((await fs.stat(firstCwd)).isDirectory(), true);

      // Two callers choosing the same project name must never share a work directory.
      const second = await dispatchTool({
        name: 'create_nextjs_app',
        args: { name: 'my-app', template: 'minimal', skipConvex: true, skipClerk: true },
        config: hostedConfig(outputRoot),
        run: runner.run,
      });
      assert.notEqual(second.isError, true);
      assert.equal(runner.calls.length, 2);
      assert.equal(path.dirname(runner.calls[1].cwd), outputRoot);
      assert.notEqual(runner.calls[1].cwd, firstCwd);
      assert.equal((await fs.stat(runner.calls[1].cwd)).isDirectory(), true);
    } finally {
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  });

  test('failed hosted creation cleans up its isolated workspace', async () => {
    const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-hosted-fail-'));
    let attemptedCwd = '';
    try {
      const result = await dispatchTool({
        name: 'create_nextjs_app',
        args: { name: 'my-app', skipClerk: true, skipConvex: true },
        config: hostedConfig(outputRoot),
        run: async (call) => {
          attemptedCwd = call.cwd;
          await fs.writeFile(path.join(call.cwd, 'partial.txt'), 'partial build output');
          throw new Error('simulated generator failure');
        },
      });
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /simulated generator failure/);
      assert.ok(attemptedCwd);
      await assert.rejects(fs.access(attemptedCwd));
      assert.deepEqual(await fs.readdir(outputRoot), []);
    } finally {
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  });

  test('concurrent same-name hosted calls keep separate workspaces and results', { timeout: 5_000 }, async () => {
    const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-hosted-parallel-'));
    const seen = new Set<string>();
    let release!: () => void;
    const bothStarted = new Promise<void>((resolve) => { release = resolve; });
    try {
      const results = await Promise.all(['caller-a', 'caller-b'].map((marker) => dispatchTool({
        name: 'create_nextjs_app',
        args: { name: 'same-app', skipClerk: true, skipConvex: true },
        config: hostedConfig(outputRoot),
        run: async (call) => {
          assert.equal(seen.has(call.cwd), false, 'requests share their workspace');
          seen.add(call.cwd);
          await fs.writeFile(path.join(call.cwd, 'owner'), marker);
          if (seen.size === 2) release();
          await bothStarted;
          assert.equal(await fs.readFile(path.join(call.cwd, 'owner'), 'utf8'), marker);
          return { stdout: marker, stderr: '' };
        },
      }).finally(() => release())));
      assert.equal(seen.size, 2);
      results.forEach((result) => assert.notEqual(result.isError, true));
    } finally {
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  });

  test('timed-out hosted generation kills descendants before workspace cleanup', { timeout: 10_000 }, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-hosted-timeout-'));
    const outputRoot = path.join(root, 'workspaces');
    const script = path.join(root, 'linger.sh');
    try {
      const sentinel = path.join(root, 'escaped-descendant');
      await fs.writeFile(script, '#!/bin/bash\n(sleep 2 && touch "$1") &\nwait\n');
      const result = await dispatchTool({
        name: 'create_nextjs_app',
        args: { name: 'timeout-app', skipClerk: true, skipConvex: true },
        config: hostedConfig(outputRoot),
        run: (call) => runScript(script, { ...call, args: [sentinel] }, { ...process.env, NEXT_STARTER_MCP_SCRIPT_TIMEOUT_MS: '300' }),
      });
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /Script timed out/);
      assert.deepEqual(await fs.readdir(outputRoot), []);
      await new Promise((resolve) => setTimeout(resolve, 2_300));
      assert.deepEqual(await fs.readdir(outputRoot), []);
      await assert.rejects(fs.access(sentinel));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
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
    const nameSchema = create.inputSchema.properties.name as { pattern?: string };
    assert.equal(nameSchema.pattern, '^[a-z0-9][a-z0-9-]*$');
  });

  test('rejects MyApp and flag-like names before the script runs', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-local-case-'));
    try {
      for (const name of ['MyApp', '-rf', '--test', '--force', 'my_app']) {
        await expectRejected('create_nextjs_app', { name, directory }, localConfig);
        await expectRejected('dry_run', { name }, localConfig);
      }
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
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
      assert.equal(runner.calls[0].args.at(-2), '--');
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
          args: ['--skip-convex', '--template', 'full', '--verbose', '--force', '--', 'my-app'],
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
        ['--dry-run', '--skip-clerk', '--template', 'minimal', '--', 'my-app'],
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
    assert.throws(() => readServerConfig({ [HOSTED_ENV_FLAG]: 'tru' }), /Invalid NEXT_STARTER_MCP_HOSTED/);
    assert.throws(() => readServerConfig({ [HOSTED_ENV_FLAG]: 'yes' }), /Invalid NEXT_STARTER_MCP_HOSTED/);
    const hosted = readServerConfig({ [HOSTED_ENV_FLAG]: '1' });
    const hostedWord = readServerConfig({ [HOSTED_ENV_FLAG]: ' TRUE ' });
    assert.equal(hosted.mode, 'hosted');
    assert.equal(hostedWord.mode, 'hosted');
    if (hosted.mode === 'hosted') {
      assert.equal(hosted.outputRoot, path.resolve(os.tmpdir(), 'nextjs-starter-mcp'));
    }
  });
});

const acceptedNames = ['my-app', 'a', '9lives', 'a-b', 'app', 'a'.repeat(214)];

const rejectedNames = [
  'MyApp',
  'myApp',
  'A1',
  '-rf',
  '--test',
  '--force',
  '-h',
  '_hidden',
  'a;rm',
  'a; rm -rf ~',
  '$(id)',
  '`id`',
  '../etc',
  'foo\nbar',
  'a'.repeat(215),
  'a'.repeat(10_000),
];

describe('name rules match the script', () => {
  for (const name of acceptedNames) {
    test(`server and validate_app_name accept ${JSON.stringify(name)}`, async () => {
      assert.equal(await scriptAcceptsName(name), true);
      assert.equal(await serverAcceptsName(name), true);
    });
  }

  for (const name of rejectedNames) {
    test(`server and validate_app_name reject ${JSON.stringify(name)}`, async () => {
      assert.equal(await scriptAcceptsName(name), false);
      assert.equal(await serverAcceptsName(name), false);
    });
  }

  test('validate-npm-package-name agrees on the same names', () => {
    for (const name of acceptedNames) {
      assert.equal(validateNpmPackageName(name).validForNewPackages, true, JSON.stringify(name));
    }
    for (const name of rejectedNames) {
      assert.equal(validateNpmPackageName(name).validForNewPackages, false, JSON.stringify(name));
    }
  });

  test('server and validate_app_name reject underscores', async () => {
    for (const name of ['my_app', 'app_name']) {
      assert.equal(await scriptAcceptsName(name), false);
      assert.equal(await serverAcceptsName(name), false);
    }
  });

  test('the script rejects flag-like names before it creates a directory', async () => {
    const scriptPath = repoScriptPath();
    const names = ['MyApp', '-rf', '--test', '--force'];
    for (const name of names) {
      await assertScriptLeavesNoProject(scriptPath, ['--', name]);
      await assertScriptLeavesNoProject(scriptPath, ['--dry-run', '--', name]);
      await assertScriptLeavesNoProject(scriptPath, ['--skip-convex', '--skip-clerk', '--', name]);
    }
  });

  test('script --test still runs the self-test', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-script-self-test-'));
    try {
      const result = spawnSync('bash', [repoScriptPath(), '--test'], {
        cwd: directory,
        encoding: 'utf8',
        timeout: 20_000,
      });
      assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
      assert.match(`${result.stdout}`, /Script is ready to use/);
      assert.deepEqual(await projectEntries(directory), []);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
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

  test('passes PATH, HOME, TMPDIR, proxy vars, and NODE_EXTRA_CA_CERTS', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-env-'));
    const scriptPath = path.join(directory, 'print-env.sh');
    try {
      // Bash is /bin/bash on macOS and can be /usr/bin/bash on Linux.
      const bashPath = spawnSync('which', ['bash'], { encoding: 'utf8' }).stdout.trim();
      assert.ok(path.isAbsolute(bashPath));
      const runnerPath = path.dirname(bashPath);
      await fs.writeFile(
        scriptPath,
        '#!/bin/bash\nprintf "PATH=%s\\nHOME=%s\\nTMPDIR=%s\\nNODE_ENV=%s\\nHTTP_PROXY=%s\\nHTTPS_PROXY=%s\\nNO_PROXY=%s\\nhttp_proxy=%s\\nhttps_proxy=%s\\nno_proxy=%s\\nNODE_EXTRA_CA_CERTS=%s\\nSECRET=%s\\nNPM_TOKEN=%s\\n" "$PATH" "$HOME" "$TMPDIR" "$NODE_ENV" "${HTTP_PROXY-unset}" "${HTTPS_PROXY-unset}" "${NO_PROXY-unset}" "${http_proxy-unset}" "${https_proxy-unset}" "${no_proxy-unset}" "${NODE_EXTRA_CA_CERTS-unset}" "${SECRET-unset}" "${NPM_TOKEN-unset}"\n',
      );
      const output = await runScript(
        scriptPath,
        { args: [], cwd: directory },
        {
          PATH: runnerPath,
          HOME: '/tmp/mcp-home',
          TMPDIR: '/tmp/mcp-tmp',
          HTTP_PROXY: 'http://proxy.example:8080',
          HTTPS_PROXY: 'http://proxy.example:8443',
          NO_PROXY: 'localhost',
          http_proxy: 'http://proxy.example:8081',
          https_proxy: 'http://proxy.example:8444',
          no_proxy: '127.0.0.1',
          NODE_EXTRA_CA_CERTS: '/tmp/mcp-ca.pem',
          SECRET: 'leak',
          NPM_TOKEN: 'leak',
          NODE_ENV: 'production',
        },
      );
      assert.equal(
        output.stdout,
        `PATH=${runnerPath}\nHOME=/tmp/mcp-home\nTMPDIR=/tmp/mcp-tmp\nNODE_ENV=development\nHTTP_PROXY=http://proxy.example:8080\nHTTPS_PROXY=http://proxy.example:8443\nNO_PROXY=localhost\nhttp_proxy=http://proxy.example:8081\nhttps_proxy=http://proxy.example:8444\nno_proxy=127.0.0.1\nNODE_EXTRA_CA_CERTS=/tmp/mcp-ca.pem\nSECRET=unset\nNPM_TOKEN=unset\n`,
      );
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});

async function serverAcceptsName(name: string): Promise<boolean> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-server-name-'));
  try {
    const runner = recordingRunner();
    const result = await dispatchTool({
      name: 'create_nextjs_app',
      args: { name, directory },
      config: localConfig,
      run: runner.run,
    });
    return result.isError !== true && runner.calls.length === 1;
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function repoScriptPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../create-next-starter.sh');
}

async function projectEntries(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory);
  return entries.filter((entry) => entry !== 'setup.log' && entry !== 'setup-error.log');
}

async function assertScriptLeavesNoProject(scriptPath: string, args: string[]) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-script-disk-'));
  try {
    const result = spawnSync('bash', [scriptPath, ...args], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 15_000,
    });
    const output = `${result.stdout}${result.stderr}`;
    assert.notEqual(result.status, 0, output);
    assert.equal(result.error, undefined, output);
    assert.equal(output.includes('Creating Next.js application'), false, output);
    assert.equal(output.includes('Script is ready to use'), false, output);
    assert.equal(output.includes('DRY RUN MODE'), false, output);
    assert.deepEqual(await projectEntries(directory), [], output);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function scriptAcceptsName(name: string): Promise<boolean> {
  const scriptPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../create-next-starter.sh',
  );
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-script-name-'));
  try {
    const raw = await fs.readFile(scriptPath, 'utf8');
    const sourced = path.join(directory, 'sourced.sh');
    await fs.writeFile(sourced, raw.replace(/^main_execution "\$@"$/m, ':'));
    const result = spawnSync(
      'bash',
      ['-c', 'cd "$1" && source "$2" && trap - EXIT && validate_app_name "$3"', 'bash', directory, sourced, name],
      { encoding: 'utf8' },
    );
    return result.status === 0;
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function hostedConfig(outputRoot: string): ServerConfig {
  return { mode: 'hosted', outputRoot };
}
