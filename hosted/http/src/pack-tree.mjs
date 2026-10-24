import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EXCLUDED = new Set(['node_modules', '.next', '.git']);

export const ZIP_BYTE_CAP = 32 * 1024 * 1024;

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

export function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = Buffer.from(file.data);
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    locals.push(local);
    centrals.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
  return Buffer.concat([...locals, central, end]);
}

function leafName(relativePath) {
  return relativePath.split('/').at(-1) ?? relativePath;
}

function excluded(relativePath) {
  if (relativePath.split('/').some((part) => EXCLUDED.has(part))) return true;
  const leaf = leafName(relativePath);
  return leaf.startsWith('.env') && leaf !== '.env.example';
}

async function collect(root, relative, files, state) {
  const absolute = path.join(root, relative);
  const info = await lstat(absolute);
  if (info.isSymbolicLink()) return;
  if (info.isDirectory()) {
    if (relative && excluded(relative)) return;
    const entries = await readdir(absolute);
    for (const entry of entries) {
      await collect(root, relative ? `${relative}/${entry}` : entry, files, state);
    }
    return;
  }
  if (!info.isFile() || excluded(relative)) return;
  const data = await readFile(absolute);
  if (state.bytes + data.length > state.cap) {
    throw new Error('Archive exceeds the size cap');
  }
  state.bytes += data.length;
  files.push({ name: relative, data });
}

function projectName(value) {
  if (!value || value.includes('/') || value.includes('\\') || value === '.' || value === '..') {
    throw new Error('Project path must be a single directory name');
  }
  return value;
}

function byteCap(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return ZIP_BYTE_CAP;
  return parsed;
}

export async function packProject(root, name, destination, maxBytes = ZIP_BYTE_CAP) {
  const project = projectName(name);
  const files = [];
  await collect(path.join(root, project), '', files, { bytes: 0, cap: maxBytes });
  const named = files
    .filter((file) => file.name !== '')
    .map((file) => ({
      name: `${project}/${file.name}`,
      data: file.data,
    }));
  await writeFile(destination, zipStore(named));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const name = process.argv[2];
  const destination = process.argv[3];
  if (!name || !destination) {
    process.stderr.write('usage: node pack-tree.mjs <project-name> <zip-out>\n');
    process.exit(1);
  }
  await packProject(process.cwd(), name, destination, byteCap(process.env.PACK_TREE_MAX_BYTES));
}
