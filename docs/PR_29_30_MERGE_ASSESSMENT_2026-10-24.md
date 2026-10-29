# Merge decision packet: PR #30 and PR #29

> **Update (2026-10-24):** PR #30's self-test SIGTERM cleanup finding was fixed on commit `8775191a`. [CI passed](https://github.com/Bendako/next-starter-script/actions/runs/40116733115) across Ubuntu/macOS Node 18/20/21, MCP and payments. The old review threads were answered and resolved; a fresh Codex review of this SHA has been requested. **No merge to main has occurred.** #29 remains a Draft stacked on #30 and should not be retargeted or merged until #30 receives explicit approval and lands.

**Snapshot: 2026-10-24.** Verify the exact head SHA, current GitHub state, CI, Codex reviews and unresolved threads again before any merge. Recommendations below are not merge authorization.

## Executive decision

1. **PR #30 first; shell-only SIGTERM cleanup has now been fixed and CI is green.** A fresh Codex review on the final head and explicit owner approval are the remaining merge gates. The installer still touches untrusted npm config, credential handling and connectivity for every generated app. It is not a blanket security certification.
2. **PR #29 second; do not merge yet.** It is stacked on #30, remains Draft and changes subprocess lifetime/shutdown semantics. After #30 is merged, retarget/rebase #29 on `main`, rerun CI and protocol E2E on the integrated base, inspect unresolved discussion threads and obtain explicit owner approval for the exact updated head.
3. Neither approval nor merging of #30 authorizes merging #29 or #34. `main` is unchanged at the snapshot.

## Side-by-side

| Decision input | PR #30 | PR #29 |
| --- | --- | --- |
| Link | [#30 — npm registry HTTPS](https://github.com/Bendako/next-starter-script/pull/30) | [#29 — MCP stdio protocol and E2E](https://github.com/Bendako/next-starter-script/pull/29) |
| Head | `8775191a52cbbcfa249f9afa6e0de1720731d0e6` | `1171e4cc3928f0842985aaa6d71d35add2ddbac9` |
| Base | `main` | `cursor/https-registry-check-731d` (PR #30 head) |
| Draft | No | Yes |
| Diff versus current PR base | 3 files (script, SIGTERM regression, CI workflow); inspect fresh GitHub diff for final line counts | 9 files, +987/−13 |
| Risk class | Sensitive: installer, proxy, untrusted npm config, credentials | Sensitive: process groups, shutdown, filesystem execution, CI workflow |
| Latest green CI | [40116733115](https://github.com/Bendako/next-starter-script/actions/runs/40116733115) | [40113803016](https://github.com/Bendako/next-starter-script/actions/runs/40113803016) |
| Protocol E2E | Not separately run on #30 alone | [40113803055](https://github.com/Bendako/next-starter-script/actions/runs/40113803055) |
| Codex reviewed exact SHA | Review requested on new head; pending at update | Yes; latest review says no major findings |
| Unresolved historical discussion | Previously open reviewer concerns now documented and resolved; verify no new findings | 5 current threads including process-shutdown concerns |
| Recommendation | **Conditional go once latest Codex clears and owner approves exact head** | **Hold, integrate and revalidate** |

## PR #30 — from ICMP probe to safe npm registry reachability

**Before:** An ordinary `ping` to a fixed public host could fail through firewalls/proxies or return false confidence for private registries; earlier registry handling risked curl option injection and printing credentials.

**After:** The Bash generator resolves npm's configured registry, including project/user config where npm can disclose it safely; uses a time-bounded HTTP(S) `/-/ping` request, treats any nonzero HTTP status (including 401) as proof of network reachability rather than authorization, and has bounded `npm ping` fallback. The URL is validated, passed to curl via stdin-config rather than shell interpolation or a URL-as-option argv; output masks userinfo even when passwords contain `@`. A local Python stub exercises offline and credential cases.

**Impact:** Every CLI/MCP generation attempt executes this prerequisite; improves enterprise/private-registry compatibility and removes a plausible data-exfiltration path. One changed file but broad blast radius.

**Residual risks:**
- A 401/403 response proves host reachability only, not that a package install can authenticate or that dependencies can be fetched. No real private-registry integration test or all-proxy test was established in this memo.
- The SIGTERM orphan risk was addressed: global EXIT cleanup reaps the Python test server and both self-test temp directories, preserving the original exit code. A deterministic subprocess stand-in regression runs on Linux/macOS and the final CI matrix passed. Remaining caveat: the regression specifically covers shell-only SIGTERM, not every possible termination mode (e.g., SIGKILL).
- Existing implementation still has platform-specific network and proxy edge cases; no blanket compatibility guarantee.
- If the npm registry URL is protected, fallback uses npm itself instead of independently parsing secrets. This changes how failures surface.
- Earlier intermediate CI failures were corrected; the **latest head** CI passes. Do not infer failures apply to the current commit.

**Rollback:** Revert #30's merge commit or squash commit if connectivity regresses; run Bash `--test` and `dry-run` against private and public npm registry configurations first. Rollback reintroduces the original network/reachability and hardening defects; prefer a targeted fix when possible. No schema migration.

**Owner decision required:** The known SIGTERM cleanup problem has been fixed and the full CI matrix passed. Wait for Codex on the exact latest SHA and any new findings, then request explicit approval to merge PR #30. No permission to merge #29 is implied.

## PR #29 — MCP stdio E2E and subprocess lifecycle

**Before:** MCP checks centered on unit/schema behavior and did not fully exercise a real client-server stdio session, generated templates, or descendant cleanup when the connection closed.

**After:** Adds actual MCP initialize/tools/list/tools/call protocol checks; negative tests for invalid input, injection and path escape; timeout, stdin close, SIGHUP and process-group teardown; and a separate QA suite that generates minimal, default and full Next.js templates, then runs lint, TypeScript and build. CI uploads QA artifacts on failure, cancels superseded runs, scopes workflow permissions to read-only and isolates validation environments from inherited secrets.

**Impact:** Nine files changed; modifies runtime process management, signal handling, CLI script-path configuration and CI workflows. Improves reliability and test coverage but changes failure/shutdown behavior for all local stdio MCP clients.

**Residual risks and boundaries:**
- **Stacked on PR #30.** Cannot treat green status against that feature branch as final green status against `main`; merge base first, retarget/rebase, retest.
- 5 current unresolved review threads at snapshot (some comments refer to earlier revisions): subprocess shutdown, SIGHUP handler testing, failure artifacts, test isolation, and pending async tasks. Verify fixes in source and close/comment threads with explicit evidence.
- Protocol and generated-app QA ran on Ubuntu, not macOS. Windows descendant tree cleanup remains unsupported.
- All generated templates use `skipConvex` and `skipClerk`. A successful build does **not** validate those third-party integrations, OAuth or hosted sandbox functionality.
- QA builds add external package downloads, compute time and potential flaky network behavior. 30-minute workflow budget, local resources and artifact retention should be monitored.
- Newly configurable `NEXT_STARTER_MCP_SCRIPT_PATH` must remain local/trusted; never expose to untrusted MCP tool arguments.

**Rollback:** Revert the merge commit (or squash) if MCP clients stop launching, signal behavior regresses or CI becomes unstable. Preserve process diagnostic logs; old behavior may leave orphan subprocesses. No database migration.

**Owner decision:** **Do not approve merge yet.** Once #30 is in main and #29 is rebased, rerun `ci/mcp`, `qa/mcp`, CI and Codex on exact integrated head, review open comments, then request explicit owner approval.

## Risks compared and alternatives

| Risk | #30 | #29 |
| --- | --- | --- |
| Confidentiality | Previously vulnerable registry parsing; now hardened, remaining unknown proxy setups | Validation test env now allowlisted; uncontrolled script logs and command paths still deserve review |
| Integrity | Every generator's network prerequisite changes | Runtime process tree/signal semantics change |
| Availability | 5-second registry timeout, possible false-negative for slow/private registry | Timeout and shutdown can terminate long-running child tasks; CI could be slow/flaky |
| Compatibility | Bash 3.2/macOS CI smoke self-test exists; enterprise mirrors not comprehensively proven | Ubuntu QA only; Windows not supported, macOS protocol suite not run |
| Merge dependency | First | Only after #30 integrated |
| Alternative | Defer or narrow to option-injection fix if private-registry compat breaks | Merge tests-only separately from process-lifecycle changes, or postpone until integration E2E matures |

**Evidence quality:** CI and CodeQL are not security proofs; latest Codex receipts report *no major new findings*, not closure of all review threads. Ratings such as "8.5/10" are engineering judgement, not machine-measured readiness.

**Current recommendation:** **#30: conditional yes after fresh Codex review and explicit owner approval of SHA `8775191a`. #29: no, not yet.** Both are sensitive and need separate approvals under policy.
