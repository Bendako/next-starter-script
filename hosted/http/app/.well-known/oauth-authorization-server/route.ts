import { authServerMetadataHandlerClerk, metadataCorsOptionsRequestHandler } from '@clerk/mcp-tools/next';

export const dynamic = 'force-dynamic';

const handler = authServerMetadataHandlerClerk();
const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
