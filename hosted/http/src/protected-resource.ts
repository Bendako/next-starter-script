import { corsHeaders, generateClerkProtectedResourceMetadata } from '@clerk/mcp-tools/server';

export const OAUTH_RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource/mcp';

export const CLERK_OAUTH_SCOPES = ['openid', 'profile', 'email'] as const;

const METADATA_MARKER = '/.well-known/oauth-protected-resource';

export function metadataRequestUrl(request: Request): string {
  const current = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.trim();
  if (!host) return request.url;
  const proto = forwardedProto || current.protocol.replace(/:$/, '');
  return `${proto}://${host}${current.pathname}${current.search}`;
}

export function resourceUrlForMetadata(requestUrl: string): string {
  const url = new URL(requestUrl);
  const index = url.pathname.indexOf(METADATA_MARKER);
  const suffix = index === -1 ? '' : url.pathname.slice(index + METADATA_MARKER.length).replace(/\/$/, '');
  if (suffix === '') return url.origin;
  return `${url.origin}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

export function publishableKeyForIssuer(issuerHost: string): string {
  const encoded = Buffer.from(`${issuerHost}$`).toString('base64url');
  return `pk_test_${encoded}`;
}

export function protectedResourceResponse(request: Request, publishableKey: string | undefined): Response {
  if (!publishableKey) {
    return Response.json(
      { error: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set' },
      { status: 500, headers: { ...corsHeaders } },
    );
  }
  try {
    const metadata = generateClerkProtectedResourceMetadata({
      publishableKey,
      resourceUrl: resourceUrlForMetadata(metadataRequestUrl(request)),
      properties: { scopes_supported: [...CLERK_OAUTH_SCOPES] },
    });
    return Response.json(metadata, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'max-age=3600',
      },
    });
  } catch {
    return Response.json(
      { error: 'Clerk publishable key could not be read' },
      { status: 500, headers: { ...corsHeaders } },
    );
  }
}
