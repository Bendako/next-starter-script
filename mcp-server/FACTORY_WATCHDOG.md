# Factory Watchdog pilot (PR 2)

For #32, `factory-watchdog.ts` retains the offline evaluator from PR #45.
`factory-watchdog-github.ts` adds a validated, paginated REST collector and report.
`factory-watchdog-run.ts` writes `watchdog-output/health.json`, `health.md`, and
the Actions summary. A factual FAIL fails the job; collection gaps are explicitly
UNVERIFIED. Stage PASS never asserts overall readiness or a verified full loop.

## Execution

The workflow supports manual dispatch and one daily run on standard runners,
restricted to `Bendako/next-starter-script`. Permissions are read-only and checkout
credentials are not persisted. The existing ephemeral `GITHUB_TOKEN` is used;
there are no new secrets or paid services. Set the non-secret repository variable
`FACTORY_REVIEWER_LOGIN` to the authenticated independent-review account. Missing
configuration leaves that stage UNVERIFIED. Never infer identity from PR authors
or from text mentioning a reviewer.

Run `npm ci`, `npm run lint`, `npm test`, and `npm run build` in both `mcp-server`
and `hosted` with npm 10.9.8. To collect locally from `mcp-server`, supply an existing
read-only token through the environment, set `GITHUB_REPOSITORY` to the pilot,
and run `npx tsx src/factory-watchdog-run.ts`. Never put tokens in commands,
reports, fixtures, or committed files. Only GET requests to fixed pilot REST paths
are made, with timeouts and redirects rejected. Partial pages and malformed or
denied reads cannot masquerade as empty results. Artifacts contain normalized
facts, not tokens, review prose or raw job logs; retention is seven days.

A newly added workflow may not support dispatch until GitHub knows it on the
default branch. Local fixtures do not prove a hosted dispatch. Do not merge this
draft just to enable dispatch.

## Verdict rule and evidence

The latest timestamped independent-reviewer verdict on the same head wins,
including COMMENT-only re-reviews: `changes needed` then `ready` is PASS; the
reverse is FAIL. Array order has no effect. Formal approvals also count, while
a dismissal alone is UNVERIFIED. Codex remains separate, retaining PR 1's formal
resolution rule for blockers and three-events-per-head storm cap. Empty-body
independent-reviewer COMMENT records (including null or whitespace-only bodies) carry no verdict and are ignored, preserving any earlier same-head verdict.
Any latest nonempty comment without a recognized verdict is UNVERIFIED, including
after a blocker.
Tied latest timestamps and invalid current-head evidence are UNVERIFIED.

The parser requires exactly one standalone `Verdict: ready` or
`Verdict: changes needed` line, ignoring case and surrounding whitespace. Missing
prefixes, unknown values, multiple verdict lines, quoted lines and extra prose
on the verdict line are rejected. Prose on other lines is allowed. Only GitHub
review records from the configured identity or exact Codex bot are mapped.
Ordinary issue comments cannot prove review or head SHA. Unknown review states
and unparseable explicit verdicts cannot PASS even on an otherwise approved
record. Missing, blank or non-string evidence URLs count as no evidence and do
not crash the evaluator.

Only current-head checks/reviews count. The head is confirmed again after
collection; changed/unreadable heads discard observed successes. Check runs and
commit statuses are separate observations. Cancelled checks are STALE;
skipped/unknown checks are UNVERIFIED. Pending age uses the check timestamp.
Plain CI green never proves review or genuine protocol E2E.

Open handoff/grokbot issues use timestamped acceptance label events and the
latest comment from a currently assigned engineer. Time-to-acknowledge is
reported when both times are known; no assignee leaves response UNVERIFIED.
Response deadlines are not invented. Workflow runs have separate status,
conclusion, URL and SHA observations. Failed-check links lead to diagnostics;
raw job logs are not copied because they may contain sensitive data.

Effective required checks are read from `/rules/branches/main`; denied access
is UNVERIFIED. This reports main's enforced check requirements, not complete
merge eligibility or protection on every stacked branch. REST commit dates and
PR update times do not prove head push time. That time remains unknown with an
explicit collection gap: observed current-head checks can be evaluated, but
missing-check/review deadlines needing that time remain UNVERIFIED.
Ready-for-review events come from the timeline.

## Limits and follow-up

Fixtures cover parsing, comment-only reversals, wrong heads/identities, malformed
and denied reads, pagination, head changes, failed reports, missing evidence,
unknown verdicts and PR 1 scenarios. Real dispatch and canary evidence remain
separate from fixtures. Comment reporting, commands, deduplicated three-attempt
repair loops, canary creation and rollout beyond the pilot require separately
approved work. This workflow never merges, deploys, posts comments or changes
settings. It adds no second hourly poller.
