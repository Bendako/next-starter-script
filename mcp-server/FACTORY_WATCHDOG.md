# Factory Watchdog: offline evaluator (PR 1)

Issue #32's first slice exports `evaluate(snapshot, policy)` and fact/report types
from `src/factory-watchdog.ts`. Run fixtures with `npm test` in `mcp-server`.
There is no I/O, clock access, GitHub client, workflow, or runtime registration.

The caller supplies complete observations and `fetchedAt`. Omitted checks or
reviews mean unreadable; empty arrays mean successfully read with no results.
Evidence needs a source URL and timestamp. A future collector must authenticate
review identities before assigning `reviewer` or `codex`. Ordinary comments are
not review evidence. A commented review is unverified unless a trusted collector supplies an explicit
`verdict` (`approved` or `changes_needed`). Blocking feedback persists until a
later formal approval or dismissal; a comment cannot clear it. Stage
PASS never asserts overall readiness or genuine protocol E2E.

Only current-head checks/reviews count. Latest timestamped checks win. Tied latest timestamps are unverified, independent
of input order. Any invalid current-head fact makes its stage unverified instead
of being silently dropped. Stage output includes only declared report fields.
Cancelled/superseded checks are stale; skipped checks are unverified. Pending
checks become stale after the CI grace measured from the check's own time. Missing checks fail after 10 minutes,
including stacked-base PRs. MCP applicability is explicit rollout policy.
Missing non-draft reviews fail 30 minutes after the later of readiness and push;
unknown timing/access is unverified. Drafts without reviews are N/A. More than
three Codex events on one head is a review storm. Thresholds are configurable.

Issue stages record timestamped acknowledgment and engineer responses; missing
evidence is unverified. Response deadlines are not inferred in this slice.
Ruleset facts must represent enforced requirements on the target branch, not
merely configured settings. Missing access, evidence, or required-check data is
unverified; readable evidence missing either MCP requirement fails.

PR 2 adds fact collection, read-only workflow, summary and artifact. Separately
approved work adds comment reporting, command handling, deduplicated repair
loops and an isolated canary. These fixtures do not verify the full factory.
