#!/usr/bin/env node

/**
 * Next.js Starter MCP Server
 * Provides tools for creating configured Next.js applications
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface ProjectConfig {
  name: string;
  directory?: string;
  includeConvex?: boolean;
  includeClerk?: boolean;
  includeRadix?: boolean;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
}

class NextjsStarterServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'nextjs-starter',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_nextjs_app',
            description: 'Create a new Next.js application with your tech stack',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the application',
                  pattern: '^[a-zA-Z0-9-_]+$'
                },
                directory: {
                  type: 'string',
                  description: 'Directory to create the app in (default: current directory)'
                },
                includeConvex: {
                  type: 'boolean',
                  description: 'Include Convex real-time database (default: true)',
                  default: true
                },
                includeClerk: {
                  type: 'boolean',
                  description: 'Include Clerk authentication (default: true)',
                  default: true
                },
                includeRadix: {
                  type: 'boolean',
                  description: 'Include Radix UI components (default: true)',
                  default: true
                },
                packageManager: {
                  type: 'string',
                  enum: ['npm', 'yarn', 'pnpm'],
                  description: 'Package manager to use (default: npm)',
                  default: 'npm'
                }
              },
              required: ['name']
            }
          },
          {
            name: 'list_templates',
            description: 'List available project templates',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'create_from_template',
            description: 'Create project from a specific template',
            inputSchema: {
              type: 'object',
              properties: {
                template: {
                  type: 'string',
                  enum: ['basic', 'blog', 'dashboard', 'ecommerce', 'saas'],
                  description: 'Template to use'
                },
                name: {
                  type: 'string',
                  description: 'Name of the application'
                },
                directory: {
                  type: 'string',
                  description: 'Directory to create the app in'
                }
              },
              required: ['template', 'name']
            }
          }
        ] as Tool[]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_nextjs_app':
            return await this.createNextjsApp(args as ProjectConfig);
          
          case 'list_templates':
            return await this.listTemplates();
          
          case 'create_from_template':
            return await this.createFromTemplate(args as any);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private async createNextjsApp(config: ProjectConfig) {
    const {
      name,
      directory = process.cwd(),
      includeConvex = true,
      includeClerk = true,
      includeRadix = true,
      packageManager = 'npm'
    } = config;

    const projectPath = path.join(directory, name);
    const steps: string[] = [];

    try {
      // Check if directory already exists
      try {
        await fs.access(projectPath);
        throw new Error(`Directory '${name}' already exists`);
      } catch (error) {
        if ((error as any).code !== 'ENOENT') throw error;
      }

      steps.push('🚀 Creating Next.js application...');
      
      // Create Next.js app
      await execAsync(`npx create-next-app@latest ${name} --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes`, {
        cwd: directory
      });

      // Navigate to project directory
      process.chdir(projectPath);

      // Install base dependencies
      const baseDeps = ['@radix-ui/react-icons', 'lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'];
      
      if (includeConvex) {
        baseDeps.push('convex');
      }
      
      if (includeClerk) {
        baseDeps.push('@clerk/nextjs');
      }

      if (includeRadix) {
        baseDeps.push('@radix-ui/react-slot', '@radix-ui/react-button');
      }

      steps.push('📦 Installing dependencies...');
      await execAsync(`${packageManager} install ${baseDeps.join(' ')}`);

      // Create utility files
      steps.push('🛠️ Creating utility files...');
      await this.createUtilityFiles();

      // Create components
      if (includeConvex) {
        steps.push('⚡ Setting up Convex...');
        await this.setupConvex();
      }

      if (includeClerk) {
        steps.push('🔐 Setting up Clerk...');
        await this.setupClerk(name);
      }

      // Update layout
      steps.push('🔧 Updating layout...');
      await this.updateLayout(name, includeConvex, includeClerk);

      // Create sample page
      steps.push('📱 Creating sample page...');
      await this.createSamplePage(name, includeClerk);

      // Create environment file
      steps.push('📄 Creating environment file...');
      await this.createEnvFile(includeConvex, includeClerk);

      const successMessage = `
✅ Successfully created ${name}!

📁 Project created at: ${projectPath}

🚀 Next steps:
1. cd ${name}
${includeConvex ? '2. npx convex dev (set up your Convex deployment)\n' : ''}${includeClerk ? `${includeConvex ? '3' : '2'}. Set up Clerk at https://clerk.com\n` : ''}${includeConvex || includeClerk ? `${includeConvex && includeClerk ? '4' : '3'}. Update .env.local with your keys\n` : ''}${includeConvex || includeClerk ? `${includeConvex && includeClerk ? '5' : includeConvex ? '3' : '2'}. ${packageManager} run dev` : '2. npm run dev'}

🎉 Your app is ready to go!
      `;

      return {
        content: [
          {
            type: 'text',
            text: steps.join('\n') + '\n' + successMessage
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed at step: ${steps[steps.length - 1]}\nError: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  private async createUtilityFiles() {
    // Create utils
    await fs.mkdir('src/lib', { recursive: true });
    await fs.writeFile('src/lib/utils.ts', `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`);
  }

  private async setupConvex() {
    // Initialize Convex
    await execAsync('npx convex dev --once');

    // Create Convex provider
    await fs.writeFile('src/app/ConvexClientProvider.tsx', `"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
`);

    // Create schema
    await fs.mkdir('convex', { recursive: true });
    await fs.writeFile('convex/schema.ts', `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    clerkId: v.string(),
  }).index("by_clerk_id", ["clerkId"]),
  
  posts: defineTable({
    title: v.string(),
    content: v.string(),
    authorId: v.id("users"),
    createdAt: v.number(),
  }).index("by_author", ["authorId"]),
});
`);
  }

  private async setupClerk(appName: string) {
    // Create middleware
    await fs.writeFile('src/middleware.ts', `import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/"]
});

export const config = {
  matcher: ["/((?!.+\\\\.[\\\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
`);
  }

  private async updateLayout(appName: string, includeConvex: boolean, includeClerk: boolean) {
    const convexImport = includeConvex ? `import ConvexClientProvider from './ConvexClientProvider'` : '';
    const clerkImport = includeClerk ? `import { ClerkProvider } from '@clerk/nextjs'` : '';
    
    const convexWrapper = includeConvex ? 'ConvexClientProvider' : 'div';
    const clerkWrapper = includeClerk ? 'ClerkProvider' : 'div';

    await fs.writeFile('src/app/layout.tsx', `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
${clerkImport}
${convexImport}

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "${appName}",
  description: "Generated with Next.js starter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    ${includeClerk ? '<ClerkProvider>' : ''}
      <html lang="en">
        <body className={inter.className}>
          ${includeConvex ? '<ConvexClientProvider>' : ''}
            {children}
          ${includeConvex ? '</ConvexClientProvider>' : ''}
        </body>
      </html>
    ${includeClerk ? '</ClerkProvider>' : ''}
  );
}
`);
  }

  private async createSamplePage(appName: string, includeClerk: boolean) {
    const clerkImports = includeClerk ? `import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'` : '';
    const authSection = includeClerk ? `
          <div>
            <SignedOut>
              <SignInButton>
                <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>` : '';

    await fs.writeFile('src/app/page.tsx', `${clerkImports}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-4xl w-full">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold">
            Welcome to ${appName}
          </h1>
          ${authSection}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Next.js</h2>
            <p className="text-gray-600">React framework with TypeScript</p>
          </div>
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Tailwind</h2>
            <p className="text-gray-600">Utility-first CSS framework</p>
          </div>
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Convex</h2>
            <p className="text-gray-600">Real-time database</p>
          </div>
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Clerk</h2>
            <p className="text-gray-600">Authentication solution</p>
          </div>
        </div>
      </div>
    </main>
  );
}
`);
  }

  private async createEnvFile(includeConvex: boolean, includeClerk: boolean) {
    let envContent = '';
    
    if (includeConvex) {
      envContent += `# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

`;
    }
    
    if (includeClerk) {
      envContent += `# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
`;
    }

    await fs.writeFile('.env.local', envContent);
  }

  private async listTemplates() {
    const templates = [
      {
        name: 'basic',
        description: 'Basic Next.js app with TypeScript and Tailwind',
        features: ['Next.js 14', 'TypeScript', 'Tailwind CSS', 'ESLint']
      },
      {
        name: 'blog',
        description: 'Blog template with MDX support',
        features: ['Basic features', 'MDX', 'Blog layouts', 'Content management']
      },
      {
        name: 'dashboard',
        description: 'Admin dashboard with authentication',
        features: ['Basic features', 'Convex', 'Clerk', 'Dashboard UI', 'Charts']
      },
      {
        name: 'ecommerce',
        description: 'E-commerce template with cart and payments',
        features: ['Dashboard features', 'Stripe', 'Product catalog', 'Cart system']
      },
      {
        name: 'saas',
        description: 'Full SaaS template with subscriptions',
        features: ['E-commerce features', 'Subscriptions', 'User management', 'Analytics']
      }
    ];

    return {
      content: [
        {
          type: 'text',
          text: `Available Templates:\n\n${templates.map(t => 
            `📦 ${t.name}\n   ${t.description}\n   Features: ${t.features.join(', ')}`
          ).join('\n\n')}`
        }
      ]
    };
  }

  private async createFromTemplate(args: { template: string; name: string; directory?: string }) {
    // This would contain specific template logic
    // For now, just call the basic creator with template-specific config
    const templateConfigs = {
      basic: { includeConvex: false, includeClerk: false },
      blog: { includeConvex: false, includeClerk: false },
      dashboard: { includeConvex: true, includeClerk: true },
      ecommerce: { includeConvex: true, includeClerk: true },
      saas: { includeConvex: true, includeClerk: true }
    };

    const config = templateConfigs[args.template as keyof typeof templateConfigs];
    
    return await this.createNextjsApp({
      name: args.name,
      directory: args.directory,
      ...config
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Next.js Starter MCP Server running on stdio');
  }
}

const server = new NextjsStarterServer();
server.run().catch(console.error);