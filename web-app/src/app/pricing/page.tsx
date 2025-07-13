import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';

export default async function PricingPage() {
  const user = await currentUser();

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 0,
      description: 'Perfect for individual developers getting started',
      features: [
        '3 projects per month',
        'Basic templates (Default, Landing Page)',
        'Community support',
        'Standard download speed',
        'Basic documentation',
      ],
      limitations: [
        'No priority support',
        'No premium templates',
        'Monthly project limit',
      ],
      cta: 'Get Started Free',
      popular: false,
      stripePriceId: null,
    },
    {
      id: 'pro',
      name: 'Professional',
      price: 19,
      description: 'Best for serious developers and small teams',
      features: [
        'Unlimited projects',
        'All premium templates',
        'Priority support (24h response)',
        'Project history & analytics',
        'Advanced customization options',
        'Fast download speeds',
        'Premium documentation',
        'Early access to new templates',
      ],
      limitations: [],
      cta: 'Start Free Trial',
      popular: true,
      stripePriceId: 'price_professional_monthly', // Will be set in Stripe
    },
    {
      id: 'team',
      name: 'Team',
      price: 49,
      description: 'Ideal for growing teams and agencies',
      features: [
        'Everything in Professional',
        'Up to 10 team members',
        'Shared workspaces',
        'Team project management',
        'Advanced analytics & insights',
        'Custom branding options',
        'Priority support (4h response)',
        'Team usage dashboard',
        'Bulk project generation',
      ],
      limitations: [],
      cta: 'Contact Sales',
      popular: false,
      stripePriceId: 'price_team_monthly',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 199,
      description: 'For large organizations with advanced needs',
      features: [
        'Everything in Team',
        'Unlimited team members',
        'Custom templates & integrations',
        'On-premise deployment option',
        'SLA guarantee (99.9% uptime)',
        'Dedicated account manager',
        'Custom training & onboarding',
        'Advanced security features',
        'API access & webhooks',
        'Custom billing options',
      ],
      limitations: [],
      cta: 'Contact Sales',
      popular: false,
      stripePriceId: 'price_enterprise_monthly',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-blue-600">
                Next.js Starter
              </Link>
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                SaaS
              </span>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link 
                    href="/dashboard" 
                    className="text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Dashboard
                  </Link>
                  <UserButton afterSignOutUrl="/" />
                </>
              ) : (
                <>
                  <Link 
                    href="/sign-in" 
                    className="text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Sign In
                  </Link>
                  <Link 
                    href="/sign-up" 
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Choose the perfect plan for your development needs. Start free and upgrade as you grow.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-8">
            <span className="text-gray-600 mr-3">Monthly</span>
            <div className="relative">
              <input type="checkbox" className="sr-only" />
              <div className="w-12 h-6 bg-gray-200 rounded-full shadow-inner cursor-pointer">
                <div className="w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out"></div>
              </div>
            </div>
            <span className="text-gray-600 ml-3">
              Yearly 
              <span className="ml-1 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-lg shadow-lg border-2 p-6 relative ${
                plan.popular 
                  ? 'border-blue-500 transform scale-105' 
                  : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  ${plan.price}
                  <span className="text-lg font-normal text-gray-600">/month</span>
                </div>
                <p className="text-gray-600 text-sm">{plan.description}</p>
              </div>

              {/* Features */}
              <div className="mb-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm">
                      <svg className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Button */}
              <div className="mt-auto">
                {plan.id === 'starter' ? (
                  <Link
                    href={user ? "/dashboard" : "/sign-up"}
                    className="w-full bg-gray-100 text-gray-900 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors text-center block"
                  >
                    {plan.cta}
                  </Link>
                ) : plan.id === 'team' || plan.id === 'enterprise' ? (
                  <Link
                    href="/contact"
                    className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors text-center block"
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    onClick={async () => {
                      if (!user) {
                        window.location.href = '/sign-up';
                        return;
                      }
                      
                      try {
                        const response = await fetch('/api/stripe/checkout', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            priceId: plan.stripePriceId,
                            plan: plan.id,
                          }),
                        });
                        
                        const data = await response.json();
                        
                        if (data.error) {
                          alert('Error: ' + data.error);
                          return;
                        }
                        
                        // Redirect to Stripe Checkout
                        if (data.url) {
                          window.location.href = data.url;
                        }
                      } catch (error) {
                        console.error('Checkout error:', error);
                        alert('Failed to start checkout process');
                      }
                    }}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    {plan.cta}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Can I change plans at any time?
              </h3>
              <p className="text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any billing adjustments.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards, PayPal, and for Enterprise customers, we can arrange invoicing and wire transfers.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Is there a free trial?
              </h3>
              <p className="text-gray-600">
                Yes! Professional and Team plans come with a 14-day free trial. No credit card required to start.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                What if I exceed my project limit?
              </h3>
              <p className="text-gray-600">
                Starter plan users will be prompted to upgrade. Pro and Team users have unlimited projects, so you never have to worry about limits.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600">
                We offer a 30-day money-back guarantee for all paid plans. If you're not satisfied, we'll refund your payment in full.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Can I use this for commercial projects?
              </h3>
              <p className="text-gray-600">
                Absolutely! All plans include commercial use rights. The generated code is yours to use in any project, commercial or personal.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center bg-blue-600 rounded-lg p-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to accelerate your development?
          </h2>
          <p className="text-blue-100 text-lg mb-8">
            Join thousands of developers who are building faster with Next.js Starter SaaS
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={user ? "/dashboard" : "/sign-up"}
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Start Free Today
            </Link>
            <Link
              href="/contact"
              className="bg-blue-700 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-800 transition-colors border border-blue-500"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 