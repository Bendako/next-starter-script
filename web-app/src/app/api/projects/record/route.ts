import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { recordProjectGeneration } from '@/lib/subscription';

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name, template } = body as Record<string, unknown>;
    if (
      typeof name !== 'string' || name.trim().length === 0 || name.length > 214 ||
      typeof template !== 'string' || template.trim().length === 0 || template.length > 100
    ) {
      return NextResponse.json({ error: 'Invalid name or template' }, { status: 400 });
    }

    // Never use the userId supplied in a request body.
    await recordProjectGeneration({
      userId,
      name,
      template,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording project generation:', error);
    return NextResponse.json({ error: 'Failed to record project' }, { status: 500 });
  }
}
