import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'vitest';
import { fileURLToPath } from 'node:url';

const packer = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pack-tree.mjs');

describe('pack-tree', () => {
  test('zip excludes node_modules, .next, and .git', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pack-tree-'));
    const name = 'demo-app';
    const project = path.join(root, name);
    try {
      await fs.mkdir(path.join(project, 'src'), { recursive: true });
      await fs.mkdir(path.join(project, 'node_modules', 'left-pad'), { recursive: true });
      await fs.mkdir(path.join(project, '.next'), { recursive: true });
      await fs.mkdir(path.join(project, '.git'), { recursive: true });
      await fs.mkdir(path.join(project, 'src', 'node_modules'), { recursive: true });
      await fs.writeFile(path.join(project, 'package.json'), '{"name":"demo-app"}\n');
      await fs.writeFile(path.join(project, 'src', 'index.ts'), 'export const n = 1;\n');
      await fs.writeFile(path.join(project, 'node_modules', 'left-pad', 'index.js'), 'nope\n');
      await fs.writeFile(path.join(project, '.next', 'cache'), 'nope\n');
      await fs.writeFile(path.join(project, '.git', 'config'), 'nope\n');
      await fs.writeFile(path.join(project, 'src', 'node_modules', 'hidden.js'), 'nope\n');

      const zipPath = path.join(root, 'out.zip');
      const packed = spawnSync(process.execPath, [packer, name, zipPath], {
        cwd: root,
        encoding: 'utf8',
      });
      assert.equal(packed.status, 0, packed.stderr);

      const listed = spawnSync(
        'python3',
        [
          '-c',
          'import zipfile,sys; print("\\n".join(sorted(zipfile.ZipFile(sys.argv[1]).namelist())))',
          zipPath,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(listed.status, 0, listed.stderr);
      assert.deepEqual(listed.stdout.trim().split('\n'), [
        'demo-app/package.json',
        'demo-app/src/index.ts',
      ]);

      const extracted = spawnSync(
        'python3',
        [
          '-c',
          'import sys,zipfile; sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode())',
          zipPath,
          'demo-app/package.json',
        ],
        { encoding: 'utf8' },
      );
      assert.equal(extracted.stdout, '{"name":"demo-app"}\n');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  test('skips symlinks, symlink loops, and .env files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pack-tree-'));
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'pack-secret-'));
    const name = 'demo-app';
    const project = path.join(root, name);
    try {
      await fs.mkdir(project, { recursive: true });
      await fs.writeFile(path.join(project, 'package.json'), '{"name":"demo-app"}\n');
      await fs.writeFile(path.join(project, '.env'), 'SECRET=1\n');
      await fs.writeFile(path.join(project, '.env.local'), 'SECRET=2\n');
      await fs.writeFile(path.join(project, '.env.example'), 'SECRET=\n');
      await fs.writeFile(path.join(outside, 'secret.txt'), 'absolute-secret\n');
      await fs.symlink(path.join(outside, 'secret.txt'), path.join(project, 'linked.txt'));
      await fs.symlink(project, path.join(project, 'loop'));

      const zipPath = path.join(root, 'out.zip');
      const packed = spawnSync(process.execPath, [packer, name, zipPath], {
        cwd: root,
        encoding: 'utf8',
        timeout: 5_000,
      });
      assert.equal(packed.status, 0, packed.stderr);
      const listed = spawnSync(
        'python3',
        [
          '-c',
          'import zipfile,sys; print("\\n".join(sorted(zipfile.ZipFile(sys.argv[1]).namelist())))',
          zipPath,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(listed.status, 0, listed.stderr);
      assert.deepEqual(listed.stdout.trim().split('\n'), [
        'demo-app/.env.example',
        'demo-app/package.json',
      ]);
      const bytes = await fs.readFile(zipPath);
      assert.equal(bytes.includes(Buffer.from('absolute-secret')), false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  test('stops when the archive exceeds the size cap', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pack-tree-'));
    const name = 'demo-app';
    const project = path.join(root, name);
    try {
      await fs.mkdir(project, { recursive: true });
      await fs.writeFile(path.join(project, 'package.json'), '{"name":"demo-app"}\n');
      const zipPath = path.join(root, 'out.zip');
      const packed = spawnSync(process.execPath, [packer, name, zipPath], {
        cwd: root,
        encoding: 'utf8',
        timeout: 5_000,
        env: { ...process.env, PACK_TREE_MAX_BYTES: '4' },
      });
      assert.notEqual(packed.status, 0);
      assert.match(packed.stderr, /size cap/);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
