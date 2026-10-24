#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerToolHandlers } from './handlers.js';
import { runScript } from './run.js';
import { readServerConfig } from './tools.js';

const config = readServerConfig(process.env);
const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../create-next-starter.sh',
);

const server = new Server(
  {
    name: 'nextjs-starter-script',
    version: '1.0.0',
  },
  {
    // SDK 1.x refuses tools/list and tools/call handlers without this.
    capabilities: {
      tools: {},
    },
  },
);

registerToolHandlers(server, {
  config,
  run: (call) => runScript(scriptPath, call),
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Next.js Starter MCP Server running on stdio');
