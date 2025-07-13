import { NextResponse } from 'next/server';
import { checkProjectGenerationLimit } from '@/lib/subscription';

export async function GET() {
  try {
    const result = await checkProjectGenerationLimit();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking subscription limits:', error);
    return NextResponse.json(
      { 
        canGenerate: false, 
        reason: 'Unable to check subscription status',
        error: true 
      },
      { status: 500 }
    );
  }
} 