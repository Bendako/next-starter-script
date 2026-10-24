import { chmod, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const httpRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(httpRoot, '..', '..', 'create-next-starter.sh');
const vendor = path.join(httpRoot, 'vendor');
await mkdir(vendor, { recursive: true });
const target = path.join(vendor, 'create-next-starter.sh');
await copyFile(source, target);
await chmod(target, 0o755);
