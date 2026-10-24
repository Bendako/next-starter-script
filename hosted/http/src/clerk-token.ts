import { verifyClerkToken } from '@clerk/mcp-tools/next';
import { isClerkAuthInfo } from '@clerk/mcp-tools/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import type { AuthInfo } from '@modelcontextprotocol/server';

type Authenticate = typeof clerkAuth;

export async function verifyHostedMcpToken(
  request: Request,
  token: string | undefined,
  authenticate: Authenticate = clerkAuth,
): Promise<AuthInfo | undefined> {
  void request;
  if (!token) return undefined;
  try {
    const clerkAuthResult = await authenticate({ acceptsToken: 'oauth_token' });
    const info = verifyClerkToken(clerkAuthResult, token);
    if (!isClerkAuthInfo(info)) return undefined;
    return info;
  } catch {
    return undefined;
  }
}
