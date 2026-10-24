import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  FUNCTION_MAX_DURATION_MS,
  generateProject,
  LOG_LIMIT,
  runHostedCreate,
  SANDBOX_TIMEOUT_MS,
  type SandboxLaunch,
  type SandboxRun,
  type SandboxSession,
} from './sandbox.js';
import type { HostedGeneration } from 'nextjs-starter-mcp/tools';

const script = new TextEncoder().encode('#!/bin/bash\n');
const packer = new TextEncoder().encode('export {}\n');

function generation(): HostedGeneration {
  return {
    input: {
      mode: 'hosted',
      name: 'my-app',
      skipConvex: true,
      skipClerk: true,
      template: 'minimal',
      verbose: false,
    },
    call: {
      cwd: '/tmp/unused',
      args: ['--skip-convex', '--skip-clerk', '--template', 'minimal', '--', 'my-app'],
    },
  };
}

describe('generateProject', () => {
  test('starts one 1 vCPU sandbox, passes the name after --, and stops', async () => {
    const calls: SandboxRun[] = [];
    let spec: SandboxLaunch | undefined;
    let stopped = 0;
    const zip = new Uint8Array([1, 2, 3, 4]);
    const open = async (next: SandboxLaunch): Promise<SandboxSession> => {
      spec = next;
      return {
        writeFiles: async () => undefined,
        runCommand: async (params) => {
          calls.push(params);
          return { exitCode: 0, stdout: 'created', stderr: '' };
        },
        readFileToBuffer: async () => zip,
        stop: async () => {
          stopped += 1;
        },
      };
    };

    const result = await generateProject(open, generation().call.args, { script, packer });
    assert.equal(spec?.resources.vcpus, 1);
    assert.equal(spec?.persistent, false);
    assert.equal(spec?.timeout, SANDBOX_TIMEOUT_MS);
    assert.equal(SANDBOX_TIMEOUT_MS < FUNCTION_MAX_DURATION_MS, true);
    assert.equal(spec?.image, 'vercel/sandbox/universal');
    assert.deepEqual(spec?.networkPolicy.allow, ['registry.npmjs.org']);
    assert.equal(calls[0]?.cmd, 'bash');
    assert.equal(calls[0]?.args?.[1]?.includes('my-app'), false);
    assert.deepEqual(calls[0]?.args?.slice(-2), ['--', 'my-app']);
    assert.deepEqual(calls[1]?.args, ['pack-tree.mjs', 'my-app', 'project.zip']);
    assert.equal(stopped, 1);
    assert.equal(result.exitCode, 0);
    assert.deepEqual(result.zip, zip);
  });

  test('stops the sandbox when the generator fails', async () => {
    let stopped = 0;
    let reads = 0;
    const open = async (): Promise<SandboxSession> => ({
      writeFiles: async () => undefined,
      runCommand: async () => ({ exitCode: 1, stdout: '', stderr: 'boom' }),
      readFileToBuffer: async () => {
        reads += 1;
        return null;
      },
      stop: async () => {
        stopped += 1;
      },
    });
    const result = await generateProject(open, ['--', 'my-app'], { script, packer });
    assert.equal(result.exitCode, 1);
    assert.equal(result.zip, null);
    assert.equal(reads, 0);
    assert.equal(stopped, 1);
  });

  test('stops the sandbox when startup throws', async () => {
    let stopped = 0;
    const open = async (): Promise<SandboxSession> => ({
      writeFiles: async () => {
        throw new Error('disk full');
      },
      runCommand: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      readFileToBuffer: async () => new Uint8Array(),
      stop: async () => {
        stopped += 1;
      },
    });
    await assert.rejects(generateProject(open, ['--', 'my-app'], { script, packer }), /disk full/);
    assert.equal(stopped, 1);
  });
});

describe('runHostedCreate', () => {
  test('stub flag does not open a sandbox', async () => {
    let opened = 0;
    const result = await runHostedCreate(
      generation(),
      { NEXT_STARTER_GENERATION_STUB: '1' },
      async () => {
        opened += 1;
        throw new Error('should not open');
      },
      { script, packer },
    );
    assert.equal(opened, 0);
    assert.equal(result.isError, undefined);
    assert.equal(result.content[0]?.text, 'generation succeeded, delivery not yet available');
  });

  test('success text reports the archive size and truncates the log', async () => {
    const stdout = 'x'.repeat(LOG_LIMIT + 50);
    const result = await runHostedCreate(
      generation(),
      {},
      async () => ({
        writeFiles: async () => undefined,
        runCommand: async (params) => {
          if (params.cmd === 'node') return { exitCode: 0, stdout: '', stderr: '' };
          return { exitCode: 0, stdout, stderr: '' };
        },
        readFileToBuffer: async () => new Uint8Array(12),
        stop: async () => undefined,
      }),
      { script, packer },
    );
    const text = result.content[0]?.text ?? '';
    assert.equal(result.isError, undefined);
    assert.match(text, /Archive is 12 bytes/);
    assert.match(text, /node_modules, \.next, and \.git excluded/);
    assert.match(text, /Delivery is not available yet/);
    assert.match(text, /truncated 50 characters/);
    assert.equal(text.includes('x'.repeat(LOG_LIMIT + 1)), false);
    assert.equal(text.includes('x'.repeat(LOG_LIMIT)), true);
  });
});
