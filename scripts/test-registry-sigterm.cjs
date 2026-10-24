'use strict';

// Reproduction for an interrupted "create-next-starter.sh --test":
// sending SIGTERM to the *shell only* must stop its Python registry stub
// and remove the stub and ping temporary directories.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../create-next-starter.sh');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(file) {
  try { await fs.access(file); return true; }
  catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function poll(predicate, ms = 12000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(40);
  }
  return Boolean(await predicate());
}

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

test('SIGTERM reaps Python registry stub and cleans mktemp directories', { timeout: 30000 }, async () => {
  let realPython;
  try { realPython = execFileSync('which', ['python3'], { encoding: 'utf8' }).trim(); }
  catch { return; } // self-test skips stub checks when Python is not installed
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'registry-sigterm-'));
  const tmp = path.join(root, 'tmp');
  const bin = path.join(root, 'bin');
  const pidfile = path.join(root, 'stub.pid');
  const debugFile = path.join(root, 'stub-debug.log');
  const portPointer = path.join(root, 'stub-port-pointer.txt');
  const tempRecord = path.join(root, 'temp-directories.txt');
  const realMktemp = execFileSync('which', ['mktemp'], { encoding: 'utf8' }).trim();
  await Promise.all([fs.mkdir(tmp), fs.mkdir(bin)]);
  const pyShim = path.join(bin, 'python3');
  const mktempShim = path.join(bin, 'mktemp');
  await fs.writeFile(
    mktempShim,
    '#!/bin/sh\nout=$("$REGISTRY_TEST_MKTEMP" "$@") || exit $?\nprintf "%s\\n" "$out" >> "$REGISTRY_TEST_TMP_RECORD"\nprintf "%s\\n" "$out"\n',
    { mode: 0o755 },
  );
  await fs.writeFile(
    pyShim,
    '#!/bin/sh\nprintf "%s\\n" "$$" > "$REGISTRY_TEST_PID_FILE"\nprintf "%s\\n" "$2" > "$REGISTRY_TEST_PORT_POINTER"\nprintf "Python: %s\\n" "$REGISTRY_TEST_PYTHON" >> "$REGISTRY_TEST_DEBUG_FILE"\nexec "$REGISTRY_TEST_PYTHON" "$@" 2>> "$REGISTRY_TEST_DEBUG_FILE"\n',
    { mode: 0o755 },
  );

  const child = spawn('bash', [SCRIPT, '--test'], {
    cwd: root,
    env: {
      ...process.env,
      TMPDIR: tmp,
      TMP: tmp,
      NODE_DISABLE_COMPILE_CACHE: '1',
      PATH: bin + path.delimiter + process.env.PATH,
      REGISTRY_TEST_PID_FILE: pidfile,
      REGISTRY_TEST_PORT_POINTER: portPointer,
      REGISTRY_TEST_MKTEMP: realMktemp,
      REGISTRY_TEST_TMP_RECORD: tempRecord,
      REGISTRY_TEST_DEBUG_FILE: debugFile,
      REGISTRY_TEST_PYTHON: realPython,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (chunk) => { out += chunk.toString(); });
  child.stderr.on('data', (chunk) => { out += chunk.toString(); });

  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  let stubPid;
  try {
    const ready = await poll(async () => {
      if (!(await exists(pidfile))) return false;
      const entry = Number((await fs.readFile(pidfile, 'utf8')).trim());
      if (!Number.isSafeInteger(entry) || entry <= 0 || !alive(entry)) return false;
      if (!(await exists(portPointer))) return false;
      const portfile = (await fs.readFile(portPointer, 'utf8')).trim();
      if (!portfile || !(await exists(portfile))) return false;
      stubPid = entry;
      return true;
    });
    if (!ready) {
      const diagnostics = await fs.readFile(debugFile, 'utf8').catch(() => '(no Python wrapper diagnostic)');
      const locations = await fs.readFile(tempRecord, 'utf8').catch(() => '(no recorded temp directories)');
      assert.fail('local Python registry stub did not start\n' + out +
        '\nPython wrapper: ' + diagnostics + '\nCreated temp dirs: ' + JSON.stringify(locations));
    }
    assert.ok(stubPid > 0);

    // Do not signal the process group: the test must reproduce SIGTERM to
    // just the Bash parent, which previously orphaned the Python stub.
    child.kill('SIGTERM');
    const result = await Promise.race([
      closed,
      sleep(5000).then(() => { throw new Error('shell failed to stop after SIGTERM'); }),
    ]);
    assert.notEqual(result.code, 0, 'shell should stop with an interrupted status');

    assert.equal(
      await poll(() => !alive(stubPid), 2500),
      true,
      'Python registry server was orphaned after shell-only SIGTERM',
    );
    const createdDirs = (await fs.readFile(tempRecord, 'utf8'))
      .split('\n').map((item) => item.trim()).filter(Boolean);
    assert.ok(createdDirs.length >= 2, 'expected self-test to create stub and ping directories');
    for (const dir of createdDirs) {
      assert.equal(await exists(dir), false, 'self-test temporary directory leaked: ' + dir);
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await Promise.race([closed.catch(() => undefined), sleep(2000)]);
    if (stubPid && alive(stubPid)) {
      try { process.kill(stubPid, 'SIGKILL'); } catch { /* already exited */ }
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});
