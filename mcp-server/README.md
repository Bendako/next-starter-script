# Next.js Starter MCP Server 🚀

An MCP (Model Context Protocol) server that provides Next.js project creation tools for Claude Desktop. This server wraps the powerful `create-next-starter.sh` script in the parent directory.

## Features ✨

- **🔧 Professional Next.js Setup** - Creates apps with TypeScript, Tailwind CSS, ESLint
- **⚡ Real-time Database** - Optional Convex integration
- **🔐 Authentication** - Optional Clerk authentication
- **📋 Multiple Templates** - Choose from minimal, default, or full templates
- **🔍 Dry Run Mode** - Preview what will be created
- **🧪 Script Testing** - Validate script integrity
- **📖 Built-in Help** - Access script documentation

## Installation 📦

### Prerequisites
- Node.js 18+
- The `create-next-starter.sh` script (in parent directory)

### Install Dependencies
```bash
cd mcp-server
npm install
```

### Build the Server
```bash
npm run build
```

### Test the Server
```bash
npm run dev
```

## Claude Desktop Configuration 🔧

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Option 1: Using absolute path
```json
{
  "mcpServers": {
    "nextjs-starter": {
      "command": "node",
      "args": ["/absolute/path/to/next-starter/mcp-server/dist/index.js"]
    }
  }
}
```

### Option 2: Install globally
```bash
npm install -g .
```

Then use:
```json
{
  "mcpServers": {
    "nextjs-starter": {
      "command": "nextjs-starter-mcp"
    }
  }
}
```

## Available Tools 🛠️

### 1. `create_nextjs_app`
Create a new Next.js application with full customization options.

**Parameters:**
- `name` (required) - App name. Lowercase letters, numbers, hyphens, and underscores. 1 to 214 characters. Cannot start with a hyphen or underscore.
- `directory` (optional) - Where to create the app
- `skipConvex` (optional) - Skip Convex database setup
- `skipClerk` (optional) - Skip Clerk authentication
- `template` (optional) - Template type: `default`, `minimal`, `full`
- `verbose` (optional) - Show detailed output
- `force` (optional) - Overwrite existing directory

**Example usage in Claude:**
> "Create a new Next.js app called 'my-blog' with authentication but without database"

### 2. `dry_run`
Preview what would be created without actually creating files.

### 3. `test_script`
Test the underlying script integrity.

### 4. `script_help`
Show detailed help for the script.

## How It Works 🔄

1. **Claude Desktop** connects to this MCP server
2. **You ask Claude** to create a Next.js project
3. **Claude calls** the appropriate MCP tool
4. **MCP server** executes the `../create-next-starter.sh` script
5. **Script creates** a professional Next.js application
6. **Results** are returned to Claude and displayed to you

## Development 👨‍💻

### Run in Development Mode
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Clean Build Files
```bash
npm run clean
```

## File Structure 📁

```
mcp-server/
├── src/
│   ├── index.ts          # Stdio server
│   ├── tools.ts          # Tool definitions and input validation
│   ├── run.ts            # Script execution
│   └── tools.test.ts     # Input and argv tests
├── dist/                 # Built JavaScript (generated)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This documentation
```

## Troubleshooting 🔧

### Common Issues

1. **Script not found**
   - Ensure `create-next-starter.sh` is in the parent directory
   - Check that the script is executable: `chmod +x ../create-next-starter.sh`

2. **Permission errors**
   - Make sure you have write permissions in the target directory
   - Try running with `force: true` if directory exists

3. **Network issues**
   - Ensure internet connection for package downloads
   - Check npm cache: `npm cache clean --force`

### Debugging

Run with verbose output:
```bash
npm run dev
```

Check the console for error messages and script execution details.

## Hosted mode

Set `NEXT_STARTER_MCP_HOSTED=1` (or `true`) before starting the server when callers are not trusted. The server then omits `directory` and `force` from `tools/list` and rejects those arguments. New projects are written under a directory the server chooses inside the system temp folder. Leave the variable unset for local stdio. Local callers can still pass `directory` and `force`.

## License 📄

MIT License - Use freely in your projects!

---

**🎯 Ready to create amazing Next.js applications with Claude!** This MCP server brings the power of the professional starter script directly into your Claude Desktop workflow. 