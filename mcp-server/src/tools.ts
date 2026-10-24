import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

export const TEMPLATE_NAMES = ['default', 'minimal', 'full'] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export const HOSTED_ENV_FLAG = 'NEXT_STARTER_MCP_HOSTED';
export const NAME_MAX = 214;
export const DIRECTORY_MAX = 4096;

const PROJECT_NAME_PATTERN = /^[a-zA-Z0-9-]+$/;

export type ServerConfig =
  | { mode: 'local' }
  | { mode: 'hosted'; outputRoot: string };

export type CreateAppInput = {
  name: string;
  skipConvex: boolean;
  skipClerk: boolean;
  template: TemplateName;
  verbose: boolean;
} & (
  | { mode: 'local'; directory?: string; force: boolean }
  | { mode: 'hosted' }
);

export type DryRunInput = {
  name: string;
  skipConvex: boolean;
  skipClerk: boolean;
  template: TemplateName;
};

export type ScriptCall = {
  args: string[];
  cwd: string;
};

export type ToolTextResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
};

const projectNameSchema = z
  .string()
  .min(1)
  .max(NAME_MAX)
  .regex(
    PROJECT_NAME_PATTERN,
    'App name can only contain letters, numbers, and hyphens',
  );

const directorySchema = z
  .string()
  .max(DIRECTORY_MAX)
  .refine((value) => !value.includes('\0'), 'Directory cannot contain a null byte')
  .optional();

const sharedFlags = {
  skipConvex: z.boolean().default(false),
  skipClerk: z.boolean().default(false),
  template: z.enum(TEMPLATE_NAMES).default('default'),
  verbose: z.boolean().default(false),
};

const localCreateSchema = z.strictObject({
  name: projectNameSchema,
  directory: directorySchema,
  force: z.boolean().default(false),
  ...sharedFlags,
});

const hostedCreateSchema = z.strictObject({
  name: projectNameSchema,
  ...sharedFlags,
});

const dryRunSchema = z.strictObject({
  name: projectNameSchema,
  skipConvex: z.boolean().default(false),
  skipClerk: z.boolean().default(false),
  template: z.enum(TEMPLATE_NAMES).default('default'),
});

const emptySchema = z.strictObject({});

export function readServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const flag = env[HOSTED_ENV_FLAG]?.trim().toLowerCase();
  if (flag === '1' || flag === 'true') {
    return {
      mode: 'hosted',
      outputRoot: path.resolve(os.tmpdir(), 'nextjs-starter-mcp'),
    };
  }
  return { mode: 'local' };
}

const nameProperty = {
  type: 'string',
  description:
    'App name (letters, numbers, and hyphens, 1 to 214 characters)',
  pattern: PROJECT_NAME_PATTERN.source,
  minLength: 1,
  maxLength: NAME_MAX,
};

const templateProperty = {
  type: 'string',
  enum: [...TEMPLATE_NAMES],
  description: 'Template type to use',
  default: 'default',
};

const skipConvexProperty = {
  type: 'boolean',
  description: 'Skip Convex real-time database setup',
  default: false,
};

const skipClerkProperty = {
  type: 'boolean',
  description: 'Skip Clerk authentication setup',
  default: false,
};

const verboseProperty = {
  type: 'boolean',
  description: 'Show verbose output during creation',
  default: false,
};

const directoryProperty = {
  type: 'string',
  description:
    'Directory to create the app in (default: ~/Desktop). Use absolute path like /Users/username/Desktop/projects',
  maxLength: DIRECTORY_MAX,
};

const forceProperty = {
  type: 'boolean',
  description: 'Overwrite existing directory if it exists',
  default: false,
};

export function listTools(config: ServerConfig): ToolDefinition[] {
  const createProperties: Record<string, unknown> = {
    name: nameProperty,
  };
  if (config.mode === 'local') {
    createProperties.directory = directoryProperty;
  }
  createProperties.skipConvex = skipConvexProperty;
  createProperties.skipClerk = skipClerkProperty;
  createProperties.template = templateProperty;
  createProperties.verbose = verboseProperty;
  if (config.mode === 'local') {
    createProperties.force = forceProperty;
  }

  return [
    {
      name: 'create_nextjs_app',
      description:
        'Create a new Next.js application using the professional starter script with TypeScript, Tailwind CSS, and optional Convex/Clerk integration',
      inputSchema: {
        type: 'object',
        properties: createProperties,
        required: ['name'],
        additionalProperties: false,
      },
    },
    {
      name: 'test_script',
      description: 'Test the create-next-starter.sh script integrity',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: 'script_help',
      description: 'Show help information for the create-next-starter.sh script',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: 'dry_run',
      description: 'Preview what would be created without actually creating the project',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            ...nameProperty,
            description: 'Name of the application to preview',
          },
          skipConvex: {
            ...skipConvexProperty,
            description: 'Skip Convex setup in preview',
          },
          skipClerk: {
            ...skipClerkProperty,
            description: 'Skip Clerk setup in preview',
          },
          template: {
            ...templateProperty,
            description: 'Template type to preview',
          },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
  ];
}

type Prepared =
  | { ok: false; message: string }
  | {
      ok: true;
      tool: 'create_nextjs_app';
      projectName: string;
      workingDirectory: string;
      makeDirectory: boolean;
      call: ScriptCall;
    }
  | {
      ok: true;
      tool: 'dry_run';
      projectName: string;
      call: ScriptCall;
    }
  | {
      ok: true;
      tool: 'test_script' | 'script_help';
      call: ScriptCall;
    };

export async function dispatchTool(options: {
  name: string;
  args: unknown;
  config: ServerConfig;
  run: (call: ScriptCall) => Promise<{ stdout: string; stderr: string }>;
}): Promise<ToolTextResult> {
  const prepared = prepare(options.name, options.args, options.config);
  if (!prepared.ok) {
    return textResult(prepared.message, true);
  }

  if (prepared.tool === 'create_nextjs_app') {
    const ready = await ensureWritable(prepared.workingDirectory, prepared.makeDirectory);
    if (!ready.ok) {
      return textResult(ready.message, true);
    }
  }

  try {
    const output = await options.run(prepared.call);
    return textResult(renderSuccess(prepared, output), false);
  } catch (error) {
    return textResult(renderFailure(prepared, error), true);
  }
}

function prepare(tool: string, args: unknown, config: ServerConfig): Prepared {
  const raw = args === undefined ? {} : args;

  switch (tool) {
    case 'create_nextjs_app':
      return prepareCreate(raw, config);
    case 'dry_run':
      return prepareDryRun(raw);
    case 'test_script':
      return prepareEmpty(tool, raw, ['--test']);
    case 'script_help':
      return prepareEmpty(tool, raw, ['--help']);
    default:
      return { ok: false, message: `Error: Unknown tool: ${tool}` };
  }
}

function prepareCreate(raw: unknown, config: ServerConfig): Prepared {
  if (config.mode === 'hosted') {
    const parsed = hostedCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: invalidInput('create_nextjs_app', parsed.error) };
    }
    const input: CreateAppInput = {
      mode: 'hosted',
      name: parsed.data.name,
      skipConvex: parsed.data.skipConvex,
      skipClerk: parsed.data.skipClerk,
      template: parsed.data.template,
      verbose: parsed.data.verbose,
    };
    const cwd = containedDirectory(config.outputRoot, input.name);
    if (!cwd) {
      return { ok: false, message: 'Project path is outside the hosted output directory' };
    }
    return {
      ok: true,
      tool: 'create_nextjs_app',
      projectName: input.name,
      workingDirectory: cwd,
      makeDirectory: true,
      call: { cwd, args: createArgs(input) },
    };
  }

  const parsed = localCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: invalidInput('create_nextjs_app', parsed.error) };
  }
  const input: CreateAppInput = {
    mode: 'local',
    name: parsed.data.name,
    directory: parsed.data.directory,
    force: parsed.data.force,
    skipConvex: parsed.data.skipConvex,
    skipClerk: parsed.data.skipClerk,
    template: parsed.data.template,
    verbose: parsed.data.verbose,
  };
  const cwd = localWorkingDirectory(input.directory);
  return {
    ok: true,
    tool: 'create_nextjs_app',
    projectName: input.name,
    workingDirectory: cwd,
    makeDirectory: false,
    call: { cwd, args: createArgs(input) },
  };
}

function prepareDryRun(raw: unknown): Prepared {
  const parsed = dryRunSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: invalidInput('dry_run', parsed.error) };
  }
  const input: DryRunInput = parsed.data;
  const args = ['--dry-run'];
  if (input.skipConvex) args.push('--skip-convex');
  if (input.skipClerk) args.push('--skip-clerk');
  if (input.template !== 'default') args.push('--template', input.template);
  args.push(input.name);
  return {
    ok: true,
    tool: 'dry_run',
    projectName: input.name,
    call: { cwd: process.cwd(), args },
  };
}

function prepareEmpty(
  tool: 'test_script' | 'script_help',
  raw: unknown,
  args: string[],
): Prepared {
  const parsed = emptySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: invalidInput(tool, parsed.error) };
  }
  return {
    ok: true,
    tool,
    call: { cwd: process.cwd(), args },
  };
}

function createArgs(input: CreateAppInput): string[] {
  const args: string[] = [];
  if (input.skipConvex) args.push('--skip-convex');
  if (input.skipClerk) args.push('--skip-clerk');
  if (input.template !== 'default') args.push('--template', input.template);
  if (input.verbose) args.push('--verbose');
  if (input.mode === 'local' && input.force) args.push('--force');
  args.push(input.name);
  return args;
}

function localWorkingDirectory(directory: string | undefined): string {
  if (directory) return directory;
  if (process.env.HOME) return path.join(process.env.HOME, 'Desktop');
  return process.cwd();
}

function containedDirectory(outputRoot: string, name: string): string | undefined {
  const root = path.resolve(outputRoot);
  const project = path.resolve(root, name);
  const relative = path.relative(root, project);
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return root;
}

async function ensureWritable(
  directory: string,
  makeDirectory: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (makeDirectory) {
    try {
      await fs.mkdir(directory, { recursive: true });
    } catch (error) {
      return { ok: false, message: cannotWrite(directory, error) };
    }
  }

  try {
    await fs.access(directory, fsConstants.W_OK);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: cannotWrite(directory, error) };
  }
}

function cannotWrite(directory: string, error: unknown): string {
  return `❌ Cannot write to directory: ${directory}\n\nError: ${String(error)}\n\nPlease specify a different directory or check permissions.`;
}

function invalidInput(tool: string, error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const where = issue.path.length > 0 ? issue.path.join('.') : 'input';
      return `${where}: ${issue.message}`;
    })
    .join('\n');
  return `Invalid input for ${tool}\n${details}`;
}

function textResult(text: string, isError: boolean): ToolTextResult {
  if (isError) {
    return { content: [{ type: 'text', text }], isError: true };
  }
  return { content: [{ type: 'text', text }] };
}

function renderSuccess(
  prepared: Extract<Prepared, { ok: true }>,
  output: { stdout: string; stderr: string },
): string {
  const stderr = output.stderr ? `\n\n${output.stderr}` : '';
  switch (prepared.tool) {
    case 'create_nextjs_app':
      return `✅ Successfully created Next.js app: ${prepared.projectName}\n\nLocation: ${prepared.workingDirectory}/${prepared.projectName}\n\n${output.stdout}${
        output.stderr ? `\n\nAdditional info:\n${output.stderr}` : ''
      }`;
    case 'dry_run':
      return `🔍 Dry Run Preview for: ${prepared.projectName}\n\n${output.stdout}${
        output.stderr ? `\n\nAdditional info:\n${output.stderr}` : ''
      }`;
    case 'test_script':
      return `🧪 Script Test Results:\n\n${output.stdout}${stderr}`;
    case 'script_help':
      return `📖 Next.js Starter Script Help:\n\n${output.stdout}${stderr}`;
  }
}

function renderFailure(prepared: Extract<Prepared, { ok: true }>, error: unknown): string {
  const details = errorDetails(error);
  if (prepared.tool !== 'create_nextjs_app') {
    return `❌ ${failureLabel(prepared.tool)}: ${details.message}`;
  }

  let text = `❌ Failed to create app: ${prepared.projectName}\n\nError: ${details.message}`;
  if (details.code === 'ENOENT') {
    text += '\n\n🔍 Possible issues:\n- Script file not found\n- Node.js/npm not in PATH\n- Permission denied';
  } else if (details.code === 'EACCES') {
    text += '\n\n🔍 Permission issue:\n- Check write permissions in target directory\n- Try running with appropriate permissions';
  } else if (details.code === 'ETIMEDOUT') {
    text += '\n\n🔍 Network timeout:\n- Check internet connectivity\n- npm registry might be slow';
  }
  if (details.stdout) {
    text += `\n\nOutput:\n${details.stdout}`;
  }
  if (details.stderr) {
    text += `\n\nError details:\n${details.stderr}`;
  }
  return text;
}

function failureLabel(tool: 'dry_run' | 'test_script' | 'script_help'): string {
  switch (tool) {
    case 'dry_run':
      return 'Dry run failed';
    case 'test_script':
      return 'Script test failed';
    case 'script_help':
      return 'Failed to get help';
  }
}

function errorDetails(error: unknown): { message: string; code?: string; stdout: string; stderr: string } {
  if (error instanceof Error) {
    const extra = error as Error & { code?: unknown; stdout?: unknown; stderr?: unknown };
    return {
      message: error.message,
      code: typeof extra.code === 'string' ? extra.code : undefined,
      stdout: typeof extra.stdout === 'string' ? extra.stdout : '',
      stderr: typeof extra.stderr === 'string' ? extra.stderr : '',
    };
  }
  return { message: String(error), stdout: '', stderr: '' };
}
