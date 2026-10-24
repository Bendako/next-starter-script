import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const healthOk = makeFunctionReference<'query', Record<string, never>, string>('health:ok');

export async function queryConvexHealth(url: string): Promise<unknown> {
  const client = new ConvexHttpClient(url);
  return client.query(healthOk, {});
}

export async function healthForTool(
  tool: string,
  env: NodeJS.ProcessEnv,
  query: (url: string) => Promise<unknown>,
): Promise<string | undefined> {
  if (tool !== 'create_nextjs_app') return undefined;
  try {
    await readConvexHealth(env, query);
    return undefined;
  } catch {
    return 'Convex health query did not return OK';
  }
}

export async function readConvexHealth(
  env: NodeJS.ProcessEnv,
  query: (url: string) => Promise<unknown>,
): Promise<'skipped' | 'OK'> {
  const url = env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) return 'skipped';
  const value = await query(url);
  if (value !== 'OK') {
    throw new Error('Convex health query did not return OK');
  }
  return 'OK';
}
