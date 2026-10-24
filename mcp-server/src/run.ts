import { spawn } from 'node:child_process';
import type { ScriptCall } from './tools.js';

const TIMEOUT_MS = 600_000;
const MAX_BUFFER_BYTES = 50 * 1024 * 1024;

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
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);

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
        child.kill('SIGKILL');
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

function scriptEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    NODE_ENV: 'development',
    npm_config_registry: 'https://registry.npmjs.org/',
    npm_config_fund: 'false',
    npm_config_audit: 'false',
  };
}
