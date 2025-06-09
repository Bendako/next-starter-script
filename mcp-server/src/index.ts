#!/usr/bin/env node

/**
 * Next.js Starter MCP Server
 * Wraps the create-next-starter.sh script to provide Next.js project creation tools for Claude
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execAsync = promisify(exec);

interface ProjectConfig {
  name: string;
  directory?: string;
  skipConvex?: boolean;
  skipClerk?: boolean;
  template?: 'default' | 'minimal' | 'full';
  verbose?: boolean;
  force?: boolean;
}

class NextjsStarterServer {
  private server: Server;
  private scriptPath: string;

  constructor() {
    this.server = new Server({
      name: 'nextjs-starter-script',
      version: '1.0.0',
    });
    
    // Script is in the parent directory relative to this MCP server
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.scriptPath = path.join(__dirname, '../../create-next-starter.sh');
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_nextjs_app',
            description: 'Create a new Next.js application using the professional starter script with TypeScript, Tailwind CSS, and optional Convex/Clerk integration',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'App name (letters, numbers, hyphens only)',
                  pattern: '^[a-zA-Z0-9-]+$',
                },
                directory: {
                  type: 'string',
                  description: 'Directory to create the app in (default: ~/Desktop). Use absolute path like /Users/ben/Desktop/projects',
                },
                skipConvex: {
                  type: 'boolean',
                  description: 'Skip Convex real-time database setup',
                  default: false,
                },
                skipClerk: {
                  type: 'boolean',
                  description: 'Skip Clerk authentication setup',
                  default: false,
                },
                template: {
                  type: 'string',
                  enum: ['default', 'minimal', 'full'],
                  description: 'Template type to use',
                  default: 'default',
                },
                verbose: {
                  type: 'boolean',
                  description: 'Show verbose output during creation',
                  default: false,
                },
                force: {
                  type: 'boolean',
                  description: 'Overwrite existing directory if it exists',
                  default: false,
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'test_script',
            description: 'Test the create-next-starter.sh script integrity',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'script_help',
            description: 'Show help information for the create-next-starter.sh script',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'dry_run',
            description: 'Preview what would be created without actually creating the project',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the application to preview',
                },
                skipConvex: {
                  type: 'boolean',
                  description: 'Skip Convex setup in preview',
                  default: false,
                },
                skipClerk: {
                  type: 'boolean',
                  description: 'Skip Clerk setup in preview',
                  default: false,
                },
                template: {
                  type: 'string',
                  enum: ['default', 'minimal', 'full'],
                  description: 'Template type to preview',
                  default: 'default',
                },
              },
              required: ['name'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_nextjs_app':
            return await this.createNextjsApp(args as any);
          case 'test_script':
            return await this.testScript();
          case 'script_help':
            return await this.showHelp();
          case 'dry_run':
            return await this.dryRun(args as any);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async createNextjsApp(config: ProjectConfig) {
    const {
      name,
      directory,
      skipConvex = false,
      skipClerk = false,
      template = 'default',
      verbose = false,
      force = false,
    } = config;

    try {
      // Determine the working directory
      let workingDir: string;
      if (directory) {
        workingDir = directory;
      } else {
        // Default to a reasonable location for project creation
        workingDir = process.env.HOME ? `${process.env.HOME}/Desktop` : process.cwd();
      }

      // Ensure the working directory exists and is writable
      const fs = await import('fs');
      try {
        await fs.promises.access(workingDir, fs.constants.W_OK);
      } catch (accessError) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Cannot write to directory: ${workingDir}\n\nError: ${accessError}\n\nPlease specify a different directory or check permissions.`,
            },
          ],
          isError: true,
        };
      }

      const args = [];
      if (skipConvex) args.push('--skip-convex');
      if (skipClerk) args.push('--skip-clerk');
      if (template !== 'default') args.push(`--template ${template}`);
      if (verbose) args.push('--verbose');
      if (force) args.push('--force');
      args.push(name);

      const command = `"${this.scriptPath}" ${args.join(' ')}`;
      console.error(`Executing: ${command} in directory: ${workingDir}`);
      console.error(`Script path: ${this.scriptPath}`);
      console.error(`Current working directory: ${process.cwd()}`);

      // Add environment variables for better npm connectivity
      const env = {
        ...process.env,
        NODE_ENV: 'development',
        npm_config_registry: 'https://registry.npmjs.org/',
        npm_config_fund: 'false',
        npm_config_audit: 'false',
      };

      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: 600000, // 10 minutes
        maxBuffer: 1024 * 1024 * 50, // 50MB
        env: env,
      });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Successfully created Next.js app: ${name}\n\nLocation: ${workingDir}/${name}\n\n${stdout}${
              stderr ? `\n\nAdditional info:\n${stderr}` : ''
            }`,
          },
        ],
      };
    } catch (error: any) {
      // Enhanced error reporting
      let errorDetails = `❌ Failed to create app: ${name}\n\nError: ${error.message}`;
      
      if (error.code === 'ENOENT') {
        errorDetails += '\n\n🔍 Possible issues:\n- Script file not found\n- Node.js/npm not in PATH\n- Permission denied';
      } else if (error.code === 'EACCES') {
        errorDetails += '\n\n🔍 Permission issue:\n- Check write permissions in target directory\n- Try running with appropriate permissions';
      } else if (error.code === 'ETIMEDOUT') {
        errorDetails += '\n\n🔍 Network timeout:\n- Check internet connectivity\n- npm registry might be slow';
      }

      if (error.stdout) {
        errorDetails += `\n\nOutput:\n${error.stdout}`;
      }
      if (error.stderr) {
        errorDetails += `\n\nError details:\n${error.stderr}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: errorDetails,
          },
        ],
        isError: true,
      };
    }
  }

  private async testScript() {
    try {
      const { stdout, stderr } = await execAsync(`"${this.scriptPath}" --test`);
      return {
        content: [
          {
            type: 'text',
            text: `🧪 Script Test Results:\n\n${stdout}${stderr ? `\n\n${stderr}` : ''}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Script test failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async showHelp() {
    try {
      const { stdout, stderr } = await execAsync(`"${this.scriptPath}" --help`);
      return {
        content: [
          {
            type: 'text',
            text: `📖 Next.js Starter Script Help:\n\n${stdout}${stderr ? `\n\n${stderr}` : ''}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to get help: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async dryRun(config: ProjectConfig) {
    const { name, skipConvex = false, skipClerk = false, template = 'default' } = config;

    try {
      const args = ['--dry-run'];
      if (skipConvex) args.push('--skip-convex');
      if (skipClerk) args.push('--skip-clerk');
      if (template !== 'default') args.push(`--template ${template}`);
      args.push(name);

      const command = `"${this.scriptPath}" ${args.join(' ')}`;
      const { stdout, stderr } = await execAsync(command);

      return {
        content: [
          {
            type: 'text',
            text: `🔍 Dry Run Preview for: ${name}\n\n${stdout}${
              stderr ? `\n\nAdditional info:\n${stderr}` : ''
            }`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Dry run failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Next.js Starter MCP Server running on stdio');
  }
}

const server = new NextjsStarterServer();
server.run().catch(console.error); 