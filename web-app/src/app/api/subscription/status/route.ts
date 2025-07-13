import { NextResponse } from 'next/server';
import { getUserSubscription } from '@/lib/subscription';

export async function GET() {
  try {
    const subscription = await getUserSubscription();
    
    if (!subscription) {
      return NextResponse.json({
        plan: 'starter',
        status: 'active',
        projectsUsed: 0,
        projectsLimit: 3,
        canGenerateProjects: true,
        isOnFreeTrial: false,
      });
    }
    
    return NextResponse.json(subscription);
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return NextResponse.json(
      { error: 'Unable to fetch subscription status' },
      { status: 500 }
    );
  }
} 