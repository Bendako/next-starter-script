export const CONVEX_SERVER_CREDENTIAL = '_TBD_' as const;

export type ConvexServerCredential = typeof CONVEX_SERVER_CREDENTIAL;

export type TrustedConvexCaller = {
  clerkUserId: string;
  credential: ConvexServerCredential;
};

// The MCP route calls Convex with the verified Clerk user id. The server
// credential is either the Convex deploy key or a separate shared secret.
export function bindTrustedCaller(clerkUserId: string): TrustedConvexCaller {
  return {
    clerkUserId,
    credential: CONVEX_SERVER_CREDENTIAL,
  };
}

export function convexCredentialSelected(caller: TrustedConvexCaller): boolean {
  const credential: string = caller.credential;
  return credential !== CONVEX_SERVER_CREDENTIAL;
}
