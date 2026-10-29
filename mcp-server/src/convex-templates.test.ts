import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.dirname(packageRoot);
let directory: string;

async function generate(clerk: boolean, convex: boolean) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'convex-template-'));
  const source = await fs.readFile(path.join(repoRoot, 'create-next-starter.sh'), 'utf8');
  await fs.writeFile(path.join(root, 'generator.sh'), source.replace(/^main_execution "\$@"$/m, ':'));
  await fs.mkdir(path.join(root, 'src/app'), { recursive: true });
  await fs.mkdir(path.join(root, 'src/lib'), { recursive: true });
  await fs.writeFile(path.join(root, 'tsconfig.json'), '{}');
  await fs.writeFile(path.join(root, 'README.md'), '# Generated test app\n');
  await fs.writeFile(path.join(root, '.gitignore'), '.env*\n');
  const result = spawnSync('bash', ['-c', `
    source ./generator.sh
    trap - EXIT
    SKIP_CLERK=$1
    SKIP_CONVEX=$2
    APP_NAME=permissions-test
    create_env_file
    if [ "$SKIP_CONVEX" = false ]; then create_convex_provider; fi
    if [ "$SKIP_CLERK" = false ]; then create_clerk_middleware; fi
    create_layout_file
    if [ "$SKIP_CONVEX" = false ]; then
      create_convex_schema
      create_convex_functions
      create_convex_config
    fi
    append_project_readme
  `, 'bash', String(!clerk), String(!convex)], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return root;
}

before(async () => {
  directory = await generate(true, true);
  await fs.symlink(path.join(packageRoot, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
  await fs.writeFile(path.join(directory, 'package.json'), '{"type":"module"}');
  await fs.mkdir(path.join(directory, 'convex/_generated'));
  // Schema-bound generic builders are the same public APIs Convex codegen uses.
  await fs.writeFile(path.join(directory, 'convex/_generated/server.ts'), `
    import { queryGeneric, mutationGeneric } from 'convex/server';
    import type { QueryBuilder, MutationBuilder, GenericQueryCtx } from 'convex/server';
    import type { DataModel } from './dataModel';
    export const query: QueryBuilder<DataModel, 'public'> = queryGeneric;
    export const mutation: MutationBuilder<DataModel, 'public'> = mutationGeneric;
    export type QueryCtx = GenericQueryCtx<DataModel>;
  `);
  await fs.writeFile(path.join(directory, 'convex/_generated/dataModel.ts'), `
    import type { DataModelFromSchemaDefinition, DocumentByName } from 'convex/server';
    import schema from '../schema';
    export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
    export type Doc<TableName extends keyof DataModel> = DocumentByName<DataModel, TableName>;
  `);
  const modules = Object.fromEntries(['schema', 'auth', 'users', 'posts', '_generated/server'].map((name) => [
    `./convex/${name}.ts`, () => import(pathToFileURL(path.join(directory, `convex/${name}.ts`)).href),
  ]));
  await modules['./convex/schema.ts']();
});

after(async () => {
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

async function scenario() {
  // Every test gets independent data, even when the test runner shares modules.
  const { default: schema } = await import(pathToFileURL(path.join(directory, 'convex/schema.ts')).href);
  const modules = Object.fromEntries(['schema', 'auth', 'users', 'posts', '_generated/server'].map((name) => [
    `./convex/${name}.ts`, () => import(pathToFileURL(path.join(directory, `convex/${name}.ts`)).href),
  ]));
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: 'user_owner' });
  const other = t.withIdentity({ subject: 'user_other' });
  const ownerId = await owner.mutation(anyApi.users.createUser, { clerkId: 'user_owner', name: 'Owner', email: 'owner@example.invalid' });
  const otherId = await other.mutation(anyApi.users.createUser, { clerkId: 'user_other', name: 'Other', email: 'other@example.invalid' });
  return { t, owner, other, ownerId, otherId };
}

describe('generated Convex permissions', () => {
  test('anonymous callers cannot create or overwrite profiles', async () => {
    const { t, owner, ownerId } = await scenario();
    await assert.rejects(t.mutation(anyApi.users.createUser, { clerkId: 'user_owner', name: 'Unauthorized', email: 'bad@example.invalid' }), /Authentication required/);
    await assert.rejects(t.mutation(anyApi.posts.createPost, { authorId: ownerId, title: 'bad', content: 'bad' }), /Authentication required/);
    assert.equal((await owner.query(anyApi.users.getUserByClerkId, { clerkId: 'user_owner' })).name, 'Owner');
  });

  test('a signed-in caller cannot impersonate a different profile or author', async () => {
    const { owner, other, ownerId } = await scenario();
    await assert.rejects(other.mutation(anyApi.users.createUser, { clerkId: 'user_owner', name: 'Unauthorized', email: 'bad@example.invalid' }), /Not authorized/);
    await assert.rejects(other.mutation(anyApi.posts.createPost, { authorId: ownerId, title: 'bad', content: 'bad' }), /Not authorized/);
    assert.equal((await owner.query(anyApi.users.getUserByClerkId, { clerkId: 'user_owner' })).name, 'Owner');
    assert.deepEqual(await owner.query(anyApi.posts.getPostsByAuthor, { authorId: ownerId }), []);
  });

  test('private profile reads require the matching authenticated subject', async () => {
    const { t, owner, other } = await scenario();
    await assert.rejects(t.query(anyApi.users.getUserByClerkId, { clerkId: 'user_owner' }), /Authentication required/);
    assert.equal(await other.query(anyApi.users.getUserByClerkId, { clerkId: 'user_owner' }), null);
    const own = await owner.query(anyApi.users.getUserByClerkId, { clerkId: 'user_owner' });
    assert.equal(own.email, 'owner@example.invalid');
    assert.equal(own.clerkId, 'user_owner');
  });

  test('owner can update their profile and create drafts; draft defaults stay private', async () => {
    const { t, owner, other, ownerId } = await scenario();
    const updated = await owner.mutation(anyApi.users.createUser, { clerkId: 'user_owner', name: 'Owner updated', email: 'new@example.invalid' });
    assert.equal(updated, ownerId);
    const draftId = await owner.mutation(anyApi.posts.createPost, { authorId: ownerId, title: 'draft', content: 'private' });
    assert.equal(await t.query(anyApi.posts.getPostWithAuthor, { postId: draftId }), null);
    assert.equal(await other.query(anyApi.posts.getPostWithAuthor, { postId: draftId }), null);
    assert.equal((await owner.query(anyApi.posts.getPostWithAuthor, { postId: draftId })).content, 'private');
    assert.deepEqual(await t.query(anyApi.posts.getPostsByAuthor, { authorId: ownerId }), []);
    assert.deepEqual(await other.query(anyApi.posts.getPostsByAuthor, { authorId: ownerId }), []);
    assert.equal((await owner.query(anyApi.posts.getPostsByAuthor, { authorId: ownerId })).length, 1);
  });

  test('public reads expose published posts and public profile fields only', async () => {
    const { t, owner, other, ownerId } = await scenario();
    const postId = await owner.mutation(anyApi.posts.createPost, { authorId: ownerId, title: 'public', content: 'hello', published: true });
    await owner.mutation(anyApi.posts.createPost, { authorId: ownerId, title: 'draft', content: 'secret' });
    for (const caller of [t, other, owner]) {
      const post = await caller.query(anyApi.posts.getPostWithAuthor, { postId });
      assert.deepEqual(Object.keys(post.author).sort(), ['_id', 'name']);
      assert.equal(post.content, 'hello');
    }
    const profiles = await t.query(anyApi.users.getUsers, {});
    for (const profile of profiles) assert.deepEqual(Object.keys(profile).sort(), ['_id', 'name']);
    assert.equal((await t.query(anyApi.posts.getPublishedPosts, {})).length, 1);
    assert.equal((await other.query(anyApi.posts.getPostsByAuthor, { authorId: ownerId })).length, 1);
  });

  test('authenticated users without a profile cannot claim an existing author', async () => {
    const { t, ownerId } = await scenario();
    const stranger = t.withIdentity({ subject: 'user_no_profile' });
    await assert.rejects(stranger.mutation(anyApi.posts.createPost, { authorId: ownerId, title: 'bad', content: 'bad' }), /Not authorized/);
  });

  test('denied profile creation leaves no new profile or post behind', async () => {
    const { t, owner, ownerId } = await scenario();
    const profile = { clerkId: 'user_unclaimed', name: 'Unclaimed', email: 'unclaimed@example.invalid' };
    await assert.rejects(t.mutation(anyApi.users.createUser, profile), /Authentication required/);
    await assert.rejects(owner.mutation(anyApi.users.createUser, profile), /Not authorized/);
    assert.equal(await t.withIdentity({ subject: profile.clerkId }).query(anyApi.users.getUserByClerkId, { clerkId: profile.clerkId }), null);
    assert.deepEqual(await t.query(anyApi.posts.getPublishedPosts, {}), []);
    assert.deepEqual(await owner.query(anyApi.posts.getPostsByAuthor, { authorId: ownerId }), []);
  });

  test('ownership is enforced in both directions, including explicit drafts and deleted profiles', async () => {
    const { t, owner, other, ownerId, otherId } = await scenario();
    for (const [writer, outsider, authorId] of [[owner, other, ownerId], [other, owner, otherId]] as const) {
      const postId = await writer.mutation(anyApi.posts.createPost, { authorId, title: 'private', content: 'private', published: false });
      await assert.rejects(outsider.mutation(anyApi.posts.createPost, { authorId, title: 'forged', content: 'forged', published: true }), /Not authorized/);
      for (const caller of [t, outsider]) {
        assert.equal(await caller.query(anyApi.posts.getPostWithAuthor, { postId }), null);
        assert.deepEqual(await caller.query(anyApi.posts.getPostsByAuthor, { authorId }), []);
        assert.deepEqual(await caller.query(anyApi.posts.getPublishedPosts, {}), []);
      }
      assert.equal((await writer.query(anyApi.posts.getPostWithAuthor, { postId })).content, 'private');
      await t.run(async (ctx) => { await ctx.db.delete(authorId); });
      assert.equal(await writer.query(anyApi.posts.getPostWithAuthor, { postId }), null);
      assert.deepEqual(await writer.query(anyApi.posts.getPostsByAuthor, { authorId }), []);
      await assert.rejects(writer.mutation(anyApi.posts.createPost, { authorId, title: 'orphan', content: '' }), /Not authorized/);
    }
  });

  test('public projections preserve imageUrl but deny private fields for every viewer', async () => {
    const { t, owner, other, ownerId } = await scenario();
    await owner.mutation(anyApi.users.createUser, { clerkId: 'user_owner', name: 'Owner', email: 'private@example.invalid', imageUrl: 'https://example.invalid/avatar.png' });
    const postId = await owner.mutation(anyApi.posts.createPost, { authorId: ownerId, title: 'public', content: '', published: true });
    for (const caller of [t, owner, other]) {
      const profiles = await caller.query(anyApi.users.getUsers, {});
      const profile = profiles.find((entry: { _id: string }) => entry._id === ownerId);
      const post = await caller.query(anyApi.posts.getPostWithAuthor, { postId });
      for (const value of [profile, post.author]) {
        assert.deepEqual(Object.keys(value).sort(), ['_id', 'imageUrl', 'name']);
        assert.equal(value.imageUrl, 'https://example.invalid/avatar.png');
      }
    }
    await t.run(async (ctx) => { await ctx.db.delete(ownerId); });
    assert.equal((await t.query(anyApi.posts.getPostWithAuthor, { postId })).author, null);
  });

  test('a deleted or unknown post returns null', async () => {
    const { t, owner, ownerId } = await scenario();
    const postId = await owner.mutation(anyApi.posts.createPost, { authorId: ownerId, title: 'deleted', content: '' });
    await t.run(async (ctx) => { await ctx.db.delete(postId); });
    assert.equal(await t.query(anyApi.posts.getPostWithAuthor, { postId }), null);
  });

  test('generated backend typechecks against the real Convex schema and API', () => {
    const result = spawnSync(process.execPath, [path.join(packageRoot, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'bundler', 'convex/schema.ts', 'convex/auth.ts', 'convex/users.ts', 'convex/posts.ts', 'convex/auth.config.ts'], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });

  test('backend auth config stays closed without an issuer and accepts only its configured issuer', async () => {
    const configPath = path.join(directory, 'convex/auth.config.ts');
    for (const issuer of ['', 'https://fixture.clerk.accounts.dev']) {
      const result = spawnSync(process.execPath, ['--import', path.join(packageRoot, 'node_modules/tsx/dist/loader.mjs'), '--input-type=module', '-e', `import config from ${JSON.stringify(pathToFileURL(configPath).href)}; console.log(JSON.stringify(config));`], {
        cwd: directory,
        encoding: 'utf8',
        env: { ...process.env, CLERK_JWT_ISSUER_DOMAIN: issuer },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { providers: issuer ? [{ domain: issuer, applicationID: 'convex' }] : [] });
    }
    assert.match(await fs.readFile(path.join(directory, 'README.md'), 'utf8'), /Convex deployment environment/);
  });
});

test('optional Clerk and Convex modes retain safe provider and layout wiring', async () => {
  for (const clerk of [true, false]) {
    for (const convex of [true, false]) {
      const root = await generate(clerk, convex);
      try {
        const layout = await fs.readFile(path.join(root, 'src/app/layout.tsx'), 'utf8');
        if (!convex) {
          assert.doesNotMatch(layout, /ConvexClientProvider/);
          await assert.rejects(fs.access(path.join(root, 'convex')));
          continue;
        }
        const provider = await fs.readFile(path.join(root, 'src/app/ConvexClientProvider.tsx'), 'utf8');
        if (clerk) {
          assert.match(layout, /clerkConfigured=\{clerk.configured\}/);
          assert.match(layout, /if \(clerk.configured\)/);
          assert.match(provider, /if \(!clerkConfigured\) return <ConvexProvider/);
          assert.match(provider, /ConvexProviderWithClerk client=\{convex\} useAuth=\{useAuth\}/);
        } else {
          assert.doesNotMatch(provider, /@clerk|useAuth|ConvexProviderWithClerk/);
          await assert.rejects(fs.access(path.join(root, 'convex/auth.config.ts')));
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  }
});
