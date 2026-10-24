# ⚡ Next.js Starter MCP

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript)
![Claude MCP](https://img.shields.io/badge/Claude-MCP%20Ready-orange?style=for-the-badge&logo=anthropic)
![MIT License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**Create professional Next.js applications in minutes, not hours**

*Now with first-class Claude Desktop integration via MCP*

[🚀 Get Started](#quick-start) • [📖 Documentation](#documentation) • [Connect a client](mcp-server/README.md) • [⭐ Star on GitHub](https://github.com/yourusername/next-starter)

</div>

---

## 🎯 **What This Does**

Transform this:
```bash
# Hours of manual setup...
npx create-next-app
# Install dependencies...
# Configure TypeScript...
# Setup Tailwind...
# Add authentication...
# Configure database...
# And so much more...
```

Into this:
```bash
# With Claude Desktop
> "Create a SaaS app with authentication and real-time database"

# Or direct script
./create-next-starter.sh my-saas-app
```

**Result:** Production-ready Next.js application with 2700+ lines of best practices applied automatically.

## ✨ **Key Features**

| Feature | Traditional Setup | Next.js Starter MCP |
|---------|-------------------|-------------------|
| **Time to Production** | 4-6 hours | 2-3 minutes |
| **Best Practices** | Manual research | Built-in (2700+ lines) |
| **Authentication** | Complex setup | One command |
| **Database** | Multiple configs | Automatic |
| **AI Integration** | Not available | Native Claude support |

### **What's Included**

- **🔧 `create-next-starter.sh`** - 2700+ line battle-tested automation script
- **🤖 `mcp-server/`** - Claude Desktop integration via MCP protocol
- **📋 Multiple Templates** - Minimal, Default, Full configurations
- **⚡ Real-time Database** - Convex integration with schemas
- **🔐 Authentication** - Clerk setup with middleware
- **🎨 Modern UI** - Tailwind CSS with optimal configuration

## 🚀 Quick Start

### **Option 1: MCP client**

1. **Build the server**
   ```bash
   cd mcp-server && npm install && npm run build
   ```

2. **Add the client config**
   Claude Desktop, Codex, and Cursor setup is in [`mcp-server/README.md`](mcp-server/README.md).

3. **Create Apps with Natural Language**
   ```
   > "Create a blog app with authentication but no database"
   > "Build a SaaS dashboard with Convex and Clerk"
   > "Make a minimal portfolio site"
   ```

### **Option 2: Direct Script Usage**

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

## Connect an MCP client

Build the server, then connect Claude Desktop, Codex, or Cursor. The file locations, config snippets, and example prompts are in [`mcp-server/README.md`](mcp-server/README.md).

## Project Structure 📁

```
next-starter/
├── create-next-starter.sh          # Main bash script (2700+ lines)
├── README.md                       # This documentation
├── .gitignore                      # Git ignore rules
├── mcp-server/                     # MCP server
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