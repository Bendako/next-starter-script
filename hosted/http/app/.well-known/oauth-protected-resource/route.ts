import { metadataCorsOptionsRequestHandler } from '@clerk/mcp-tools/next';
import { envValue } from '../../../src/env';
import { protectedResourceResponse } from '../../../src/protected-resource';

export const dynamic = 'force-dynamic';

const corsHandler = metadataCorsOptionsRequestHandler();

export function GET(request: Request): Response {
  return protectedResourceResponse(request, envValue('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'));
}

export { corsHandler as OPTIONS };
