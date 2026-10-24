import { createHostedMcpHandler } from '../../src/mcp-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const handler = createHostedMcpHandler();

export { handler as GET, handler as POST, handler as DELETE };
