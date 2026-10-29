import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collect, pages, parseVerdict, pilot, report, type Get } from './factory-watchdog-github.js';
const at = '2026-10-24T12:00:00Z';
const url = `https://github.com/${pilot}/pull/1`;
const head = 'a'.repeat(40);
const review = (body: string | null, time = at, login = 'independent-reviewer') => ({ html_url: url, submitted_at: time,
  commit_id: head, state: 'COMMENTED', body, user: { login } });
function api(overrides: Record<string, unknown> = {}): Get {
  const fixtures: Record<string, unknown> = {
    '/issues': [{ number: 32, title: '[Grokbot handoff] sample', html_url: 'issue:32', created_at: at,
      labels: [{ name: 'grokbot:accepted' }], assignees: [{ login: 'engineer' }] }],
    '/issues/32/events': [{ event: 'labeled', created_at: at, label: { name: 'grokbot:accepted' } }],
    '/issues/32/comments': [{ html_url: 'comment:1', created_at: at, body: 'working', user: { login: 'engineer' } }],
    '/pulls': [{ number: 1, html_url: url, draft: false, created_at: at, head: { sha: head }, base: { ref: 'main' } }],
    [`/commits/${head}/check-runs`]: { check_runs: ['ci/mcp', 'qa/mcp'].map(name => ({ name, head_sha: head,
      html_url: url, started_at: at, completed_at: at, status: 'completed', conclusion: 'success' })) },
    [`/commits/${head}/statuses`]: [],
    '/pulls/1': { number: 1, html_url: url, draft: false, created_at: at, head: { sha: head }, base: { ref: 'main' } },
    '/actions/runs': { workflow_runs: [] },
    '/pulls/1/reviews': [review('Verdict: changes needed'), review('Verdict: ready', '2026-10-24T12:10:00Z')],
    '/issues/1/timeline': [{ event: 'ready_for_review', created_at: at }],
    '/rules/branches/main': [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'ci/mcp' }, { context: 'qa/mcp' }] } }],
    ...overrides,
  };
  return async path => {
    assert.ok(path.startsWith(`/repos/${pilot}/`));
    const value = fixtures[path.replace(`/repos/${pilot}`, '').split('?')[0]];
    if (value instanceof Error) throw value;
    assert.notEqual(value, undefined, path);
    return value;
  };
}
test('strict verdict parser accepts case/whitespace and rejects prose, missing prefix and conflicts', () => {
  for (const body of ['Verdict: ready', '  VERDICT : READY  \r\n\nDetails']) assert.equal(parseVerdict(body), 'approved');
  assert.equal(parseVerdict('Verdict: changes needed'), 'changes_needed');
  for (const body of [null, 'ready', 'Verdict: unknown', 'Verdict: not ready', 'Verdict: ready eventually',
    'Verdict: ready\nVerdict: changes needed', '> Verdict: ready', 'text Verdict: ready']) assert.equal(parseVerdict(body), undefined);
});
test('collector maps trusted current-head reviews and produces factual report with timing', async () => {
  const c = await collect(api(), '2026-10-24T13:00:00Z', 'independent-reviewer');
  const r = report(c);
  assert.equal(r.stages.find(s => s.stage === 'reviewer')?.status, 'PASS');
  assert.equal(r.stages.find(s => s.stage === 'ci/mcp')?.status, 'PASS');
  assert.equal(c.timings[0].acknowledgeMinutes, 0);
  assert.match(r.markdown, /exact head push time unavailable/);
  assert.equal(r.failed, false);
});
test('unknown verdict never passes, including an explicit unknown on a formal approval', async () => {
  for (const state of ['COMMENTED', 'APPROVED', 'UNKNOWN']) {
    const c = await collect(api({ '/pulls/1/reviews': [{ ...review('Verdict: unknown'), state }] }), '2026-10-24T13:00:00Z', 'independent-reviewer');
    assert.equal(report(c).stages.find(s => s.stage === 'reviewer')?.status, 'UNVERIFIED');
  }
});
test('wrong identity, missing configuration, old head and unknown bodies cannot establish approval', async () => {
  for (const rows of [[review('Verdict: ready', at, 'stranger')], [{ ...review('Verdict: ready'), commit_id: 'old' }], [review('hello')]]) {
    const c = await collect(api({ '/pulls/1/reviews': rows }), '2026-10-24T13:00:00Z', 'independent-reviewer');
    assert.notEqual(report(c).stages.find(s => s.stage === 'reviewer')?.status, 'PASS');
  }
  const c = await collect(api(), '2026-10-24T13:00:00Z', '');
  assert.equal(report(c).stages.find(s => s.stage === 'reviewer')?.status, 'UNVERIFIED');
});
test('denied or malformed reads preserve uncertainty and do not abort unrelated collection', async () => {
  for (const bad of [new Error('403'), {}]) {
    const c = await collect(api({ '/rules/branches/main': bad, '/pulls/1/reviews': bad }), '2026-10-24T13:00:00Z', 'independent-reviewer');
    const r = report(c);
    assert.equal(r.stages.find(s => s.stage === 'merge-gate')?.status, 'UNVERIFIED');
    assert.equal(r.stages.find(s => s.stage === 'reviewer')?.status, 'UNVERIFIED');
    assert.ok(c.gaps.length >= 2);
  }
});
test('all pages are collected and a later denied page rejects the whole read', async () => {
  let count = 0;
  assert.equal((await pages(async () => ++count === 1 ? Array(100).fill({}) : [{}], '/items')).length, 101);
  count = 0;
  await assert.rejects(pages(async () => { if (++count === 1) return Array(100).fill({}); throw new Error('403'); }, '/items'));
});
test('report fails on factual failures and escapes untrusted markdown', async () => {
  const c = await collect(api({ '/pulls/1/reviews': [review('Verdict: changes needed')] }), '2026-10-24T13:00:00Z', 'independent-reviewer');
  c.gaps.push('<script>|bad\nnext');
  assert.equal(report(c).failed, true);
  assert.doesNotMatch(report(c).markdown, /<script/i);
});

test('head changes during collection discard observed successes', async () => {
  const c = await collect(api({ '/pulls/1': { number: 1, html_url: url, draft: false, created_at: at, head: { sha: 'new' }, base: { ref: 'main' } } }), '2026-10-24T13:00:00Z', 'independent-reviewer');
  for (const stage of ['ci/mcp', 'qa/mcp', 'reviewer']) assert.equal(report(c).stages.find(s => s.stage === stage)?.status, 'UNVERIFIED');
});
test('unknown review state cannot inherit a ready verdict', async () => {
  const c = await collect(api({ '/pulls/1/reviews': [{ ...review('Verdict: ready'), state: 'UNKNOWN' }] }), '2026-10-24T13:00:00Z', 'independent-reviewer');
  assert.equal(report(c).stages.find(s => s.stage === 'reviewer')?.status, 'UNVERIFIED');
});

test('empty reviewer comments on the same head preserve an earlier ready verdict', async () => {
  for (const body of ['', null, ' \r\n\t']) {
    const empty = review(body, '2026-10-24T12:20:00Z');
    for (const [rows, expected] of [
      [[review('Verdict: ready'), empty], 'PASS'],
      [[empty], 'UNVERIFIED'],
      [[review('Verdict: changes needed'), empty], 'FAIL'],
    ] as const) {
      const c = await collect(api({ '/pulls/1/reviews': rows }), '2026-10-24T13:00:00Z', 'independent-reviewer');
      assert.equal(report(c).stages.find(s => s.stage === 'reviewer')?.status, expected);
      assert.equal(c.snapshot.prs[0].reviews?.length, rows.length - 1);
    }
  }
});
