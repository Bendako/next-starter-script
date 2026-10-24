import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextMiddleware } from 'next/server';
import { envValue } from './src/env';

let withClerk: NextMiddleware | undefined;

function clerkReady(): boolean {
  return Boolean(envValue('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY') && envValue('CLERK_SECRET_KEY'));
}

const proxy: NextMiddleware = (request, event) => {
  if (!clerkReady()) return NextResponse.next();
  withClerk ??= clerkMiddleware();
  return withClerk(request, event);
};

export default proxy;

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
