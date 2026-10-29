import { z } from 'zod';
import { evaluate, type Snapshot, type ReviewFacts, type Stage } from './factory-watchdog.js';

export const pilot = 'Bendako/next-starter-script';
export type Get = (path: string) => Promise<unknown>;
const user = z.object({ login: z.string() });
const record = z.object({ html_url: z.string(), created_at: z.string() });
const comment = record.extend({ body: z.string().nullable(), user });
const review = z.object({ html_url: z.string(), submitted_at: z.string().nullable(), commit_id: z.string(),
  state: z.string(), body: z.string().nullable(), user });
const issue = record.extend({ number: z.number(), title: z.string(), pull_request: z.unknown().optional(),
  labels: z.array(z.object({ name: z.string() })), assignees: z.array(user) });
const pr = z.object({ number: z.number(), html_url: z.string(), draft: z.boolean(), created_at: z.string(),
  head: z.object({ sha: z.string() }), base: z.object({ ref: z.string() }) });
const event = z.object({ event: z.string(), created_at: z.string().optional(), label: z.object({ name: z.string() }).optional() });

/** One explicit standalone verdict line; prose, conflicting lines, and unknown values fail closed. */
export function parseVerdict(body: string | null): ReviewFacts['verdict'] {
  const lines = body?.split(/\r?\n/).filter(line => /^\s*verdict\s*:/i.test(line)) ?? [];
  if (lines.length !== 1) return undefined;
  const value = lines[0].replace(/^\s*verdict\s*:\s*/i, '').trim().toLowerCase();
  if (value === 'ready') return 'approved';
  if (value === 'changes needed') return 'changes_needed';
  return undefined;
}

/** Paginate completely or reject: partial reads must never masquerade as empty results. */
export async function pages(get: Get, path: string, key?: string): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let page = 1; page <= 100; page++) {
    const data = await get(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const rows = z.array(z.unknown()).parse(key ? z.record(z.string(), z.unknown()).parse(data)[key] : data);
    out.push(...rows);
    if (rows.length < 100) return out;
  }
  throw new Error('Pagination limit reached');
}
export interface Collection { snapshot: Snapshot; gaps: string[]; workflows: { url: string; sha: string; status: string; conclusion: string | null }[]; timings: { issue: string; acknowledgeMinutes?: number }[] }
export async function collect(get: Get, fetchedAt: string, reviewerLogin: string): Promise<Collection> {
  const root = `/repos/${pilot}`;
  const gaps: string[] = [];
  async function read<T>(path: string, parse: (rows: unknown[]) => T, key?: string): Promise<T | undefined> {
    try { return parse(await pages(get, root + path, key)); }
    catch { gaps.push(`Unreadable or malformed: ${path}`); return undefined; }
  }
  const snapshot: Snapshot = { fetchedAt, issues: [], prs: [], rulesetReadable: false };
  const timings: Collection['timings'] = [];
  const workflows: Collection['workflows'] = [];
  const issues = await read('/issues?state=open', rows => z.array(issue).parse(rows));
  for (const i of issues ?? []) {
    if (i.pull_request || !(i.title.startsWith('[Grokbot handoff]') || i.labels.some(l => l.name.startsWith('grokbot')))) continue;
    const events = await read(`/issues/${i.number}/events`, rows => z.array(event).parse(rows));
    const comments = await read(`/issues/${i.number}/comments`, rows => z.array(comment).parse(rows));
    const ack = events?.filter(e => e.event === 'labeled' && e.label?.name === 'grokbot:accepted')
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))[0];
    const response = comments?.filter(c => i.assignees.some(a => a.login === c.user.login))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    snapshot.issues.push({ url: i.html_url,
      acknowledged: ack?.created_at ? { evidenceUrl: i.html_url, at: ack.created_at } : undefined,
      engineerResponse: response ? { evidenceUrl: response.html_url, at: response.created_at } : undefined });
    const minutes = ack?.created_at ? (Date.parse(ack.created_at) - Date.parse(i.created_at)) / 60000 : NaN;
    timings.push({ issue: i.html_url, ...(Number.isFinite(minutes) && minutes >= 0 ? { acknowledgeMinutes: minutes } : {}) });
  }
  const prs = await read('/pulls?state=open', rows => z.array(pr).parse(rows));
  for (const p of prs ?? []) {
    const checks = await read(`/commits/${p.head.sha}/check-runs`, rows => z.array(z.object({ name: z.string(), head_sha: z.string(),
      html_url: z.string().nullable(), started_at: z.string().nullable(), completed_at: z.string().nullable(), status: z.string(), conclusion: z.string().nullable() })).parse(rows), 'check_runs');
    const statuses = await read(`/commits/${p.head.sha}/statuses`, rows => z.array(z.object({ context: z.string(), sha: z.string(),
      target_url: z.string().nullable(), updated_at: z.string(), state: z.string() })).parse(rows));
    const runs = await read(`/actions/runs?head_sha=${p.head.sha}`, rows => z.array(z.object({ html_url: z.string(), head_sha: z.string(), status: z.string(), conclusion: z.string().nullable() })).parse(rows), 'workflow_runs');
    for (const run of runs ?? []) workflows.push({ url: run.html_url, sha: run.head_sha, status: run.status, conclusion: run.conclusion });
    const reviews = await read(`/pulls/${p.number}/reviews`, rows => z.array(review).parse(rows));
    const timeline = await read(`/issues/${p.number}/timeline`, rows => z.array(event).parse(rows));
    const ready = timeline?.filter(e => e.event === 'ready_for_review').sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0];
    // REST commit dates and PR updated_at are not push times. Leave unknown rather than fabricate a deadline.
    gaps.push(`PR ${p.number}: exact head push time unavailable; missing-check/review deadlines remain unverified.`);
    const mapped: ReviewFacts[] = [];
    for (const r of reviews ?? []) {
      const kind = reviewerLogin && r.user.login === reviewerLogin ? 'reviewer'
        : r.user.login === 'chatgpt-codex-connector[bot]' ? 'codex' : undefined;
      if (!kind) continue;
      const states: Record<string, ReviewFacts['result'] | undefined> = { APPROVED: 'approved', CHANGES_REQUESTED: 'changes_requested', COMMENTED: 'commented', DISMISSED: 'dismissed' };
      const result = states[r.state];
      // Empty reviewer comments carry no verdict and do not supersede earlier reviews.
      if (kind === 'reviewer' && result === 'commented' && !r.body?.trim()) continue;
      // Unknown review states and malformed verdicts are represented as unverified comments.
      const verdict = result && result !== 'dismissed' ? parseVerdict(r.body) : undefined;
      mapped.push({ kind, sha: r.commit_id, result: !verdict && /(?:^|\n)\s*verdict\s*:/i.test(r.body ?? '') ? 'commented' : result ?? 'commented', verdict,
        evidenceUrl: r.html_url, at: r.submitted_at ?? '' });
    }
    try {
      const current = pr.parse(await get(`${root}/pulls/${p.number}`));
      if (current.head.sha !== p.head.sha) throw new Error('Head changed');
    } catch {
      gaps.push(`PR ${p.number}: head could not be confirmed after collection.`);
      snapshot.prs.push({ url: p.html_url, head: { sha: p.head.sha, pushedAt: '' }, draft: p.draft, mcpApplicable: true });
      continue;
    }
    if (!reviewerLogin && reviews) mapped.push({ kind: 'reviewer', sha: p.head.sha, result: 'commented', at: '' });
    snapshot.prs.push({ url: p.html_url, head: { sha: p.head.sha, pushedAt: '' }, draft: p.draft,
      readyAt: ready?.created_at, mcpApplicable: true,
      checks: checks && statuses ? [
        ...checks.map(c => ({ name: c.name, head_sha: c.head_sha, evidenceUrl: c.html_url ?? undefined,
          at: c.completed_at ?? c.started_at ?? '', result: checkResult(c.status === 'completed' ? c.conclusion : 'pending') })),
        ...statuses.map(c => ({ name: c.context, head_sha: c.sha, evidenceUrl: c.target_url ?? undefined,
          at: c.updated_at, result: checkResult(c.state) })),
      ] : undefined, reviews: reviews ? mapped : undefined });
    if (!reviewerLogin) gaps.push('Independent reviewer identity is not configured; reviews are unverified.');
  }
  // Effective branch rules endpoint evaluates active rulesets and branch targeting.
  const rules = await read('/rules/branches/main', rows => z.array(z.object({ type: z.string(), parameters: z.object({
    required_status_checks: z.array(z.object({ context: z.string() })).optional(),
  }).optional() })).parse(rows));
  if (rules) {
    snapshot.rulesetReadable = true;
    snapshot.requiredChecks = rules.filter(r => r.type === 'required_status_checks').flatMap(r => r.parameters?.required_status_checks?.map(c => c.context) ?? []);
    snapshot.rulesetEvidence = { evidenceUrl: `https://github.com/${pilot}/rules`, at: fetchedAt };
  }
  return { snapshot, gaps, timings, workflows };
}
function checkResult(value: string | null): 'success' | 'failure' | 'cancelled' | 'pending' | 'skipped' {
  if (value === 'success' || value === 'cancelled' || value === 'pending') return value;
  if (['failure', 'error', 'timed_out', 'action_required', 'startup_failure'].includes(value ?? '')) return 'failure';
  return 'skipped';
}
export function report(collection: Collection): { stages: Stage[]; markdown: string; failed: boolean } {
  const stages = evaluate(collection.snapshot);
  if (collection.gaps.length) stages.push({ subject: 'collection', stage: 'collection', status: 'UNVERIFIED', owner: 'engineer', next: 'Resolve the collection gaps listed below.' });
  const escape = (v: string | undefined) => (v ?? '').replace(/[&<>|\r\n`]/g, c => `&#${c.charCodeAt(0)};`);
  const markdown = ['# Factory health (factual pilot)', '', 'Stage PASS does not establish overall readiness or a verified full factory loop.', '',
    '| Subject | Stage | Status | SHA | Time | Evidence | Owner / next action |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...stages.map(s => `| ${[s.subject, s.stage, s.status, s.sha, s.at, s.evidenceUrl, `${s.owner}: ${s.next ?? ''}`].map(escape).join(' | ')} |`),
    '', '## Collection gaps', ...collection.gaps.map(g => `- ${escape(g)}`), '', '## Workflow observations', ...collection.workflows.map(w => `- ${escape(w.url)} SHA ${escape(w.sha)}: ${escape(w.status)} / ${escape(w.conclusion ?? 'pending')}`), '', '## Issue acknowledgment timing',
    ...collection.timings.map(t => `- ${escape(t.issue)}: ${t.acknowledgeMinutes ?? 'UNVERIFIED'} minutes`)].join('\n');
  return { stages, markdown, failed: stages.some(s => s.status === 'FAIL') };
}
