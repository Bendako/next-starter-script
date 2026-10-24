# Hosted MCP

Streamable HTTP entry for the Next.js starter tools. The route is `/mcp`. It uses the tool list and input schemas from `mcp-server`. Stdio stays in that package. The payments package stays in `hosted/`. This app is `hosted/http`.

`dry_run`, `script_help`, and `test_script` run in the Function. `create_nextjs_app` starts one Vercel Sandbox, 1 vCPU and 2048 MB, not persistent, 270 second timeout, `registry.npmjs.org` only, and stops it when the call ends. The function limit is 300 seconds, so the sandbox ends first and the function can still stop it. The archive excludes `node_modules`, `.next`, `.git`, symlinks, and `.env` files other than `.env.example`. Download links are a later change. Until then, set `NEXT_STARTER_GENERATION_STUB` to `1` to return a stub result.

The route stays closed unless `NEXT_STARTER_MCP_ALLOW_LOCAL` is `1` and `VERCEL` is not `1`. A localhost URL, `NODE_ENV=development`, and the old production flag do not open it. `npm run dev` and `npm start` bind to `127.0.0.1`. Also turn on Vercel Deployment Protection for the production deployment.

`NEXT_STARTER_MCP_ALLOW_LOCAL=1` serves the tools with no authentication to anything that can reach the port. `next dev` and `next start` listen on every network interface unless you pass `-H 127.0.0.1`. `npm run dev` and `npm start` pass that bind. Running `next dev` or `next start` on their own, or with `-H 0.0.0.0`, exposes the tools on the network. Never set the flag on a self-hosted server. The flag together with `VERCEL_ENV=production` and without `VERCEL=1` leaves the route open.

One process allows 60 requests per minute. Off Vercel every caller shares one key, because forwarded IP headers are not trusted. On Vercel the key is `x-real-ip` or the token client id. A Vercel Firewall rule for the deployment is `_TBD_`.

## Local

From `hosted/http`:

```bash
npm ci
npm test
npm run build
NEXT_STARTER_MCP_ALLOW_LOCAL=1 npm start
```

`npm start` listens on `127.0.0.1` only. Connect a client to `http://127.0.0.1:3000/mcp`. Without `NEXT_STARTER_MCP_ALLOW_LOCAL=1` every request is refused.

## Vercel

Set the project Root Directory to `hosted/http`. The install step still needs the repo parent, because the build compiles `mcp-server` and copies `create-next-starter.sh`.

The build command is `node scripts/vercel-build.mjs`. `npx convex deploy --cmd 'npm run build'` runs only when `NEXT_STARTER_CONVEX_DEPLOY` is `1`, `VERCEL` is `1`, and `CONVEX_DEPLOY_KEY` is set. Without that opt-in, the script runs `npm run build` only.

## Convex

`convex/health.ts` exports `health.ok`, which returns `OK`. `create_nextjs_app` calls it when `NEXT_PUBLIC_CONVEX_URL` is set. Other tools do not. A failed query is a tool error, not an HTTP 503 for the whole route. Tables and the rest of the functions are not part of this app yet.

## Environment variables

Names only. Do not commit values.

| Name | Use |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL. Read by the server. Safe to expose. |
| `CONVEX_DEPLOY_KEY` | Build-time deploy key. Server and build only. Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_STARTER_CONVEX_DEPLOY` | `1` opts the Vercel build into `convex deploy`. Ignored off Vercel. |
| `NEXT_STARTER_MCP_ALLOW_LOCAL` | `1` opens the route with no authentication for anything that can reach the port. `next dev` and `next start` listen on every interface unless you pass `-H 127.0.0.1`. Do not use `-H 0.0.0.0`. Never set this on a self-hosted server. The flag with `VERCEL_ENV=production` and without `VERCEL=1` leaves the route open. `npm start` binds to `127.0.0.1`. |
| `NEXT_STARTER_GENERATION_STUB` | `1` or `true` returns the stub create result and does not start a sandbox. |
| `NEXT_STARTER_MCP_ORIGINS` | Comma-separated Origin allow-list. When unset, only localhost, `127.0.0.1`, and `::1` are allowed. A missing Origin is allowed. |

The hosted route forces hosted mode. It does not read a token for the sandbox. On Vercel the sandbox SDK uses the platform identity. Do not add a sandbox token to the repo.

## Clients

Replace the host. No tokens belong in these files.

Claude Desktop:

```json
{
  "mcpServers": {
    "nextjs-starter": {
      "url": "https://YOUR_DEPLOYMENT_HOST/mcp"
    }
  }
}
```

Cursor, in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nextjs-starter": {
      "url": "https://YOUR_DEPLOYMENT_HOST/mcp"
    }
  }
}
```

Codex, in `~/.codex/config.toml`:

```toml
[mcp_servers.nextjs-starter]
url = "https://YOUR_DEPLOYMENT_HOST/mcp"
```

## Auth and entitlements

`authorizeToolCall` in `src/gate.ts` receives the request, auth info, the tool name, and the tool arguments. `request.auth` and the handler auth info stay undefined until `withMcpAuth` lands in #13. `identityAllows` returns false unless the local flag opened the process. Identity checks and plan checks replace that function. This app does not implement them.
