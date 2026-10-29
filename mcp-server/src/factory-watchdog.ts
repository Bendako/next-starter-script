/** Offline facts only: collectors must supply complete, trusted observations. */
export type StageStatus = 'PASS' | 'FAIL' | 'STALE' | 'UNVERIFIED' | 'NOT_APPLICABLE';
export type StageName = 'acknowledgment' | 'engineer-response' | 'ci/mcp' | 'qa/mcp' | 'reviewer' | 'codex' | 'merge-gate';
export interface Evidence { evidenceUrl: string; at: string }
export interface IssueFacts {
  url: string;
  acknowledged?: Evidence;
  engineerResponse?: Evidence;
}
export interface CheckFacts extends Evidence {
  name: string;
  head_sha: string;
  result: 'success' | 'failure' | 'cancelled' | 'superseded' | 'pending' | 'skipped';
}
export interface ReviewFacts extends Evidence {
  sha: string;
  kind: 'reviewer' | 'codex';
  result: 'approved' | 'changes_requested' | 'commented' | 'dismissed';
  /** Explicit verdict parsed by a trusted collector, never inferred from occurrence. */
  verdict?: 'approved' | 'changes_needed';
}
export interface PrFacts {
  url: string;
  head: { sha: string; pushedAt: string };
  draft: boolean;
  readyAt?: string;
  /** Explicit rollout policy, not inferred from absent checks. */
  mcpApplicable: boolean;
  checks?: CheckFacts[];
  reviews?: ReviewFacts[];
}
export interface Snapshot {
  fetchedAt: string;
  issues: IssueFacts[];
  prs: PrFacts[];
  rulesetReadable: boolean;
  requiredChecks?: string[];
  rulesetEvidence?: Evidence;
}
export interface Policy { ciGraceMinutes: number; reviewGraceMinutes: number; maxCodexReviewsPerSha: number }
export const defaultPolicy: Readonly<Policy> = {
  ciGraceMinutes: 10, reviewGraceMinutes: 30, maxCodexReviewsPerSha: 3,
};
export interface Stage {
  subject: string;
  stage: StageName;
  status: StageStatus;
  evidenceUrl?: string;
  sha?: string;
  at?: string;
  owner: 'engineer' | 'reviewer' | 'owner' | 'grokbot';
  next?: string;
}

/** No clock, I/O, mutation, or overall readiness claim. */
export function evaluate(snapshot: Snapshot, policy: Readonly<Policy> = defaultPolicy): Stage[] {
  const now = Date.parse(snapshot.fetchedAt);
  if (!Number.isFinite(now) || Object.values(policy).some(n => !Number.isFinite(n) || n < 0)) {
    throw new Error('Invalid observation time or policy');
  }
  const age = (at: string) => {
    const time = Date.parse(at);
    return Number.isFinite(time) && time <= now ? (now - time) / 60000 : undefined;
  };
  const valid = (e: Evidence) => Boolean(e.evidenceUrl.trim()) && age(e.at) !== undefined;
  // Ambiguous timestamps cannot establish a unique latest result.
  const latest = <T extends Evidence>(facts: T[]): T | undefined => {
    const readable = facts.filter(valid);
    const time = Math.max(...readable.map(f => Date.parse(f.at)));
    const newest = readable.filter(f => Date.parse(f.at) === time);
    return newest.length === 1 ? newest[0] : undefined;
  };
  const evidenceFields = (e?: Evidence) => e ? { evidenceUrl: e.evidenceUrl, at: e.at } : {};
  const reviewStatus = (reviews: ReviewFacts[]): StageStatus => {
    if (reviews.some(r => !valid(r))) return 'UNVERIFIED';
    const review = latest(reviews);
    if (!review) return 'UNVERIFIED';
    // Only a later formal approval or dismissal clears blocking feedback.
    const blockers = reviews.filter(r => r.result === 'changes_requested'
      || (r.result === 'commented' && r.verdict === 'changes_needed'));
    const resolutions = reviews.filter(r => r.result === 'approved' || r.result === 'dismissed');
    const lastResolution = Math.max(...resolutions.map(r => Date.parse(r.at)));
    if (blockers.some(r => Date.parse(r.at) >= lastResolution)) return 'FAIL';
    if (review.result === 'approved') return 'PASS';
    if (review.result === 'commented' && review.verdict === 'approved') return 'PASS';
    return 'UNVERIFIED';
  };
  const stages: Stage[] = [];
  for (const issue of snapshot.issues) {
    for (const [stage, fact, owner] of [
      ['acknowledgment', issue.acknowledged, 'grokbot'],
      ['engineer-response', issue.engineerResponse, 'engineer'],
    ] as const) {
      stages.push({ subject: issue.url, stage, owner, status: fact && valid(fact) ? 'PASS' : 'UNVERIFIED',
        ...(fact && valid(fact) ? evidenceFields(fact) : { next: 'Collect timestamped stage evidence.' }) });
    }
  }
  for (const pr of snapshot.prs) {
    const add = (stage: StageName, status: StageStatus, owner: Stage['owner'], next?: string, evidence?: Evidence & { sha?: string }) =>
      stages.push({ subject: pr.url, stage, status, owner, sha: pr.head.sha, evidenceUrl: pr.url, next, ...evidenceFields(evidence),
        ...(evidence?.sha ? { sha: evidence.sha } : {}) });
    const headAge = age(pr.head.pushedAt);
    for (const name of ['ci/mcp', 'qa/mcp'] as const) {
      if (!pr.mcpApplicable) { add(name, 'NOT_APPLICABLE', 'engineer'); continue; }
      if (!pr.checks || headAge === undefined) { add(name, 'UNVERIFIED', 'engineer', 'Collect current-head checks and push time.'); continue; }
      const matching = pr.checks.filter(c => c.name === name);
      const currentFacts = matching.filter(c => c.head_sha === pr.head.sha);
      if (currentFacts.some(c => !valid(c)) || (currentFacts.length > 0 && !latest(currentFacts))) {
        add(name, 'UNVERIFIED', 'engineer', 'Resolve invalid or tied current-head check evidence.');
        continue;
      }
      const current = latest(currentFacts);
      if (!current) {
        const old = latest(matching.filter(c => c.head_sha !== pr.head.sha));
        add(name, old ? 'STALE' : headAge > policy.ciGraceMinutes ? 'FAIL' : 'UNVERIFIED', 'engineer',
          'Trigger and inspect CI on the current head, including stacked-base triggers.', old ? { ...old, sha: old.head_sha } : undefined);
      } else {
        const status: StageStatus = current.result === 'success' ? 'PASS' : current.result === 'failure' ? 'FAIL'
          : ['cancelled', 'superseded'].includes(current.result) ? 'STALE'
          : current.result === 'pending' && age(current.at)! > policy.ciGraceMinutes ? 'STALE' : 'UNVERIFIED';
        add(name, status, 'engineer', status === 'PASS' ? undefined : 'Inspect and re-run the current-head check.', current);
      }
    }
    for (const kind of ['reviewer', 'codex'] as const) {
      const all = pr.reviews?.filter(r => r.kind === kind);
      const current = all?.filter(r => r.sha === pr.head.sha);
      const review = latest(current ?? []);
      if (kind === 'codex' && current && current.length > policy.maxCodexReviewsPerSha) {
        add(kind, 'FAIL', 'reviewer', 'Investigate duplicate review triggers.', review);
      } else if (current?.length) {
        const status = reviewStatus(current);
        add(kind, status, 'reviewer', status === 'PASS' ? undefined : 'Resolve review feedback or ambiguous evidence and request a re-check.', review);
      } else if (pr.draft) {
        add(kind, 'NOT_APPLICABLE', 'reviewer');
      } else {
        const readyAge = pr.readyAt ? age(pr.readyAt) : undefined;
        const elapsed = readyAge !== undefined && headAge !== undefined ? Math.min(readyAge, headAge) : undefined;
        const old = latest(all ?? []);
        let status: StageStatus = 'UNVERIFIED';
        if (all && elapsed !== undefined) {
          if (kind === 'reviewer' && old) status = 'STALE';
          else if (elapsed > policy.reviewGraceMinutes) status = 'FAIL';
          else if (old) status = 'STALE';
        }
        add(kind, status, 'reviewer',
          'Verify review evidence on the current head after the readiness/push grace period.', old);
      }
    }
  }
  const gateKnown = snapshot.rulesetReadable && snapshot.requiredChecks !== undefined
    && snapshot.rulesetEvidence && valid(snapshot.rulesetEvidence);
  stages.push({ subject: 'repository', stage: 'merge-gate', owner: 'owner',
    status: !gateKnown ? 'UNVERIFIED' : ['ci/mcp', 'qa/mcp'].every(c => snapshot.requiredChecks?.includes(c)) ? 'PASS' : 'FAIL',
    ...(gateKnown ? evidenceFields(snapshot.rulesetEvidence) : {}), next: 'Verify enforced required checks for the target branch; settings alone do not prove the full factory loop.' });
  return stages;
}
