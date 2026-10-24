import type { AuthConfig } from 'convex/server';

function clerkIssuer(): string {
  const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;
  if (!issuer) {
    throw new Error('CLERK_JWT_ISSUER_DOMAIN is not set');
  }
  return issuer;
}

export default {
  providers: [
    {
      domain: clerkIssuer(),
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig;
