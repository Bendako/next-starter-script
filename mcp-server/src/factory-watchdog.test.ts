import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate, type Snapshot } from './factory-watchdog.js';
const at = '2026-10-24T12:00:00Z';
const evidence = { evidenceUrl: 'https://github.com/example/pilot/pull/1', at };
function fixture(): Snapshot {
  return { fetchedAt: '2026-10-24T13:00:00Z',
    issues: [{ url: 'issue:1', acknowledged: evidence, engineerResponse: evidence }],
    prs: [{ url: evidence.evidenceUrl, head: { sha: 'current', pushedAt: at }, draft: false,
      readyAt: at, mcpApplicable: true,
      checks: ['ci/mcp', 'qa/mcp'].map(name => ({ ...evidence, name, head_sha: 'current', result: 'success' })),
      reviews: ['reviewer', 'codex'].map(kind => ({ ...evidence, sha: 'current', kind: kind as 'reviewer' | 'codex', result: 'approved' })),
    }], rulesetReadable: true, requiredChecks: ['ci/mcp', 'qa/mcp'], rulesetEvidence: evidence };
}
const status = (s: Snapshot, stage: string) => evaluate(s).find(r => r.stage === stage)?.status;
test('green fixture has separate evidenced stages and is deterministic without mutation', () => {
  const s = fixture(), before = structuredClone(s), result = evaluate(s);
  assert.equal(result.length, 7);
  assert.ok(result.every(r => r.status === 'PASS' && r.evidenceUrl && r.at));
  assert.equal(result.find(r => r.stage === 'ci/mcp')?.sha, 'current');
  assert.deepEqual(s, before);
  assert.deepEqual(evaluate(s), result);
});
test('failed, cancelled, superseded, pending and skipped checks never pass', () => {
  for (const [result, expected] of [['failure', 'FAIL'], ['cancelled', 'STALE'], ['superseded', 'STALE'], ['pending', 'STALE'], ['skipped', 'UNVERIFIED']] as const) {
    const s = fixture(); s.prs[0].checks![0].result = result;
    assert.equal(status(s, 'ci/mcp'), expected);
    assert.equal(status(s, 'qa/mcp'), 'PASS');
  }
});
test('wrong SHA is stale; newer old success cannot hide current failure', () => {
  const s = fixture(); s.prs[0].checks![0].head_sha = 'old';
  assert.equal(status(s, 'ci/mcp'), 'STALE');
  assert.equal(evaluate(s).find(r => r.stage === 'ci/mcp')?.sha, 'old');
  s.prs[0].checks!.push({ ...evidence, at: '2026-10-24T11:59:00Z', name: 'ci/mcp', head_sha: 'current', result: 'failure' });
  assert.equal(status(s, 'ci/mcp'), 'FAIL');
});
test('latest current-head rerun wins', () => {
  const s = fixture();
  s.prs[0].checks!.push({ ...evidence, at: '2026-10-24T12:30:00Z', name: 'ci/mcp', head_sha: 'current', result: 'failure' });
  assert.equal(status(s, 'ci/mcp'), 'FAIL');
});
test('stacked PR without CI fails after grace; unreadable and rollout differ', () => {
  const s = fixture(); s.prs[0].checks = [];
  assert.equal(status(s, 'ci/mcp'), 'FAIL');
  s.prs[0].head.pushedAt = '2026-10-24T12:50:00Z';
  assert.equal(status(s, 'ci/mcp'), 'UNVERIFIED');
  s.prs[0].checks = undefined;
  assert.equal(status(s, 'ci/mcp'), 'UNVERIFIED');
  s.prs[0].mcpApplicable = false;
  assert.equal(status(s, 'ci/mcp'), 'NOT_APPLICABLE');
});
test('missing non-draft review fails while draft is N/A, independently of CI', () => {
  const s = fixture(); s.prs[0].reviews = [];
  assert.equal(status(s, 'codex'), 'FAIL');
  assert.equal(status(s, 'reviewer'), 'FAIL');
  assert.equal(status(s, 'ci/mcp'), 'PASS');
  s.prs[0].draft = true;
  assert.equal(status(s, 'codex'), 'NOT_APPLICABLE');
});
test('review grace uses later readiness or push; missing timing/access is unverified', () => {
  for (const field of ['ready', 'push']) {
    const s = fixture(); s.prs[0].reviews = [];
    if (field === 'ready') s.prs[0].readyAt = '2026-10-24T12:30:00Z';
    else s.prs[0].head.pushedAt = '2026-10-24T12:30:00Z';
    assert.equal(status(s, 'codex'), 'UNVERIFIED');
  }
  const s = fixture(); s.prs[0].reviews = []; s.prs[0].readyAt = undefined;
  assert.equal(status(s, 'codex'), 'UNVERIFIED');
  s.prs[0].reviews = undefined;
  assert.equal(status(s, 'codex'), 'UNVERIFIED');
});
test('old review never passes, requested changes and review storm fail', () => {
  const s = fixture(); s.prs[0].reviews![1].sha = 'old';
  assert.equal(status(s, 'codex'), 'FAIL');
  s.prs[0].reviews![0].result = 'changes_requested';
  assert.equal(status(s, 'reviewer'), 'FAIL');
  const r = { ...s.prs[0].reviews![1], sha: 'current' };
  s.prs[0].reviews = Array.from({ length: 4 }, () => ({ ...r }));
  assert.equal(status(s, 'codex'), 'FAIL');
  s.prs[0].reviews.pop();
  assert.equal(status(s, 'codex'), 'PASS');
});
test('unreadable or incomplete ruleset is unverified; missing requirements fail', () => {
  const s = fixture(); s.rulesetReadable = false;
  assert.equal(status(s, 'merge-gate'), 'UNVERIFIED');
  s.rulesetReadable = true; s.requiredChecks = [];
  assert.equal(status(s, 'merge-gate'), 'FAIL');
  s.requiredChecks = undefined;
  assert.equal(status(s, 'merge-gate'), 'UNVERIFIED');
});
test('missing evidence and malformed times never produce green', () => {
  const s = fixture(); s.issues[0].acknowledged = undefined;
  s.prs[0].checks![0].at = 'invalid'; s.prs[0].head.pushedAt = '2027-01-01T00:00:00Z';
  assert.equal(status(s, 'acknowledgment'), 'UNVERIFIED');
  assert.equal(status(s, 'ci/mcp'), 'UNVERIFIED');
  s.fetchedAt = 'invalid'; assert.throws(() => evaluate(s), /Invalid/);
});
test('stale independent review is separate from current Codex evidence', () => {
  const s = fixture(); s.prs[0].reviews![0].sha = 'old';
  assert.equal(status(s, 'reviewer'), 'STALE');
  assert.equal(status(s, 'codex'), 'PASS');
});
