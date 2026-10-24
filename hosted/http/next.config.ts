import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(root, '..', '..'),
  outputFileTracingIncludes: {
    '/mcp': ['./vendor/create-next-starter.sh', './src/pack-tree.mjs'],
  },
  serverExternalPackages: ['@vercel/sandbox'],
};

export default nextConfig;
