# Software factory

This is the single source of truth for factory operation in this repository. These
rules govern the required process; they do not claim that automation is installed
or that GitHub protection settings have been verified. Conflicting legacy clauses
are recorded below and do not authorize exceptions.

## Roles and flow

- The product bot writes GitHub issues with scope and acceptance criteria.
- Codex is the coding agent and writes code. Each task uses its own git worktree
  and branch, stays scoped, and opens a draft PR linked to the issue.
- The independent reviewer bot reviews every PR. Reviewer findings automatically
  return to the coding agent for fixes and re-review, for at most three fix/review
  rounds. Unresolved findings after round three escalate to the human owner;
  automation stops pending a decision.
- The human owner approves the specific PR and exact current head SHA after
  review, evidence and findings disposition. A changed head or material scope
  requires fresh checks, review and approval.
- The release bot squash-merges only after explicit owner approval and all merge
  gates pass; it deploys only after explicit owner approval of the deployment.
  Mark the PR ready before merge. Never bypass branch protection.

## Evidence and merge gates

Every PR body must contain an **Evidence** section listing the exact commands run
and working directories for lint, typecheck, tests and build, as applicable. Give
pass/fail counts for each command (check counts when no test counts exist), and
identify skipped, unavailable or inapplicable checks with reasons. Include
screenshots for UI changes. Never describe unrun checks as passing.

Require `ci/mcp` and `qa/mcp` on `main`, plus all other applicable required checks
(including CI and CodeQL). Verify actual enforcement in GitHub separately; workflow
files alone do not configure protection. Checks and completed Codex and independent
reviewer reviews must match the exact current head. Missing, skipped, cancelled,
stale or unconfigured required checks do not pass.

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

Merges, deploys, secrets/keys, paid plans, permission changes and branch-protection
changes always require explicit owner approval. Standing or delegated authority
does not replace approval of an individual merge. Never force-push or rewrite
history without owner confirmation. Keep an audit trail of SHA, evidence, review,
approval and merge result; plan containment and follow-up for post-merge failures.

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

Line references below refer to the preserved files after adding the AGENTS.md pointer.
Explicit owner approval for every merge and mandatory squash merge take precedence.

- `AGENTS.md:25`: “Low-risk **routine** PRs may be merged under the repository
  owner's standing authorization” conflicts with per-merge approval.
- `docs/MERGE_POLICY.md:7`: “**Routine change (eligible for delegated merge):**”
  conflicts with per-merge approval.
- `docs/MERGE_POLICY.md:25`: “Delegated auto-merge may occur **only for routine
  changes** that satisfy every gate” conflicts with per-merge approval.
- `docs/MERGE_POLICY.md:41`: “human approval is not required if all gates pass.”
  conflicts with per-merge approval.
- `docs/MERGE_POLICY.md:45`: “routine PRs may be merged without further per-PR
  permission after the gates pass.” conflicts with per-merge approval.
- `CONTRIBUTING.md:183`: “Squash commits if requested” makes squashing optional;
  the factory requires squash merge.
