# Next.js Starter MCP Server 🚀

An MCP (Model Context Protocol) server that provides Next.js project creation tools. Claude Desktop, Codex, and Cursor can start it. This server wraps `create-next-starter.sh` in the parent directory.

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

## Connect a client

Each client below starts the built server with `node` and the absolute path to `mcp-server/dist/index.js`. Replace `/absolute/path/to/next-starter` with the directory that contains `create-next-starter.sh` and `mcp-server/`.

The config key is `nextjs-starter`. The `Server` constructor in `src/index.ts` sets the protocol name to `nextjs-starter-script`. Use `nextjs-starter` in the client config.

### Connect Claude Desktop

From the `mcp-server` directory, install dependencies and build the server.

```bash
npm install && npm run build
```

Claude Desktop reads `claude_desktop_config.json`. On macOS that file is `~/Library/Application Support/Claude/claude_desktop_config.json`. On Windows that file is `%APPDATA%\Claude\claude_desktop_config.json`. The [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) guide documents both paths and the `mcpServers`, `command`, and `args` keys.

Add `nextjs-starter` under `mcpServers`. When the file already has other servers, add this entry beside them.

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

Quit Claude Desktop, then start it again. Open the `nextjs-starter` connector and confirm it lists `create_nextjs_app`, `dry_run`, `test_script`, and `script_help`.

Try this prompt.

> Create a Next.js app named my-blog and skip the database.

### Connect Codex

From the `mcp-server` directory, install dependencies and build the server.

```bash
npm install && npm run build
```

Codex reads `~/.codex/config.toml`. The [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp) page documents a `[mcp_servers.<name>]` table with `command` and `args` for a stdio server. The [Configuration Reference](https://developers.openai.com/codex/config-reference) lists `mcp_servers.<name>.command` as the launcher command and `mcp_servers.<name>.args` as the arguments array.

Add this table.

```toml
[mcp_servers.nextjs-starter]
command = "node"
args = ["/absolute/path/to/next-starter/mcp-server/dist/index.js"]
```

Run `codex mcp list`. Confirm that `nextjs-starter` is enabled.

Try this prompt.

> Preview a minimal Next.js app named my-dashboard without creating files.

### Connect Cursor

From the `mcp-server` directory, install dependencies and build the server.

```bash
npm install && npm run build
```

Cursor reads `mcp.json`. The project file is `.cursor/mcp.json`. The global file is `~/.cursor/mcp.json`. The [MCP integrations](https://cursor.com/help/customization/mcp) page documents both paths and says to commit the project file. The stdio server table on the [Model Context Protocol (MCP)](https://cursor.com/docs/mcp) page lists `type`, `command`, and `args`. It marks `type` as required and gives `stdio` as the value. The same page defines `${workspaceFolder}` as the folder that contains `.cursor/mcp.json` and says Cursor resolves that variable in `args`.

This repo commits `.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "nextjs-starter": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"]
    }
  }
}
```

Open this repo in Cursor after the build. Restart Cursor. Open Customize, then MCPs, and confirm `nextjs-starter` lists `create_nextjs_app`, `dry_run`, `test_script`, and `script_help`.

For `~/.cursor/mcp.json`, or for another project's `.cursor/mcp.json`, use an absolute path.

```json
{
  "mcpServers": {
    "nextjs-starter": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/next-starter/mcp-server/dist/index.js"]
    }
  }
}
```

Restart Cursor. Confirm the same four tools under Customize, then MCPs.

Try this prompt.

> Show the help for the Next.js starter script.

## Available Tools 🛠️

### 1. `create_nextjs_app`
Create a new Next.js application with full customization options.

**Parameters:**
- `name` (required) - App name. Letters, numbers, and hyphens. 1 to 214 characters.
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

1. The MCP client connects to this server over stdio.
2. You ask the client to create a Next.js project.
3. The client calls the matching tool.
4. This server runs `create-next-starter.sh` in the parent directory.
5. The script creates the Next.js application.
6. The tool result goes back to the client.

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