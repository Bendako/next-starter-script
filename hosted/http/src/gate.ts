import { isClerkAuthInfo } from '@clerk/mcp-tools/server';
import type { AuthInfo as McpAuthInfo } from '@modelcontextprotocol/server';
import { bindTrustedCaller, type TrustedConvexCaller } from './convex-credential';

export type ToolAuthorization =
  | { allowed: true; clerkUserId?: string; caller?: TrustedConvexCaller }
  | { allowed: false; status: 403 | 429; message: string };

export type AuthInfo = {
  sub?: string;
  clientId?: string;
  token?: string;
  scopes?: string[];
  extra?: Record<string, unknown>;
};

export type ToolAuthInput = {
  request: Request;
  env: NodeJS.ProcessEnv;
  tool: string;
  args: unknown;
  authInfo?: AuthInfo;
};

export const MCP_CLOSED = 'MCP stays closed until authentication is enabled.';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const RATE_LIMIT = 60;
export const RATE_WINDOW_MS = 60_000;
export const RATE_MAP_CAP = 1_000;

export type RateBucket = { start: number; count: number };

const rateStore = new Map<string, RateBucket>();

export function localOpen(env: NodeJS.ProcessEnv): boolean {
  return env.NEXT_STARTER_MCP_ALLOW_LOCAL === '1' && env.VERCEL !== '1';
}

export function originAllowed(request: Request, env: NodeJS.ProcessEnv): boolean {
  const origin = request.headers.get('origin');
  if (origin === null || origin.trim() === '') return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const configured = env.NEXT_STARTER_MCP_ORIGINS?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (configured && configured.length > 0) return configured.includes(origin);
  return LOOPBACK.has(parsed.hostname);
}

export function callerKey(request: Request, authInfo: AuthInfo | undefined, env: NodeJS.ProcessEnv): string {
  const identity = authInfo?.clientId?.trim() || authInfo?.sub?.trim();
  if (identity) return `id:${identity}`;
  if (env.VERCEL === '1') {
    const real = request.headers.get('x-real-ip')?.trim();
    if (real) return `ip:${real}`;
  }
  return 'local';
}

function evictBuckets(store: Map<string, RateBucket>, now: number, windowMs: number, maxKeys: number): void {
  for (const [key, bucket] of store) {
    if (now - bucket.start >= windowMs) store.delete(key);
  }
  if (store.size <= maxKeys) return;
  const oldest = [...store.entries()].sort((left, right) => left[1].start - right[1].start);
  for (const [key] of oldest) {
    if (store.size <= maxKeys) return;
    store.delete(key);
  }
}

export function takeCallBudget(
  store: Map<string, RateBucket>,
  key: string,
  now: number,
  limit = RATE_LIMIT,
  windowMs = RATE_WINDOW_MS,
  maxKeys = RATE_MAP_CAP,
): boolean {
  evictBuckets(store, now, windowMs, maxKeys);
  const current = store.get(key);
  if (!current || now - current.start >= windowMs) {
    if (store.size >= maxKeys) {
      const oldest = [...store.entries()].sort((left, right) => left[1].start - right[1].start)[0];
      if (oldest) store.delete(oldest[0]);
    }
    store.set(key, { start: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function admitHttpRequest(input: {
  request: Request;
  env: NodeJS.ProcessEnv;
  authInfo?: AuthInfo;
  now?: number;
  store?: Map<string, RateBucket>;
  limit?: number;
}): ToolAuthorization {
  if (!originAllowed(input.request, input.env)) {
    return { allowed: false, status: 403, message: 'Origin is not allowed.' };
  }
  if (!localOpen(input.env)) {
    return { allowed: false, status: 403, message: MCP_CLOSED };
  }
  const store = input.store ?? rateStore;
  const allowed = takeCallBudget(
    store,
    callerKey(input.request, input.authInfo, input.env),
    input.now ?? Date.now(),
    input.limit,
  );
  if (!allowed) return { allowed: false, status: 429, message: 'Too many requests.' };
  return { allowed: true };
}

const AUTHENTICATION_REQUIRED = 'Authentication required';

export function clerkUserIdFrom(authInfo: AuthInfo | McpAuthInfo | undefined): string | undefined {
  const candidate = authInfo as McpAuthInfo | undefined;
  if (!candidate || !isClerkAuthInfo(candidate)) return undefined;
  const userId = candidate.extra?.userId;
  if (typeof userId !== 'string' || userId.length === 0) return undefined;
  return userId;
}

// Denies unless the deployment is open and Clerk verified this auth info.
// #15 reads the tool name and arguments for the plan limit.
export function identityAllows(input: ToolAuthInput): boolean {
  void input.tool;
  void input.args;
  void input.request;
  if (!localOpen(input.env)) return false;
  return clerkUserIdFrom(input.authInfo) !== undefined;
}

export function authorizeToolCall(input: ToolAuthInput): ToolAuthorization {
  if (!localOpen(input.env)) {
    return { allowed: false, status: 403, message: MCP_CLOSED };
  }
  if (!identityAllows(input)) {
    return { allowed: false, status: 403, message: AUTHENTICATION_REQUIRED };
  }
  const clerkUserId = clerkUserIdFrom(input.authInfo);
  if (!clerkUserId) {
    return { allowed: false, status: 403, message: AUTHENTICATION_REQUIRED };
  }
  return {
    allowed: true,
    clerkUserId,
    caller: bindTrustedCaller(clerkUserId),
  };
}
