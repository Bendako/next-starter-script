# Hosted payments

The Polar adapter is `src/payments/adapters/polar/`. This package does not start a server and it does not deploy.

## Maintainer setup

Do these steps outside the repo.

1. Create a Polar organization and a product in the environment you are using. Put that product id in `POLAR_PRODUCT_ID_TBD`. The placeholder plan id is `TBD`. `POLAR_PAST_DUE_GRACE_SECONDS` is optional and defaults to `0`.
2. Create an organization access token for that same environment. Put it in `POLAR_ACCESS_TOKEN`. Sandbox tokens and production tokens are different. The SDK selects the API host from `POLAR_ENVIRONMENT` (`sandbox` or `production`).
3. In Polar, add a webhook endpoint for the subscription lifecycle events and `customer.state_changed`. Put the signing secret in `POLAR_WEBHOOK_SECRET`. Pass that secret to `webhooks.validateEvent` unchanged.
4. Keep the token and the secret in the host environment. Do not commit them.
