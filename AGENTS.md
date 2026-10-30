See [FACTORY.md](FACTORY.md) for the authoritative software factory rules.

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
- Follow [FACTORY.md](FACTORY.md), the source of truth for the three-tier policy
  below, and [the merge policy](docs/MERGE_POLICY.md) for decision packets. Attach
  a decision packet to every PR; checks and reviews apply to the exact head SHA.
  Never bypass GitHub branch protection. PR #29 and PR #30 are Tier 3.
- For sensitive PR approval, prepare the Hebrew-language decision packet with impact, benefits, unresolved findings, exact CI/Codex links, confidence, dependencies, rollout/rollback, alternatives and a clear merge/hold recommendation; see [#29/#30 assessment](docs/PR_29_30_MERGE_ASSESSMENT_2026-10-24.md).
- GitHub automation is not installed by this document. An assistant's runtime permission and a passing CI job are not substitutes for required reviews.

## Three-tier merge policy

[FACTORY.md](FACTORY.md) is authoritative, including reviewer verdict rules.

- **Tier 1 — auto-merge without asking:** docs-only, tests-only, typo/text fixes,
  and patch-level dependency bumps. The release bot merges; the owner gets one
  line in the daily summary.
- **Tier 2 — auto-merge after notice:** regular features and bug fixes. Notify the
  owner; the release bot merges after 12 hours unless the owner says stop.
- **Tier 1 and 2 preconditions:** the PR is non-draft; the independent reviewer
  bot's latest verdict on the exact current head is `ready`, interpreted using
  the verdict rules in FACTORY.md; all required checks, including `ci/mcp` and
  `qa/mcp`, are green; no sensitive category is touched; and squash merge is
  locked to the reviewed head SHA. All other merge gates also apply.
- **Tier 3 — always explicit owner approval on the exact head SHA:** any sensitive
  category (auth, payments, secrets, CI permissions, installer/network, subprocess
  lifecycle, sandbox, security controls, edits to merge policy or FACTORY.md
  itself), production deploys, database schema/migration changes, and PRs over
  400 changed lines. Sensitive categories also include authorization, OAuth,
  token validation, credentials, billing/entitlements, filesystem isolation,
  command invocation, input-trust boundaries, user data/privacy, destructive
  changes, supply chain/build/install behavior, externally exposed endpoints,
  policy/rulesets, and production infrastructure. Security hardening is sensitive.
- Tier 3 criteria override Tier 1 and 2 descriptions, including docs-only changes.
- When in doubt, move the PR up a tier. A new push after review resets the tier
  evaluation, checks and review; renew Tier 2 notice and any required Tier 3
  approval for the new head. Dependencies never authorize an indirect merge.

Use the bot commit identity and mandatory squash merge in FACTORY.md. Never
force-push or rewrite history without owner confirmation. Secrets/keys, paid
plans, permission changes, branch-protection changes and deployments require
owner approval; production deploys always require Tier 3 approval.
