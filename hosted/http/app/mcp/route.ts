import { AsyncLocalStorage } from 'node:async_hooks';
import { createMcpHandler } from 'mcp-handler';
import { executeToolCall } from 'nextjs-starter-mcp/handlers';
import { runScript } from 'nextjs-starter-mcp/run';
import { listTools, readServerConfig, toolInputSchema } from 'nextjs-starter-mcp/tools';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { admitHttpRequest, authorizeToolCall, MCP_CLOSED, type AuthInfo } from '../../src/gate';
import { healthForTool, queryConvexHealth } from '../../src/health';
import { runHostedCreate } from '../../src/sandbox';
import { openVercelSandbox } from '../../src/vercel-sandbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const config = readServerConfig({
  ...process.env,
  NEXT_STARTER_MCP_HOSTED: '1',
});

const scriptPath = path.join(process.cwd(), 'vendor/create-next-starter.sh');
const packerPath = path.join(process.cwd(), 'src/pack-tree.mjs');

type CallContext = {
  request: Request;
  authInfo?: AuthInfo;
};

const callContext = new AsyncLocalStorage<CallContext>();

const mcp = createMcpHandler(
  (server) => {
    for (const tool of listTools(config)) {
      const inputSchema = toolInputSchema(tool.name, config);
      if (!inputSchema) continue;
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema,
        },
        async (args) => {
          return executeToolCall(tool.name, args, {
            config,
            run: (call) => runScript(scriptPath, call),
            beforeCall: async (name, toolArgs) => {
              const current = callContext.getStore();
              if (!current) {
                return {
                  content: [{ type: 'text', text: MCP_CLOSED }],
                  isError: true,
                };
              }
              const decision = authorizeToolCall({
                request: current.request,
                env: process.env,
                tool: name,
                args: toolArgs,
                authInfo: current.authInfo,
              });
              if (!decision.allowed) {
                return {
                  content: [{ type: 'text', text: decision.message }],
                  isError: true,
                };
              }
              const healthError = await healthForTool(name, process.env, queryConvexHealth);
              if (healthError) {
                return {
                  content: [{ type: 'text', text: healthError }],
                  isError: true,
                };
              }
              return undefined;
            },
            generate: (generation) =>
              runHostedCreate(generation, process.env, openVercelSandbox, {
                script: readFileSync(scriptPath),
                packer: readFileSync(packerPath),
              }),
          });
        },
      );
    }
  },
  {
    serverInfo: { name: 'nextjs-starter-script', version: '1.0.0' },
  },
);

async function handler(request: Request): Promise<Response> {
  const decision = admitHttpRequest({ request, env: process.env });
  if (!decision.allowed) {
    return new Response(decision.message, { status: decision.status });
  }
  return callContext.run({ request }, () => mcp(request));
}

export { handler as GET, handler as POST, handler as DELETE };
