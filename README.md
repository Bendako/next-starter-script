# Next.js Starter MCP

![MIT License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

A local Next.js starter kit sold for a one-time payment: a Bash generator and a local stdio MCP server. Use it from your terminal or let an MCP client call the same generator on your machine.

The kit is for developers who want a reusable starting point with optional Clerk authentication and Convex database scaffolding. You receive source code to inspect and adapt; you still configure external services, test your app, and choose where to deploy it. Third-party services, hosting, and any paid MCP client are separate from the kit purchase.

## What you get

- [`create-next-starter.sh`](create-next-starter.sh): generates a Next.js project and adds components, utilities, environment placeholders, and optional integrations.
- [`mcp-server/`](mcp-server/): a TypeScript server that exposes the generator to a local MCP client over stdio.
- [`mcp-server/README.md`](mcp-server/README.md): connection examples for Claude Desktop, Codex, and Cursor.
- [`CHANGELOG.md`](CHANGELOG.md): changes traced to repository history.

The generator invokes `create-next-app@latest` with TypeScript, Tailwind CSS, ESLint, App Router, a `src/` directory, and the `@/*` import alias. Framework versions therefore depend on what upstream supplies when you run it.

Clerk and Convex scaffolding are enabled by default in flag-based runs. They include environment placeholders and integration code, not provisioned accounts or credentials. Use the skip flags to omit either integration.

This purchase covers the local kit. The repository also contains a work-in-progress hosted HTTP MCP service and a legacy web-app prototype; neither is the local product's deployment path.

## Requirements

- Bash on macOS/Linux, or a Bash environment such as WSL on Windows.
- Node.js 20.9+ for generated apps, plus npm and npx. The script rejects older versions because `create-next-app` 16 requires 20.9+.
- For `mcp-server/`, Node.js 22+ is recommended, using a version that satisfies its dependency engines. `validate-npm-package-name@8` declares Node `^22.22.2 || ^24.15.0 || >=26`; it prints an `EBADENGINE` warning on Node 20, although tests still pass on Node 20.
- Internet access to download npm packages and a writable project directory.
- For MCP use, a client that can launch local stdio servers.
- For enabled integrations, your own Clerk/Convex accounts and configuration.

## Quickstart in under 5 minutes

Verified on 2026-10-30 on Linux with Node.js 20.19.2, npm 11.21.1, and Bash 5.2. Generating the app (about 20 seconds), lint and build, and the MCP build (about 5 seconds) all finished well inside five minutes on that machine; timing depends on your network. macOS and Windows were not tested. Start in the kit root directory.

1. Check Node.js (20.9+ is required by `create-next-app` 16) and npm:

   ```bash
   node --version
   npm --version
   ```

2. Preview the app. This was instant and writes `setup.log` in the current directory:

   ```bash
   bash ./create-next-starter.sh --dry-run --skip-clerk --skip-convex --template minimal -- my-app
   ```

3. Generate the app. This needs internet, creates `./my-app`, and took about 20 seconds including npm install:

   ```bash
   bash ./create-next-starter.sh --skip-clerk --skip-convex --template minimal -- my-app
   ```

4. Lint, build, and start the app. Lint and build both passed; the development server started and answered HTTP 200 (checked on port 3200; Next.js uses port 3000 by default):

   ```bash
   cd my-app && npm run lint && npm run build
   npm run dev
   ```

5. For MCP, open another terminal in the kit root and build the server. This took about 5 seconds:

   ```bash
   cd mcp-server && npm install && npm run build
   ```

   Configure the client with `node` and the absolute path to `mcp-server/dist/index.js`; see the [client configuration guide](mcp-server/README.md). A stdio `initialize` + `tools/list` handshake returned `create_nextjs_app`, `dry_run`, `test_script`, and `script_help`.

## Choose your starting point

| Option | Actual behavior |
| --- | --- |
| `--skip-convex` | Omits Convex setup. |
| `--skip-clerk` | Omits Clerk setup. |
| `--template default` | Uses the standard scaffolding; flag-based `--template default` without skip flags includes Clerk and Convex. |
| `--template minimal` | Selects the minimal customization branch; it does not automatically disable Clerk or Convex. Use the skip flags for that. |
| `--template full` | Adds loading and error-boundary components to the base scaffolding. |
| `--dry-run` | Prints a preview without generating the app; script logging may still write `setup.log`. |
| `--verbose` | Enables additional diagnostic output. |
| `--force` | Deletes an existing app directory before generating again. Back up work first. |
| `--test` | Runs script self-tests; this does not establish that a generated app builds. |
| `--help` | Shows the script's complete option list. |

Running the script with only an app name currently prints the menu text without prompting, automatically selects option 1 (Default, Clerk and Convex skipped), and generates the app. Without a TTY on stdin it also prints a notice naming that default. Flag-based `--template default` without skip flags includes Clerk and Convex. Use `--` before the app name in flag-based commands, as shown above. Direct generation creates the app beneath the shell's current directory.

App names must start with a lowercase letter or number, contain only lowercase letters, numbers, and hyphens, and be 1–214 characters long.

## Local MCP tools

| Tool | Purpose |
| --- | --- |
| `create_nextjs_app` | Generates an app; accepts `name`, optional `directory`, `skipConvex`, `skipClerk`, `template`, `verbose`, and `force`. |
| `dry_run` | Previews an app using its name, template, and integration flags. |
| `test_script` | Runs the Bash self-tests. |
| `script_help` | Returns the generator's help text. |

The server validates tool arguments and launches Bash with an argument array and `shell: false`. Pass an explicit, existing, writable directory when you want control over the output location. The local tools can write to your filesystem, and `force` can delete an existing app directory.

## After generation

- Inspect `.env.local` and configure any enabled integrations. Keep secrets out of version control.
- For Convex, follow the generated setup instructions. The generator adds `setup:convex` to run code generation and remove the temporary TypeScript exclusion for `convex/` once generated files exist.
- For Clerk, supply both keys before relying on protected routes. The generated code permits keyless development; production protected routes return 503 when keys are missing unless `ALLOW_NO_AUTH=true` enables the bypass. Leave that bypass unset when authentication is required.
- Run a TypeScript check and `npm run build` for your selected template and integration combination. Generation success alone does not verify an application's production readiness.

## Troubleshooting

- **`npm ci` in `mcp-server/` fails with `Missing: @esbuild/... from lock file`:** older checkouts had a `package-lock.json` without the esbuild platform entries that npm 11 requires (npm 10 accepted it). The lockfile now includes them, so `npm ci` works on npm 10 and 11; update your checkout if you still see this.
- **`EBADENGINE` warning on Node 20:** `validate-npm-package-name@8` declares Node `^22.22.2 || ^24.15.0 || >=26`. Tests still pass on Node 20; Node.js 22+ is recommended for `mcp-server/`, with a version satisfying that engine range.
- **Node or package errors:** check `node --version`, `npm --version`, and the requirements of the downloaded Next.js tooling. Inspect terminal output and `setup.log` where available; some dependency-install failures allow the script to continue.
- **Registry connection fails:** check your npm registry, proxy, and network configuration. The direct script resolves the configured npm registry; the MCP child process sets its registry to `https://registry.npmjs.org/`.
- **App directory already exists:** choose another name or directory. Use `--force` only when you intend to delete the existing directory.
- **MCP tools do not appear:** build `mcp-server/`, check the absolute entry-point path and that the client can find `node` and `bash`, then restart the client. Use the [connection examples](mcp-server/README.md).
- **Authentication or database is unavailable:** fill in the generated environment values and complete service setup, or regenerate with the relevant skip flag.

## Contributing

Contributions, suggestions, and feedback are welcome. Repository review guidance is in [AGENTS.md](AGENTS.md).

Repository: https://github.com/Bendako/next-starter-script

## License 📄

MIT License - Use freely in your projects!
