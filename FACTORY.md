# Software factory

This is the single source of truth for factory operation in this repository. These
rules govern the required process; they do not claim that automation is installed
or that GitHub protection settings have been verified. AGENTS.md and
docs/MERGE_POLICY.md defer to this document.

## Roles and flow

- The product bot writes GitHub issues with scope and acceptance criteria.
- Codex is the coding agent and writes code. Each task uses its own git worktree
  and branch, stays scoped, and opens a draft PR linked to the issue.
- The independent reviewer bot reviews every PR before it can be merged; drafts
  are reviewed on request and may lack a review (the Watchdog reports a missing
  review on a draft as N/A). A PR must be non-draft before merge. Reviewer
  findings automatically return to the coding agent for fixes and re-review, for
  at most three fix/review rounds. Unresolved findings after round three escalate to the human owner;
  automation stops pending a decision.
- The human owner approves Tier 3 PRs on the specific PR and exact current head
  SHA after review, evidence and findings disposition, and may say stop on any
  Tier 2 notice. A changed head or material scope requires fresh checks, review
  and tier evaluation.
- The release bot follows the three-tier merge policy below and always uses a
  squash merge locked to the reviewed head SHA. Never bypass branch protection.
  Deployments require explicit owner approval; production deploys are Tier 3.

## Three-tier merge policy

- **Tier 1 — auto-merge without asking:** docs-only, tests-only, typo/text fixes,
  and only a patch-level semver bump of an EXISTING dependency where only the
  manifest/lockfile version changes: no new package, no install-script change,
  and no registry change. The release bot merges; the owner gets one line in the
  daily summary.
- **Tier 2 — auto-merge after notice:** regular features and bug fixes. Notify the
  owner; the release bot merges after 12 hours unless the owner says stop.
- **Tier 1 and 2 preconditions:** the PR is non-draft; the independent reviewer
  bot's latest verdict on the exact current head is `ready`, interpreted using
  the verdict rules in FACTORY.md; all required checks, including `ci/mcp` and
  `qa/mcp`, are green; no sensitive category is touched; and squash merge is
  locked to the reviewed head SHA. All other merge gates also apply.
- **Tier 3 — always explicit owner approval on the exact head SHA:** any sensitive
  category (auth, payments, secrets, CI permissions, installer/network, subprocess
  lifecycle, sandbox, security controls), production deploys, database
  schema/migration changes, and PRs over 400 changed lines, excluding lockfiles
  and generated files from that line count. Sensitive categories also include
  authorization, OAuth, token validation, credentials, billing/entitlements,
  filesystem isolation, command invocation, input-trust boundaries, user
  data/privacy, destructive changes, supply chain/build/install behavior,
  externally exposed endpoints, policy/rulesets, and production infrastructure.
  GitHub workflow changes (triggers, secrets, `pull_request_target`, deploy steps,
  and new workflows) are explicitly sensitive. Security hardening is sensitive.
  Policy-bearing files are Tier 3: AGENTS.md, FACTORY.md, docs/MERGE_POLICY.md,
  the merge section of CONTRIBUTING.md, and mcp-server/FACTORY_WATCHDOG.md.
  Every dependency or build change outside the Tier 1 dependency carve-out is
  Tier 3, including any lockfile change beyond that carve-out.
- Grok Bot proposes the tier and the reviewer (סוקר) confirms it; on disagreement,
  the higher tier wins.
- Tier 3 criteria override Tier 1 and 2 descriptions, including docs-only changes.
- When in doubt whether a sensitive category applies, it is Tier 3. A new push
  after review resets the tier evaluation, checks and review; renew Tier 2 notice
  and any required Tier 3 approval for the new head. Dependencies never authorize
  an indirect merge.

## Evidence and merge gates

Every PR body must contain an **Evidence** section listing the exact commands run
and working directories for lint, typecheck, tests and build, as applicable. Give
pass/fail counts for each command (check counts when no test counts exist), and
identify skipped, unavailable or inapplicable checks with reasons. Include
screenshots for UI changes. Never describe unrun checks as passing.

Require `ci/mcp` and `qa/mcp` on `main`, plus all other applicable required checks
(including CI and CodeQL). Verify actual enforcement in GitHub separately; workflow
files alone do not configure protection. Checks and required completed reviews
must match the exact current head.
The independent reviewer bot must return `ready` under the rules below; any
Codex review used as evidence must also match that head. Missing, skipped, cancelled,
stale or unconfigured required checks do not pass.

For the independent reviewer, the latest timestamped verdict on the same head
wins, including COMMENT-only re-reviews: `changes needed` then `ready` is PASS;
the reverse is FAIL, regardless of array order. Formal approvals count; a
dismissal alone is UNVERIFIED. Empty, null or whitespace-only COMMENT bodies carry
no verdict and are ignored, preserving any earlier same-head verdict. A latest
non-empty comment without a recognized verdict is UNVERIFIED, even after a
blocker. Tied latest timestamps or invalid current-head evidence are UNVERIFIED.

Inspect every open review thread. Unresolved P0/P1, security or correctness
findings block merge; document disposition, risk and follow-up for other findings.
Verify compatibility, deployment effects and rollback feasibility. Attach a
decision packet to every PR before merge: purpose, risk, exact SHA, check/review
links and recommendation. Sensitive changes require the detailed Hebrew-language
packet described in [the merge policy](docs/MERGE_POLICY.md), including benefits,
unresolved findings, confidence, dependencies, rollout/rollback and alternatives.
For stacked PRs, integrate the base first and revalidate the resulting head;
history rewrites still require owner confirmation.

Follow the security and verification guidance in [AGENTS.md](AGENTS.md): test
success and denial paths for generator/MCP/transport changes, cross-user access
for hosted/auth changes, and typecheck/build selected generated templates before
claiming readiness. Local CI does not prove hosted deployment readiness. Keep the
legacy `web-app/` generation and checkout disabled until its documented auth,
Prisma and billing defects are fixed.

## Identity and approval boundaries

Author commits as `Factory Watchdog Bot <factory-watchdog@users.noreply.github.com>`.
Never put the owner's personal name or email in commits, trailers, PR titles or
bodies. Use clean squash messages without any `Co-authored-by` trailer naming
the owner. Follow the conventional commit prefixes in [CONTRIBUTING.md](CONTRIBUTING.md).

Secrets/keys, paid plans, permission changes and branch-protection changes
require explicit owner approval. Deployments require explicit owner approval;
production deploys always require Tier 3 approval. Never force-push or rewrite
history without owner confirmation. Keep an audit trail of tier, SHA, evidence,
review, notice/approval and merge result; plan containment and follow-up for
post-merge failures.

## Factory Watchdog: implemented scope

The [Watchdog pilot](mcp-server/FACTORY_WATCHDOG.md) and
[workflow](.github/workflows/factory-watchdog.yml) collect read-only GitHub facts
on manual dispatch or a daily schedule. Reports contain stage status, exact SHA,
timestamps, evidence and collection gaps; artifacts are retained for seven days.
Configure the independent reviewer through `FACTORY_REVIEWER_LOGIN`; missing or
ambiguous evidence is UNVERIFIED, and a stage PASS never proves the full loop.
Never expose tokens in commands, reports or committed files.

The current Watchdog does not implement the automatic three-round repair loop,
merge, deploy, post comments or change settings. Its three-Codex-events-per-head
cap is a separate diagnostic, not the repair-round limit. End-to-end canary and
hosted execution evidence remain necessary; this document installs no automation.

## Known conflicts

None.
