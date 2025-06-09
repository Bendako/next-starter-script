# Next.js Starter Script Repository 🚀

A powerful bash script for creating professional Next.js applications with TypeScript, Tailwind CSS, Convex database, and Clerk authentication options. Now includes an MCP server for Claude Desktop integration!

## What's Inside 📦

This repository contains:

1. **`create-next-starter.sh`** - A comprehensive 2700+ line bash script that automates the creation of professional Next.js applications
2. **`mcp-server/`** - An MCP (Model Context Protocol) server that brings the script's power to Claude Desktop

## The Script: `create-next-starter.sh` ⚡

### Features

- **🔧 Professional Setup** - TypeScript, Tailwind CSS, ESLint with optimal configurations
- **⚡ Real-time Database** - Optional Convex integration with schemas and real-time subscriptions
- **🔐 Authentication** - Optional Clerk integration with middleware and protected routes
- **📋 Multiple Templates** - Choose from minimal, default, or full feature sets
- **🧪 Comprehensive Testing** - Built-in validation and testing modes
- **📖 Excellent Documentation** - Detailed help and examples

### Quick Start

```bash
# Make the script executable
chmod +x create-next-starter.sh

# Create a new Next.js app with all features
./create-next-starter.sh my-awesome-app

# Create a minimal app without database/auth
./create-next-starter.sh --skip-convex --skip-clerk --template minimal my-simple-app

# Preview what would be created (dry run)
./create-next-starter.sh --dry-run my-test-app

# Get comprehensive help
./create-next-starter.sh --help
```

### Script Options

- `--skip-convex` - Skip Convex database setup
- `--skip-clerk` - Skip Clerk authentication setup  
- `--template <type>` - Choose template: `default`, `minimal`, `full`
- `--dry-run` - Preview what would be created
- `--verbose` - Show detailed output
- `--force` - Overwrite existing directory
- `--test` - Test script integrity
- `--help` - Show detailed help

## MCP Server for Claude Desktop 🤖

The `mcp-server/` directory contains an MCP server that brings the script's power directly into Claude Desktop conversations.

### Quick Setup

```bash
# Install and build the MCP server
cd mcp-server
npm install
npm run build

# Add to Claude Desktop config
# macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "nextjs-starter": {
      "command": "node",
      "args": ["/absolute/path/to/next-starter/mcp-server/dist/index.js"]
    }
  }
}
```

### Usage in Claude

Once configured, you can ask Claude to:

> "Create a new Next.js app called 'my-blog' with authentication but without database"

> "Show me what would be created for a minimal dashboard app"

> "Test the script integrity"

See `mcp-server/README.md` for detailed MCP server documentation.

## Project Structure 📁

```
next-starter/
├── create-next-starter.sh          # Main bash script (2700+ lines)
├── README.md                       # This documentation
├── .gitignore                      # Git ignore rules
├── mcp-server/                     # MCP server for Claude Desktop
│   ├── src/index.ts                # MCP server implementation
│   ├── package.json                # MCP dependencies
│   ├── tsconfig.json               # TypeScript config
│   ├── README.md                   # MCP documentation
│   └── dist/                       # Built MCP server (generated)
└── docs/                           # Additional documentation
    ├── script-output-example.md    # Example script output
    └── mcp-examples.md             # MCP usage examples
```

## What Gets Created 🏗️

When you run the script, it creates a professional Next.js application with:

### Base Features (Always Included)
- **Next.js 14+** with App Router
- **TypeScript** with strict configuration
- **Tailwind CSS** with custom configuration
- **ESLint** with comprehensive rules
- **Professional file structure** with organized components, utils, and types

### Optional Features
- **Convex Database** - Real-time database with schemas, queries, mutations
- **Clerk Authentication** - Complete auth system with middleware and protected routes
- **Template Variations** - Minimal, default, or full feature sets

### Example Generated Structure
```
my-app/
├── app/                   # Next.js App Router
├── components/           # Reusable React components  
├── convex/              # Convex database (if enabled)
├── lib/                 # Utility functions
├── types/               # TypeScript type definitions
├── public/              # Static assets
├── tailwind.config.js   # Tailwind configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

## Requirements 📋

- **Bash** (macOS/Linux) or WSL (Windows)
- **Node.js** 18+ and npm
- **Git** for version control
- **Internet connection** for package downloads

## Examples 💡

### Create a Full-Featured App
```bash
./create-next-starter.sh my-saas-app
# Includes: TypeScript, Tailwind, Convex DB, Clerk auth, full template
```

### Create a Simple Blog
```bash
./create-next-starter.sh --skip-convex --skip-clerk --template minimal my-blog
# Includes: TypeScript, Tailwind, minimal features
```

### Preview Before Creating
```bash
./create-next-starter.sh --dry-run my-test-app
# Shows what would be created without actually creating it
```

## Why Use This Script? 🎯

1. **Time Savings** - Skip hours of boilerplate setup
2. **Best Practices** - Configurations follow industry standards
3. **Consistency** - Every project starts with the same solid foundation
4. **Flexibility** - Choose only the features you need
5. **Professional Quality** - Production-ready code from day one
6. **Claude Integration** - Use directly from Claude Desktop with MCP server

## Contributing 🤝

This script represents thousands of hours of Next.js development experience distilled into a single, powerful automation tool. Contributions, suggestions, and feedback are welcome!

## License 📄

MIT License - Use freely in your projects!

---

**🚀 Ready to build amazing Next.js applications?** Whether you use the script directly or through Claude Desktop, you'll have a professional foundation in minutes instead of hours. 