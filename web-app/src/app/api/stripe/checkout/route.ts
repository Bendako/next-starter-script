import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The legacy webhook currently does not match the Prisma subscription schema.
  // Keep billing disabled until fulfillment and webhook idempotency are repaired.
  if (process.env.LEGACY_BILLING_ENABLED !== '1') {
    return NextResponse.json({ error: 'Checkout is temporarily unavailable' }, { status: 503 });
  }

  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const requestedPlan = (body as Record<string, unknown>).plan;
    const plan = requestedPlan === 'pro' ? 'professional' : requestedPlan;
    const planPrices: Record<string, string | undefined> = {
      professional: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
      team: process.env.STRIPE_PRICE_TEAM_MONTHLY,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    };
    if (typeof plan !== 'string' || !Object.prototype.hasOwnProperty.call(planPrices, plan)) {
      return NextResponse.json({ error: 'Unknown subscription plan' }, { status: 400 });
    }

    // A price ID and plan supplied by the browser are not trusted.
    const priceId = planPrices[plan];
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const configuredAppUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!priceId || !secretKey || !configuredAppUrl) {
      console.error('Checkout configuration incomplete');
      return NextResponse.json({ error: 'Checkout is temporarily unavailable' }, { status: 503 });
    }

    let appUrl: URL;
    try {
      appUrl = new URL(configuredAppUrl);
    } catch {
      return NextResponse.json({ error: 'Checkout origin is not configured' }, { status: 503 });
    }
    if (
      (appUrl.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && appUrl.protocol === 'http:')) ||
      appUrl.username || appUrl.password
    ) {
      return NextResponse.json({ error: 'Checkout origin is not configured' }, { status: 503 });
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2025-06-30.basil' });
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: new URL(`/dashboard?success=true&plan=${encodeURIComponent(plan)}`, appUrl).toString(),
      cancel_url: new URL('/pricing?canceled=true', appUrl).toString(),
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      metadata: { userId, plan },
      subscription_data: {
        metadata: { userId, plan },
        trial_period_days: plan === 'professional' || plan === 'team' ? 14 : undefined,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
