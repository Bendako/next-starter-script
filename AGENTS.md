# Repository guidance for coding agents and code review

This repository has distinct products: the Bash generator and local stdio MCP server; a **work-in-progress** hosted HTTP MCP service; and a **legacy, insecure-by-default** web-app prototype. Do not assume that a local CI success proves the hosted SaaS can be deployed.

## Code Review Rules

### Untrusted MCP tool input and subprocesses
Treat every MCP argument, app name, path, and environment value as untrusted. Tool arguments must be schema-validated before file operations and passed to the Bash generator as an argv array with `shell: false` or equivalent. A hosted caller must never supply output directories or overwrite existing files outside its isolated workspace. Report any case where one caller can read, overwrite, reuse or download another caller's generated project, including on retries or failures. Call out unsafe cleanup and subprocesses left alive on timeouts.

### Hosted authentication and resource ownership
Before enabling a publicly reachable `/mcp` endpoint, require **verified** Clerk OAuth identity at the server entry point, enforce resource ownership again at status/download endpoints, and do not rely on Origin, obscurity of job IDs, front-end checks, or developer-only env flags as production authentication. An anonymous or invalid-token request must not be able to create a project or consume resources. Allow explicit localhost-only test seams but never public deployment bypasses.

### Billing and quota enforcement
Payment webhooks must verify signatures, handle repeated/out-of-order events idempotently, and persist entitlements durably. Plan IDs and prices must come from server-owned configuration, not the browser. Reserve/reconcile usage limits atomically on the backend before starting costly generator jobs. Do not treat process-local stores as authoritative across serverless instances.

## Development and verification rules

- Keep changes scoped; do not silently merge or rewrite existing PR branches.
- When changing the script, MCP tools or hosted transport, add tests for both success and failure/denial paths.
- Prove generated apps actually typecheck and build in their selected templates. Do not call an untested template "production-ready".
- Treat `web-app/` as a legacy prototype; don't re-enable generation or checkout without fixing server-side authentication, Prisma model mismatches and billing webhooks.
- Follow [the merge policy](docs/MERGE_POLICY.md) and attach a decision packet to every PR before merging. Review checks are tied to the **exact head SHA**, not just the branch name.
- Low-risk **routine** PRs may be merged under the repository owner's standing authorization **only after** current-head CI, Codex review, open-thread disposition, compatibility and rollback gates pass. Never bypass GitHub branch protection.
- **Sensitive** PRs always need the owner's explicit approval for the specific PR and current commit. This includes installer/network and credentials, subprocess lifecycle, auth, billing, sandbox, security controls, CI permissions, and edits to merge policy. PR #29 and PR #30 are sensitive despite passing their latest checks.
- For sensitive PR approval, prepare the Hebrew-language decision packet with impact, benefits, unresolved findings, exact CI/Codex links, confidence, dependencies, rollout/rollback, alternatives and a clear merge/hold recommendation; see [#29/#30 assessment](docs/PR_29_30_MERGE_ASSESSMENT_2026-10-24.md).
- GitHub automation is not installed by this document. An assistant's runtime permission and a passing CI job are not substitutes for required reviews.
