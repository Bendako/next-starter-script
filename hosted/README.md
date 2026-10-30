# Hosted payments

The Polar adapter is `src/payments/adapters/polar/`. This package does not start a server and it does not deploy.

## Maintainer setup

Do these steps outside the repo.

### Initial Polar organization setup (Sandbox)

1. Create a Polar organization and a product in the sandbox environment. Put that product id in `POLAR_PRODUCT_ID_TBD`. The placeholder plan id is `TBD`. `POLAR_PAST_DUE_GRACE_SECONDS` is optional and defaults to `0`.
2. Create an organization access token for the sandbox environment. Put it in `POLAR_ACCESS_TOKEN`. Sandbox tokens and production tokens are different. The SDK selects the API host from `POLAR_ENVIRONMENT` (`sandbox` or `production`).
3. In Polar, add a webhook endpoint for subscription lifecycle events and `customer.state_changed`. Put the signing secret in `POLAR_WEBHOOK_SECRET`. Pass that secret to `webhooks.validateEvent` unchanged.
4. Keep the token and the secret in the host environment. Do not commit them.

### Production switch and payout/KYC

Before switching traffic from sandbox to production:

1. **Payout & KYC onboarding**: Complete identity verification (KYC) and configure bank payout details in the Polar dashboard under organization finance/payout settings.
2. **Production products**: Replicate plans/products in the Polar production dashboard and record their production product IDs.
3. **Production credentials**: Generate a production organization access token and set `POLAR_ACCESS_TOKEN` in the production environment. Set `POLAR_ENVIRONMENT=production`.
4. **Production webhook endpoint**: Register the production webhook endpoint URL (e.g. `POST /payments/webhook` on the deployment URL) for subscription lifecycle events and `customer.state_changed`. Record the signing secret and set `POLAR_WEBHOOK_SECRET` in the production environment.
5. **Product ID mapping**: Set `POLAR_PRODUCT_ID_TBD` (and any other plan-mapped environment variables) with production product IDs.
6. Verify webhook delivery and signature validation with a live test transaction before opening to external users.
