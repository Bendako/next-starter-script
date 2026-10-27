# Hosted MCP integration and release plan

**Date:** 2026-10-24
**Decision:** Advance `hosted/http` (MCP over Streamable HTTP with Clerk OAuth) as the future service. Keep the local Bash/stdio MCP client supported. Do not expose `web-app/` publicly; it is a separate legacy prototype, not the backend to revive.

## Snapshot update — 2026-10-27 (supersedes historical status below)

Checked against GitHub on 2026-10-27. This is **tracking/documentation only**, not merge authorization.

| Area | Current evidence | Required action |
| --- | --- | --- |
| Local baseline | PRs [#30](https://github.com/Bendako/next-starter-script/pull/30), [#29](https://github.com/Bendako/next-starter-script/pull/29), and [#34](https://github.com/Bendako/next-starter-script/pull/34) are merged. Current main: `8dbc098`. CI and MCP protocol (both `ci/mcp` and `qa/mcp`) passed on that SHA. | Keep these as the tested integration baseline; don't re-merge. |
| Generated Convex security | [#43](https://github.com/Bendako/next-starter-script/pull/43) is a draft authorization/privacy fix. Its original head `0e7bd86` passed only the original CI suite, was based on `7e9b8c6`, and was 43 commits behind main on 2026-10-27. | Reconcile with current main, run all applicable protocol/scaffold checks on the **new** exact head, obtain independent review, and seek explicit owner approval. Generated projects previously created need their own migration; a merge does not retrofit them. |
| Hosted transport | [#28](https://github.com/Bendako/next-starter-script/pull/28) is still draft. Its main ancestor predates the isolation fixes in #34. | Integrate #28 with the new main and validate denied/public interface behavior, timeout and cleanup tests on the combined code. |
| Hosted OAuth | [#31](https://github.com/Bendako/next-starter-script/pull/31) is still draft, stacked on #28 rather than main. [#33](https://github.com/Bendako/next-starter-script/issues/33) documents the remaining production Vercel 403 gate and need for audience binding and a real external-client session. | Integrate only after #28; implement and prove verified Clerk OAuth on Vercel. Resolve Convex server credential and Deployment Protection decisions with owner before deployment. |
| Payments | [#26](https://github.com/Bendako/next-starter-script/pull/26) (draft, stacked) and [#38](https://github.com/Bendako/next-starter-script/pull/38) (non-draft, main base) both implement a Polar adapter. CI for #38 head `7dba772` is **action_required**, not success. | Compare overlapping implementations, select one supported path; don't merge both adapters blindly. Require current-head CI, durable Convex webhook/entitlement integration, sandbox tests and owner approval before enabling checkout. |
| Legacy web | [#35](https://github.com/Bendako/next-starter-script/pull/35) is draft fail-closed containment. [#37](https://github.com/Bendako/next-starter-script/issues/37) reports critical/high vulnerabilities in `web-app/`. | Do not expose the legacy app; choose remediation or archive before reuse. |
| Review and release policy | This PR [#36](https://github.com/Bendako/next-starter-script/pull/36) is still open; `AGENTS.md`, CodeQL and merge-policy docs are not on main. There is no repository Ruleset in the accessible GitHub API; classic branch protection read returned 403. | Review and explicitly approve #36 as a sensitive policy/CI change, re-run checks on the exact head, and separately verify the actual GitHub protection settings. |
| Factory automation | [#27](https://github.com/Bendako/next-starter-script/issues/27) and [#32](https://github.com/Bendako/next-starter-script/issues/32) remain open. | Prove independent review and end-to-end canary before claiming complete autonomous factory operation. |

**Current recommended integration order:** first make the generated Convex templates safe (#43) and review/publish the gating policy (#36), each with current-head verification and individual owner approval; reconcile legacy web exposure (#35/#37) in parallel; only then integrate hosted transport (#28), OAuth (#31/#33), quotas/artifact delivery (#15/#16), and the selected Polar adapter (#26 or #38 plus #14). The cost experiment #22 remains **do not merge**.

## Historical PR dependency graph (as of 2026-10-24)

| Order | PR | Base now | Integration action |
| --- | --- | --- | --- |
| 1 | [#30 HTTPS registry check](https://github.com/Bendako/next-starter-script/pull/30) | `main` | Review and merge after verifying connectivity check works in Vercel Sandbox; keep script's dry-run and self-test green |
| 2 | [#29 stdio protocol and E2E](https://github.com/Bendako/next-starter-script/pull/29) | #30's head | Only after #30: retarget to `main`, check that the diff contains only protocol/QA changes, run real minimal/default/full builds, resolve any CI failures |
| 3 | [#34 hosted workspace isolation](https://github.com/Bendako/next-starter-script/pull/34) | `main` | Validate no collision on repeated names, failure cleanup, and process group lifetime; rebase after #29 if necessary |
| 4 | [#28 hosted HTTP transport](https://github.com/Bendako/next-starter-script/pull/28) | `main` | Reconcile conflicting `mcp-server/src/tools.ts` and `tools.test.ts` with #34; run HTTP tests and prove it stays closed in deployed/production conditions |
| 5 | [#31 Clerk OAuth](https://github.com/Bendako/next-starter-script/pull/31) | #28's head | After #28, retarget to `main`; confirm verified OAuth (not JWT decoding alone), token expiry, identity propagation, and cross-user access checks; never rely on the dev allow flag |
| 6 | [#26 Polar adapter](https://github.com/Bendako/next-starter-script/pull/26) | `main` | Verify signed webhook replay and durable store contract; **do not** switch on paid checkout until fulfillment, provider secrets and entitlement checks are live |
| Parallel | [#35 legacy web containment](https://github.com/Bendako/next-starter-script/pull/35) | `main` | Independently review and merge containment, but keep legacy web endpoints disabled; avoid making this an integration dependency |

**Do not merge [#22 sandbox cost spike](https://github.com/Bendako/next-starter-script/pull/22).** It is explicitly a measurement experiment. Use the results to select sandbox CPU/memory/TTL budgets.

This is an intended order, **not an authorization to auto-merge**. After each merge, rebase stacked downstream branches and rerun CI. #28 and #34 modify some of the same MCP files; GitHub marking each independently mergeable against `main` does not imply the combined diff is conflict-free.

## Required technical contract for the MVP

1. **Authentication at boundary**: verify Clerk-issued OAuth for each remote MCP call. No public local/testing bypasses. Anonymous requests fail without work. Define and test OAuth issuer/audience and token expiry.
2. **Authorization at resources**: attach the authenticated user ID to jobs, artifacts and entitlements on the server. Every status/download request enforces owner access. Do not accept userId from tool arguments.
3. **Execution**: validate schemas; reserve usage quota in a durable, atomic store; create a unique sandbox per job; restrict CPU/RAM/disk/network/time; never share working directories across users.
4. **Artifacts**: validate generated output, pack ZIP only from the authorized job directory, store it in private storage, issue owner-scoped signed expiring URLs, and enforce TTL cleanup. Zip delivery is *not yet implemented* on #28.
5. **State machine**: persist jobs as queued/running/succeeded/failed/expired; retries are idempotent and cannot charge the user twice. Do not hold work or artifact buffers in one serverless process.
6. **Billing**: Polar webhook signature + replay protection + durable entitlement update; enforce plan limits before generation. Paid checkout remains off until the full chain is verified.
7. **Telemetry**: correlation IDs, bounded log volume without tokens or secrets, duration/resource accounting, error alerts, kill runaway subprocess trees.

## Release test matrix

- Local CLI: `--help`, `--test`, dry-run and fresh app generation for minimal/default/full.
- Generated app: `npm ci`, typecheck, ESLint and `npm run build` with and without optional integrations, using appropriate test credentials or documented stubs.
- stdio MCP: initialize, tools/list, invalid args/shell-injection attempts, tools/call, timeout + subprocess-group cleanup, EOF.
- HTTP MCP: no token, malformed token, forged token, expired token, valid Clerk token; wrong Origin and public interface; production/preview behavior; sequential and concurrent same-name requests.
- Cross-user access: two distinct authenticated users; one cannot read status, download artifacts, or consume entitlements for the other.
- Sandbox: CPU/memory/network and timeout limits, output size caps, cleanup on error, retry and canceled job.
- Billing: duplicate, delayed and out-of-order webhooks, canceled subscriptions, payment failure, revoked entitlements, quota races.
- Release validation: CodeQL, existing CI, a real deployed preview with external MCP client, and operator-only pilot users before public launch.

## Review automation and branch protection

- This repository includes `AGENTS.md` with high-impact review rules for Codex agents. In Codex settings, connect `Bendako/next-starter-script`, enable **Code review**, then **Automatic review** (including drafts/new pushes if desired). Manual command on a PR: `@codex review`. A bot response requires an enabled Codex integration; leaving a comment alone cannot guarantee review.
- The `CodeQL security scan` workflow provides automated JS/TS scanning. CI passing does **not** prove all security issues are resolved.
- In GitHub repository Settings → Rules → Rulesets, require an approved PR and appropriate CI checks for `main`. Include CodeQL after it has run successfully. Leave automatic merge disabled. Repository rulesets are admin settings and are not configured by a committed workflow.
- Independent human review is required for code involving auth, billing, sandbox or cleanup. Codex feedback and green checks do not substitute for that decision.

## Acceptance gates

The initial MVP is complete only when an authenticated user can, from a real external MCP client, request a supported template and securely download a buildable ZIP; another user cannot see it; repeated/failed calls leave no leaking resources; and usage is enforced server side. Make this work *before* charging users.
