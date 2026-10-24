import { spawn, type ChildProcess } from 'node:child_process';
import type { ScriptCall } from './tools.js';

const DEFAULT_TIMEOUT_MS = 600_000;
const MAX_BUFFER_BYTES = 50 * 1024 * 1024;

function scriptTimeoutMs(env: NodeJS.ProcessEnv): number {
  const raw = env.NEXT_STARTER_MCP_SCRIPT_TIMEOUT_MS;
  if (raw === undefined || raw === '') return DEFAULT_TIMEOUT_MS;
  if (!/^[1-9][0-9]*$/.test(raw)) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) return DEFAULT_TIMEOUT_MS;
  return parsed;
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function killProcessTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined) return;
  if (process.platform !== 'win32') {
    try {
      process.kill(-pid, 'SIGKILL');
      return;
    } catch (error) {
      if (isErrno(error, 'ESRCH')) return;
    }
  }
  try {
    child.kill('SIGKILL');
  } catch (error) {
    if (!isErrno(error, 'ESRCH')) throw error;
  }
}

const activeChildren = new Set<ChildProcess>();

function trackChild(child: ChildProcess): void {
  activeChildren.add(child);
  child.on('close', () => {
    activeChildren.delete(child);
  });
}

function killTrackedProcessGroups(): void {
  for (const child of activeChildren) {
    try {
      killProcessTree(child);
    } catch (error) {
      if (!isErrno(error, 'ESRCH') && !isErrno(error, 'EPERM')) {
        console.error('Failed to stop a script process group', error);
      }
    }
  }
}

let guardsInstalled = false;

export function installProcessGuards(): void {
  if (guardsInstalled) return;
  guardsInstalled = true;
  const stop = () => {
    killTrackedProcessGroups();
  };
  process.on('exit', stop);
  process.on('SIGINT', () => {
    stop();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    stop();
    process.exit(143);
  });
  process.stdin.on('end', stop);
  process.stdin.on('close', stop);
}

export type ScriptOutput = {
  stdout: string;
  stderr: string;
};

export class ScriptRunError extends Error {
  readonly code: string | undefined;
  readonly stdout: string;
  readonly stderr: string;

  constructor(
    message: string,
    details: { code?: string; stdout: string; stderr: string },
  ) {
    super(message);
    this.name = 'ScriptRunError';
    this.code = details.code;
    this.stdout = details.stdout;
    this.stderr = details.stderr;
  }
}

export function runScript(
  scriptPath: string,
  call: ScriptCall,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ScriptOutput> {
  console.error(`Running ${scriptPath} in ${call.cwd} args=${JSON.stringify(call.args)}`);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let overflow = false;
    let stdout = '';
    let stderr = '';

    const child = spawn('bash', [scriptPath, ...call.args], {
      cwd: call.cwd,
      shell: false,
      env: scriptEnv(env),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    trackChild(child);

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, scriptTimeoutMs(env));

    const fail = (error: ScriptRunError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const succeed = (output: ScriptOutput) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(output);
    };

    const capture = (chunk: Buffer | string, current: string): string => {
      if (overflow) return current;
      const next = current + (typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
      if (Buffer.byteLength(next, 'utf8') > MAX_BUFFER_BYTES) {
        overflow = true;
        killProcessTree(child);
        return current;
      }
      return next;
    };

    if (!child.stdout || !child.stderr) {
      fail(new ScriptRunError('Script pipes were not created', { stdout: '', stderr: '' }));
      return;
    }

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout = capture(chunk, stdout);
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr = capture(chunk, stderr);
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      fail(new ScriptRunError(error.message, { code: error.code, stdout, stderr }));
    });

    child.on('close', (code) => {
      if (timedOut) {
        fail(new ScriptRunError('Script timed out', { code: 'ETIMEDOUT', stdout, stderr }));
        return;
      }
      if (overflow) {
        fail(new ScriptRunError('Script output exceeded the buffer limit', { stdout, stderr }));
        return;
      }
      if (code === 0) {
        succeed({ stdout, stderr });
        return;
      }
      fail(
        new ScriptRunError(`Script exited with code ${code ?? 'unknown'}`, {
          code: code === null ? undefined : String(code),
          stdout,
          stderr,
        }),
      );
    });
  });
}

const PASSED_ENV_KEYS = [
  'PATH',
  'HOME',
  'TMPDIR',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'NODE_EXTRA_CA_CERTS',
] as const;

function scriptEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    npm_config_registry: 'https://registry.npmjs.org/',
    npm_config_fund: 'false',
    npm_config_audit: 'false',
  };
  for (const key of PASSED_ENV_KEYS) {
    const value = env[key];
    if (value !== undefined) {
      child[key] = value;
    }
  }
  return child;
}
