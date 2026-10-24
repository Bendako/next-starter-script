import type { AuthInfo as McpAuthInfo } from '@modelcontextprotocol/server';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { executeToolCall } from 'nextjs-starter-mcp/handlers';
import { runScript } from 'nextjs-starter-mcp/run';
import { listTools, readServerConfig, toolInputSchema } from 'nextjs-starter-mcp/tools';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { verifyHostedMcpToken } from './clerk-token';
import { convexCredentialSelected } from './convex-credential';
import { admitHttpRequest, authorizeToolCall, MCP_CLOSED, type AuthInfo, type ToolAuthInput, type ToolAuthorization } from './gate';
import { healthForTool, queryConvexHealth } from './health';
import { OAUTH_RESOURCE_METADATA_PATH } from './protected-resource';
import { runHostedCreate } from './sandbox';
import { openVercelSandbox } from './vercel-sandbox';

export type VerifyMcpToken = (
  request: Request,
  token?: string,
) => Promise<McpAuthInfo | undefined> | McpAuthInfo | undefined;

export type HostedMcpOptions = {
  env?: NodeJS.ProcessEnv;
  scriptPath?: string;
  verifyToken?: VerifyMcpToken;
  authorize?: (input: ToolAuthInput) => ToolAuthorization;
};

const CREDENTIAL_NOT_SELECTED = 'Convex server credential is not selected';

type CallContext = {
  request: Request;
  authInfo?: AuthInfo;
};

type ToolHttp = {
  req?: Request;
  authInfo?: AuthInfo;
};

export function createHostedMcpHandler(options: HostedMcpOptions = {}): (request: Request) => Promise<Response> {
  const env = options.env ?? process.env;
  const defaultScriptPath = path.join(process.cwd(), 'vendor/create-next-starter.sh');
  const defaultPackerPath = path.join(process.cwd(), 'src/pack-tree.mjs');
  const scriptPath = options.scriptPath ?? defaultScriptPath;
  const authorize = options.authorize ?? authorizeToolCall;
  const verifyToken = options.verifyToken ?? verifyHostedMcpToken;
  const config = readServerConfig({
    ...env,
    NEXT_STARTER_MCP_HOSTED: '1',
  });
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
          async (args, ctx) => {
            return executeToolCall(tool.name, args, {
              config,
              run: (call) => runScript(scriptPath, call, env),
              beforeCall: async (name, toolArgs) => {
                const current = callContext.getStore();
                if (!current) {
                  return {
                    content: [{ type: 'text', text: MCP_CLOSED }],
                    isError: true,
                  };
                }
                const http = ctx.http as ToolHttp | undefined;
                const authInfo = http?.authInfo ?? current.request.auth ?? current.authInfo;
                const decision = authorize({
                  request: current.request,
                  env,
                  tool: name,
                  args: toolArgs,
                  authInfo,
                });
                if (!decision.allowed) {
                  return {
                    content: [{ type: 'text', text: decision.message }],
                    isError: true,
                  };
                }
                if (!decision.caller || convexCredentialSelected(decision.caller)) {
                  return {
                    content: [{ type: 'text', text: CREDENTIAL_NOT_SELECTED }],
                    isError: true,
                  };
                }
                const healthError = await healthForTool(name, env, queryConvexHealth);
                if (healthError) {
                  return {
                    content: [{ type: 'text', text: healthError }],
                    isError: true,
                  };
                }
                return undefined;
              },
              generate: (generation) =>
                runHostedCreate(generation, env, openVercelSandbox, {
                  script: readFileSync(defaultScriptPath),
                  packer: readFileSync(defaultPackerPath),
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

  const authed = withMcpAuth(
    async (request) => callContext.run({ request, authInfo: request.auth }, () => mcp(request)),
    verifyToken,
    {
      required: true,
      resourceMetadataPath: OAUTH_RESOURCE_METADATA_PATH,
    },
  );

  return async (request) => {
    const decision = admitHttpRequest({ request, env, authInfo: request.auth });
    if (!decision.allowed) {
      return new Response(decision.message, { status: decision.status });
    }
    return authed(request);
  };
}
