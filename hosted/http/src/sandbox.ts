import type { HostedGeneration, ToolTextResult } from 'nextjs-starter-mcp/tools';

export const LOG_LIMIT = 16_000;

export const FUNCTION_MAX_DURATION_MS = 300_000;
export const SANDBOX_STOP_MARGIN_MS = 30_000;
export const SANDBOX_TIMEOUT_MS = FUNCTION_MAX_DURATION_MS - SANDBOX_STOP_MARGIN_MS;

export const SANDBOX_LAUNCH = {
  resources: { vcpus: 1 as const },
  persistent: false as const,
  timeout: SANDBOX_TIMEOUT_MS,
  image: 'vercel/sandbox/universal' as const,
  networkPolicy: { allow: ['registry.npmjs.org'] as const },
};

export type SandboxLaunch = {
  resources: { vcpus: 1 };
  persistent: false;
  timeout: number;
  image: 'vercel/sandbox/universal';
  networkPolicy: { allow: readonly string[] };
};

export type SandboxRun = {
  cmd: string;
  args?: string[];
  cwd?: string;
};

export type SandboxResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type SandboxSession = {
  writeFiles(files: { path: string; content: Uint8Array; mode?: number }[]): Promise<void>;
  runCommand(params: SandboxRun): Promise<SandboxResult>;
  readFileToBuffer(file: { path: string; cwd?: string }): Promise<Uint8Array | null>;
  stop(): Promise<void>;
};

export type SandboxOpener = (spec: SandboxLaunch) => Promise<SandboxSession>;

export type GenerationFiles = {
  script: Uint8Array;
  packer: Uint8Array;
};

const WORKDIR = '/vercel/sandbox';

const PING_SHIM = `#!/bin/sh
# ICMP is dropped in the sandbox. The registry check is an HTTPS request.
curl -fsS -o /dev/null -m 5 https://registry.npmjs.org/-/ping
`;

const RUN_SCRIPT = 'export PATH="$PWD/bin:$PATH" && exec bash ./create-next-starter.sh "$@"';

export function truncateLog(text: string): string {
  if (text.length <= LOG_LIMIT) return text;
  const omitted = text.length - LOG_LIMIT;
  return `${text.slice(0, LOG_LIMIT)}\n… truncated ${omitted} characters`;
}

export async function generateProject(
  open: SandboxOpener,
  args: string[],
  files: GenerationFiles,
): Promise<{ exitCode: number; stdout: string; stderr: string; zip: Uint8Array | null }> {
  const session = await open(SANDBOX_LAUNCH);
  try {
    await session.writeFiles([
      { path: 'create-next-starter.sh', content: files.script, mode: 0o755 },
      { path: 'bin/ping', content: new TextEncoder().encode(PING_SHIM), mode: 0o755 },
      { path: 'pack-tree.mjs', content: files.packer },
    ]);
    const generated = await session.runCommand({
      cmd: 'bash',
      args: ['-c', RUN_SCRIPT, 'bash', ...args],
      cwd: WORKDIR,
    });
    if (generated.exitCode !== 0) {
      return { ...generated, zip: null };
    }
    const name = args.at(-1);
    if (!name) {
      return {
        exitCode: 1,
        stdout: generated.stdout,
        stderr: `${generated.stderr}\nMissing project name`,
        zip: null,
      };
    }
    const packed = await session.runCommand({
      cmd: 'node',
      args: ['pack-tree.mjs', name, 'project.zip'],
      cwd: WORKDIR,
    });
    if (packed.exitCode !== 0) {
      return {
        exitCode: packed.exitCode,
        stdout: `${generated.stdout}\n${packed.stdout}`,
        stderr: `${generated.stderr}\n${packed.stderr}`,
        zip: null,
      };
    }
    const zip = await session.readFileToBuffer({ path: 'project.zip', cwd: WORKDIR });
    return {
      exitCode: zip ? 0 : 1,
      stdout: generated.stdout,
      stderr: zip ? generated.stderr : `${generated.stderr}\nArchive was not written`,
      zip,
    };
  } finally {
    try {
      await session.stop();
    } catch (error) {
      console.error('sandbox stop failed', error);
    }
  }
}

export function useGenerationStub(env: NodeJS.ProcessEnv): boolean {
  const flag = env.NEXT_STARTER_GENERATION_STUB?.trim().toLowerCase();
  return flag === '1' || flag === 'true';
}

export async function runHostedCreate(
  generation: HostedGeneration,
  env: NodeJS.ProcessEnv,
  open: SandboxOpener,
  files: GenerationFiles,
): Promise<ToolTextResult> {
  if (useGenerationStub(env)) {
    return {
      content: [{ type: 'text', text: 'generation succeeded, delivery not yet available' }],
    };
  }
  const outcome = await generateProject(open, generation.call.args, files);
  const log = [truncateLog(outcome.stdout), truncateLog(outcome.stderr)].filter(Boolean).join('\n');
  if (outcome.exitCode !== 0 || !outcome.zip) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Generation failed for ${generation.input.name} (exit ${outcome.exitCode}).\n${log}`,
        },
      ],
    };
  }
  return {
    content: [
      {
        type: 'text',
        text: `Generation finished for ${generation.input.name}. Archive is ${outcome.zip.byteLength} bytes with node_modules, .next, and .git excluded. Delivery is not available yet.\n${log}`,
      },
    ],
  };
}
