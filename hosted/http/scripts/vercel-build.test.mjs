import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildCommand } from './vercel-build.mjs';

const deploy = { cmd: 'npx', args: ['convex', 'deploy', '--cmd', 'npm run build'] };
const build = { cmd: 'npm', args: ['run', 'build'] };

test('a deploy key alone does not deploy Convex', () => {
  assert.deepEqual(buildCommand({ CONVEX_DEPLOY_KEY: 'set' }), build);
  assert.deepEqual(buildCommand({ CONVEX_DEPLOY_KEY: 'set', VERCEL: '1' }), build);
  assert.deepEqual(
    buildCommand({ CONVEX_DEPLOY_KEY: 'set', NEXT_STARTER_CONVEX_DEPLOY: '1' }),
    build,
  );
});

test('Convex deploy is opt-in and only on Vercel', () => {
  assert.deepEqual(
    buildCommand({
      CONVEX_DEPLOY_KEY: 'set',
      VERCEL: '1',
      NEXT_STARTER_CONVEX_DEPLOY: '1',
    }),
    deploy,
  );
});
