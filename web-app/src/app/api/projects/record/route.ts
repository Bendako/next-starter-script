import { NextRequest, NextResponse } from 'next/server';
import { recordProjectGeneration } from '@/lib/subscription';

export async function POST(req: NextRequest) {
  try {
    const { userId, name, template, status } = await req.json();
    
    if (!userId || !name || !template) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await recordProjectGeneration({
      userId,
      name,
      template,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording project generation:', error);
    return NextResponse.json(
      { error: 'Failed to record project' },
      { status: 500 }
    );
  }
} 