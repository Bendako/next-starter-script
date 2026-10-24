import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  dispatchTool,
  listTools,
  type HostedGeneration,
  type ScriptCall,
  type ServerConfig,
  type ToolTextResult,
} from './tools.js';

export type ToolHandlers = {
  config: ServerConfig;
  run: (call: ScriptCall) => Promise<{ stdout: string; stderr: string }>;
  beforeCall?: (tool: string, args: unknown) => Promise<ToolTextResult | undefined>;
  generate?: (generation: HostedGeneration) => Promise<ToolTextResult>;
};

export async function executeToolCall(
  name: string,
  args: unknown,
  handlers: ToolHandlers,
): Promise<ToolTextResult> {
  if (handlers.beforeCall) {
    const blocked = await handlers.beforeCall(name, args);
    if (blocked) return blocked;
  }
  return dispatchTool({
    name,
    args,
    config: handlers.config,
    run: handlers.run,
    generate: handlers.generate,
  });
}

export function registerToolHandlers(server: Server, handlers: ToolHandlers): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listTools(handlers.config),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return executeToolCall(request.params.name, request.params.arguments ?? {}, handlers);
  });
}
