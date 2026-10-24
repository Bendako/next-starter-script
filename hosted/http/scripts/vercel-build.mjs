import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildCommand(env) {
  const optedIn = env.NEXT_STARTER_CONVEX_DEPLOY === '1' && env.VERCEL === '1' && env.CONVEX_DEPLOY_KEY;
  if (optedIn) {
    return { cmd: 'npx', args: ['convex', 'deploy', '--cmd', 'npm run build'] };
  }
  return { cmd: 'npm', args: ['run', 'build'] };
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const { cmd, args } = buildCommand(process.env);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  process.exit(result.status ?? 1);
}
