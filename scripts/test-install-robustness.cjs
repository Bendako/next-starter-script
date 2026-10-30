'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const script = path.resolve(__dirname, '../create-next-starter.sh');
const definitions = fs.readFileSync(script, 'utf8').replace(/^main_execution "\$@"$/m, '');
function run(body, env = {}, version) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-regression-'));
  try {
    if (version) {
      fs.writeFileSync(path.join(dir, 'node'), `#!/bin/bash
if [ "\${1:-}" = --version ]; then echo v${version}; else exec '${process.execPath}' "$@"; fi
`, { mode: 0o755 });
      env = { ...env, PATH: dir + ':' + process.env.PATH };
    }
    return spawnSync('bash', ['-c', definitions + '\n' + body], {
      cwd: dir, env: { ...process.env, ...env }, encoding: 'utf8', input: '',
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test('no-TTY menu announces option 1 once and keeps defaults', () => {
  const result = run('parse_arguments regression-app; [[ $SKIP_CLERK = true && $SKIP_CONVEX = true && $VERBOSE = false && $DRY_RUN = false ]]');
  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/Non-interactive session/g) || []).length, 1);
  assert.match(result.stdout, /option 1: Default/);
});
test('name-only run without a TTY states the default, then the Node gate rejects Node 18', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-e2e-'));
  try {
    fs.writeFileSync(path.join(dir, 'node'), `#!/bin/bash
if [ "\${1:-}" = --version ]; then echo v18.20.4; else exec '${process.execPath}' "$@"; fi
`, { mode: 0o755 });
    const result = spawnSync('bash', [script, 'regression-app'], {
      cwd: dir, env: { ...process.env, PATH: dir + ':' + process.env.PATH }, encoding: 'utf8', input: '',
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Non-interactive session \(no TTY\) detected: using the default configuration/);
    assert.match(result.stdout, /Node.js 20.9\+ required by create-next-app 16 \/ Next 16 \(current: v18.20.4\)/);
    assert.equal(fs.existsSync(path.join(dir, 'regression-app')), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
for (const [version, minimum, expected] of [
  ['18.20.4', '20.9', 1], ['20.8.1', '20.9', 1],
  ['20.9.0', '20.9', 0], ['22.0.0', '20.9', 0],
  ['18.20.4', '18', 0], ['20.8.1', '20', 0],
]) {
  test(`Node ${version}, minimum ${minimum}: exit ${expected}`, () => {
    const result = run(`parse_arguments --node-version ${minimum} -- regression-app
npm_registry_reachable() { return 0; }
check_prerequisites`, {}, version);
    assert.equal(result.status, expected, result.stdout + result.stderr);
    if (expected) assert.match(result.stdout, /Node.js 20.9\+ required by create-next-app 16 \/ Next 16 \(current: v/);
  });
}
for (const minimum of ['oops', '20.9.0', '20.', '-1', '20x9']) {
  test(`malformed minimum ${minimum} is rejected clearly`, () => {
    const result = run(`parse_arguments --node-version '${minimum}' -- regression-app`);
    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /Invalid --node-version/);
  });
}

test('the running Node passes the prerequisite gate', () => {
  const result = run('npm_registry_reachable() { return 0; }; check_prerequisites');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
