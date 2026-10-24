export type ToolAuthorization =
  | { allowed: true }
  | { allowed: false; status: 403 | 429; message: string };

export type AuthInfo = {
  sub?: string;
};

export type ToolAuthInput = {
  request: Request;
  env: NodeJS.ProcessEnv;
  tool: string;
  args: unknown;
  authInfo?: AuthInfo;
};

export type DeploymentKind = 'local-dev' | 'localhost' | 'preview' | 'production' | 'self-hosted';

export const MCP_CLOSED = 'MCP stays closed until authentication is enabled.';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const RATE_LIMIT = 60;
export const RATE_WINDOW_MS = 60_000;

export type RateBucket = { start: number; count: number };

const rateStore = new Map<string, RateBucket>();

function hostnameOf(request: Request): string {
  try {
    return new URL(request.url).hostname;
  } catch {
    return '';
  }
}

function onVercel(env: NodeJS.ProcessEnv): boolean {
  return env.VERCEL === '1';
}

export function deploymentKind(env: NodeJS.ProcessEnv, request: Request): DeploymentKind {
  if (env.VERCEL_ENV === 'production') return 'production';
  if (env.VERCEL_ENV === 'preview') return 'preview';
  if (onVercel(env) && env.VERCEL_ENV !== 'development') return 'self-hosted';
  if (env.NODE_ENV !== 'production') return 'local-dev';
  if (!onVercel(env) && LOOPBACK.has(hostnameOf(request))) return 'localhost';
  return 'self-hosted';
}

export function deploymentOpen(kind: DeploymentKind): boolean {
  return kind === 'local-dev' || kind === 'localhost';
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

export function callerKey(request: Request, authInfo?: AuthInfo): string {
  const sub = authInfo?.sub?.trim();
  if (sub) return `id:${sub}`;
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return `ip:${real}`;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const last = forwarded
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .at(-1);
    if (last) return `ip:${last}`;
  }
  return 'ip:unknown';
}

export function takeCallBudget(
  store: Map<string, RateBucket>,
  key: string,
  now: number,
  limit = RATE_LIMIT,
  windowMs = RATE_WINDOW_MS,
): boolean {
  const current = store.get(key);
  if (!current || now - current.start >= windowMs) {
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
  if (!deploymentOpen(deploymentKind(input.env, input.request))) {
    return { allowed: false, status: 403, message: MCP_CLOSED };
  }
  const store = input.store ?? rateStore;
  const allowed = takeCallBudget(
    store,
    callerKey(input.request, input.authInfo),
    input.now ?? Date.now(),
    input.limit,
  );
  if (!allowed) return { allowed: false, status: 429, message: 'Too many requests.' };
  return { allowed: true };
}

export function identityAllows(input: ToolAuthInput): boolean {
  void input.tool;
  void input.args;
  void input.authInfo;
  return true;
}

export function authorizeToolCall(input: ToolAuthInput): ToolAuthorization {
  if (!deploymentOpen(deploymentKind(input.env, input.request))) {
    return { allowed: false, status: 403, message: MCP_CLOSED };
  }
  if (!identityAllows(input)) {
    return { allowed: false, status: 403, message: MCP_CLOSED };
  }
  return { allowed: true };
}
