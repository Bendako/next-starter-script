# Pull request merge policy

[FACTORY.md](../FACTORY.md) is the source of truth for this policy, including
independent reviewer verdict rules. Never bypass required checks, required
reviewers or branch protection. This document does not install automation.

## 1. Three-tier merge policy

- **Tier 1 — auto-merge without asking:** docs-only, tests-only, typo/text fixes,
  and only a patch-level semver bump of an EXISTING dependency where only the
  manifest/lockfile version changes: no new package, no install-script change,
  and no registry change. Patch-level bumps of authentication, cryptography, or
  Convex packages are excluded from this carve-out and are Tier 3. The release
  bot merges; the owner gets one line in the daily summary.
- **Tier 2 — auto-merge after notice:** regular features and bug fixes. Notify the
  owner; the release bot merges after 12 hours unless the owner says stop.
- **Tier 1 and 2 preconditions:** the PR is non-draft; the independent reviewer
  bot's latest verdict on the exact current head is `ready`, interpreted using
  the verdict rules in FACTORY.md; all required checks, including `ci/mcp` and
  `qa/mcp`, are green; no sensitive category is touched; and squash merge is
  locked to the reviewed head SHA. Codex review (`@codex review`) is optional
  and advisory for Tier 1 and 2; only the reviewer (סוקר) `ready` verdict and
  green checks are required review/check gates. All other merge gates also apply.
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
  Tier 3, including any lockfile change beyond that carve-out. Codex review
  (`@codex review`) is a mandatory gate only for Tier 3 PRs and must match the
  exact current head SHA when required or used as evidence.
- Grok Bot proposes the tier and the reviewer (סוקר) confirms it; on disagreement,
  the higher tier wins.
- Tier 3 criteria override Tier 1 and 2 descriptions, including docs-only changes.
- When in doubt whether a sensitive category applies, it is Tier 3. A new push
  after review resets the tier evaluation, checks and review; renew Tier 2 notice
  and any required Tier 3 approval for the new head. Dependencies never authorize
  an indirect merge.

PR #29 and PR #30 are Tier 3.

## 2. Universal merge gates

Before **any** merge:

1. Confirm the PR is not a Draft, targets the correct branch, and is mergeable; verify the exact current head SHA. For stacked PRs, merge the base first, retarget/rebase, and rerun all checks on the integrated head.
2. All required GitHub status checks must have passed on that head (including `ci/mcp`, `qa/mcp`, E2E and CodeQL where applicable). A passing run on an obsolete commit does not qualify. Missing, skipped, cancelled, stale, or unconfigured required checks are not equivalent to passing.
3. Require the independent reviewer bot's latest verdict on the exact current head to be `ready`, using the timestamp, COMMENT-only, empty-body and UNVERIFIED rules in [FACTORY.md](../FACTORY.md). Codex review (`@codex review`) is required only for Tier 3 PRs and is advisory for Tier 1 and 2; when required or used as evidence, it must match that exact head; unavailable or incomplete review evidence cannot count as passing.
4. Inspect *all* open review threads. Unresolved P0/P1, security, or correctness concerns block merging. For lower-priority issues, document the remaining risk, mitigation/owner, and whether follow-up is required; do not silently dismiss comments. A bot saying "no new findings" does not automatically invalidate older review concerns.
5. Run appropriate build, typecheck, tests, negative/security tests and end-to-end flows for touched subsystems; specify environment limitations. Cross-account access tests are required for auth/hosted changes.
6. Verify compatibility, rollback feasibility, no credential disclosure, and deployment side effects. For high-risk rollouts, use staged release/feature flags and monitoring.
7. A precise decision packet (below) must be attached to the PR or linked to it *before* merge.

Immediately before merging, recheck the current head, tier, checks and reviews.
Always squash merge locked to the reviewed head SHA. No PR qualifies solely
because CI is green.

## 3. Mandatory decision packet for owner approval

For every **Tier 3 PR**, before asking the owner to approve a merge, provide a concise decision brief (English when posted on GitHub, Hebrew when delivered to the owner in chat) with:

- PR number, name, link, current head SHA, branch/base, Draft/mergeability, and change size (files, lines) where available.
- Plain-language purpose: problem being solved, before/after behavior, affected users and components, benefits, and consequences of **not** merging.
- Functional and security delta: input validation, auth, subprocess execution, credentials, filesystem operations, external network calls, CI/permissions, tests and generated artifacts as relevant.
- **Risk matrix** (severity/likelihood/impact/blast radius), known unresolved review threads, security/privacy exposure, backward compatibility, reliability/performance/cost, and remaining unknowns.
- Dependencies/stacking: order, conflicts, retarget/rebase required, and whether integration checks must rerun. Never merge stacked PRs directly to a different base while treating their prior checks as sufficient.
- Validation evidence with hyperlinks to **specific** Actions runs (including green CI, E2E, CodeQL), checked SHA, independent reviewer verdict, Codex outcome where available, open findings, untested platforms and credentials. Mark claims as unverified when evidence is missing.
- Deployment/rollout and rollback: feature flags, revert path, migration constraints, operational observability and who responds to errors.
- Alternatives: merge now, fix first, defer, or close; engineering recommendation with conditions, confidence and clear **approve / do-not-approve-yet** conclusion.
- Explicit owner approval for the **specific PR and current head** (or for a well-scoped batch with named exact SHAs). If the head or material scope changes afterwards, revalidate and seek new approval.

For Tier 1 and 2 PRs, include a shorter packet with purpose, tier, check/review
links, exact SHA, recommended decision and notice timing where applicable.

All decision packets, PR text, comments, reviews, issues and commit messages on
GitHub are written in English. Hebrew is used only for user-facing display
content, such as a README, where relevant. Chat with the owner, including the
merge brief, stays in Hebrew.

## 4. Decision ownership and enforcement

- The release bot follows the three tiers in FACTORY.md. Tier 3 requires explicit
  owner approval of the specific PR and exact current head SHA.
- An assistant or agent may review, fix and prepare any PR; approval of the policy
  does not approve an individual Tier 3 merge.
- Use the bot commit identity specified in FACTORY.md. Never force-push or rewrite
  history without owner confirmation. Secrets/keys, paid plans, permission changes,
  branch-protection changes and deployments require owner approval; production
  deploys always require Tier 3 approval.
- Maintain a human-readable audit trail in the PR body/comments (head SHA, evidence, reviewer, decision, approval, merge commit).
- Merge automation requires separate GitHub/agent configuration; committing this document does not install an always-on bot.
- A post-merge failure triggers a rollback/containment plan and incident follow-up; never roll back destructive migrations without a data recovery plan.

## 5. Example assessment

See [PR #29 and #30 merge decision memo](./PR_29_30_MERGE_ASSESSMENT_2026-10-24.md) for the required detail level and outstanding conditions.
