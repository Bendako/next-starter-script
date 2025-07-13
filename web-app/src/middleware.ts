import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

// Temporary middleware for testing without Clerk authentication
export default function middleware(req: NextRequest) {
  // For now, allow all requests to pass through for testing
  // TODO: Re-enable Clerk authentication once proper keys are configured
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}; 