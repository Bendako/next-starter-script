# Pull request merge policy

Policy proposed on 2026-10-24. **Effective for the repository only after this policy PR is reviewed and merged into `main`.** The repository owner's chat authorization is not a substitute for GitHub Rulesets, checks, or verified approval. A bot must never bypass required checks or required reviewers.

## 1. Classification

**Routine change (eligible for delegated merge):** scoped docs, tests, refactoring, or low-risk behavior changes with no access-control, billing, credentials, subprocess lifecycle, external API exposure, sandbox security, persistent data migration, or deployment-permission implications.

**Sensitive change (requires explicit owner approval for the exact PR/head):** authentication, authorization, OAuth, token validation, secrets, payments and entitlements, filesystem/sandbox isolation, command invocation and process lifetime, input-trust boundaries, user data/privacy, security controls, destructive changes, supply chain/build/install behavior, externally exposed endpoints, CI permissions, policy/rulesets, migrations, and production infrastructure. When in doubt, classify as sensitive. #29 and #30 are sensitive.

A security-hardening change is still *sensitive*, even when it reduces risk. Dependencies between PRs never authorize a sensitive PR to be merged indirectly.

## 2. Universal merge gates

Before **any** merge:

1. Confirm the PR is not a Draft, targets the correct branch, and is mergeable; verify the exact current head SHA. For stacked PRs, merge the base first, retarget/rebase, and rerun all checks on the integrated head.
2. All required GitHub status checks must have passed on that head (including E2E, QA, and CodeQL where applicable). A passing run on an obsolete commit does not qualify. Missing, skipped, cancelled, stale, or unconfigured required checks are not equivalent to passing.
3. Require a completed **Codex review on the exact head SHA**, with no unresolved blocker. If Codex reports an unavailable environment or cannot review, do **not** treat the review as complete; seek human review rather than auto-merge.
4. Inspect *all* open review threads. Unresolved P0/P1, security, or correctness concerns block merging. For lower-priority issues, document the remaining risk, mitigation/owner, and whether follow-up is required; do not silently dismiss comments. A bot saying "no new findings" does not automatically invalidate older review concerns.
5. Run appropriate build, typecheck, tests, negative/security tests and end-to-end flows for touched subsystems; specify environment limitations. Cross-account access tests are required for auth/hosted changes.
6. Verify compatibility, rollback feasibility, no credential disclosure, and deployment side effects. For high-risk rollouts, use staged release/feature flags and monitoring.
7. A precise decision packet (below) must be attached to the PR or linked to it *before* merge.

Delegated auto-merge may occur **only for routine changes** that satisfy every gate, after checking current SHA/status immediately before merging. No PR is eligible solely because a CI status is green. No automatic merge for production-deployment-enabling flags or changes that alter this policy.

## 3. Mandatory decision packet for owner approval

For every **sensitive PR**, before asking the owner to approve a merge, provide a concise Hebrew-language decision brief with:

- PR number, name, link, current head SHA, branch/base, Draft/mergeability, and change size (files, lines) where available.
- Plain-language purpose: problem being solved, before/after behavior, affected users and components, benefits, and consequences of **not** merging.
- Functional and security delta: input validation, auth, subprocess execution, credentials, filesystem operations, external network calls, CI/permissions, tests and generated artifacts as relevant.
- **Risk matrix** (severity/likelihood/impact/blast radius), known unresolved review threads, security/privacy exposure, backward compatibility, reliability/performance/cost, and remaining unknowns.
- Dependencies/stacking: order, conflicts, retarget/rebase required, and whether integration checks must rerun. Never merge stacked PRs directly to a different base while treating their prior checks as sufficient.
- Validation evidence with hyperlinks to **specific** Actions runs (including green CI, E2E, CodeQL), checked SHA, Codex outcome, open findings, untested platforms and credentials. Mark claims as unverified when evidence is missing.
- Deployment/rollout and rollback: feature flags, revert path, migration constraints, operational observability and who responds to errors.
- Alternatives: merge now, fix first, defer, or close; engineering recommendation with conditions, confidence and clear **approve / do-not-approve-yet** conclusion.
- Explicit owner approval for the **specific PR and current head** (or for a well-scoped batch with named exact SHAs). If the head or material scope changes afterwards, revalidate and seek new approval.

For routine PRs, include a shorter packet with purpose, risk class, check links, exact SHA, and recommended merge decision; human approval is not required if all gates pass.

## 4. Decision ownership and enforcement

- Owner-approved policy: routine PRs may be merged without further per-PR permission after the gates pass. Sensitive PRs always require explicit approval.
- An assistant or agent may review, fix and prepare any PR but may not treat approval of the *policy* as approval of an individual sensitive merge.
- Maintain a human-readable audit trail in the PR body/comments (head SHA, evidence, reviewer, decision, approval, merge commit).
- If policy is not yet merged into main, enforce it conversationally and keep the pending policy PR visible. Merge automation requires separate GitHub/agent configuration; committing this document does not install an always-on bot.
- A post-merge failure triggers a rollback/containment plan and incident follow-up; never roll back destructive migrations without a data recovery plan.

## 5. Example assessment

See [PR #29 and #30 merge decision memo](./PR_29_30_MERGE_ASSESSMENT_2026-10-24.md) for the required detail level and outstanding conditions.
