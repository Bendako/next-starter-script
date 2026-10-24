# Payments

Call this module for checkout, subscription status, webhook normalization, and entitlement storage. Provider HTTP and the database stay behind two ports, `PaymentsProvider` and `EntitlementStore`.

## Add an adapter

1. Implement `PaymentsProvider` in `src/payments/adapters/<name>/`.
2. Map that provider's customer id to `UserId`, and map its product id to `PlanId`, inside the adapter.
3. Verify the webhook signature in the adapter, then return `NormalizedWebhookEvent` values. Leave storage to the caller.
4. Build a `PaymentsContractHarness` that signs a body the adapter accepts, and that can break the signature.
5. Call `runPaymentsContract` from `src/payments/provider-contract.ts` with that harness factory.
6. From `hosted/`, run `npm test`. The new adapter has to pass the same suite as the fake adapter.

Tests should call `createFakePaymentsHarness` from `src/payments/adapters/fake/harness.ts`. The fake adapter keeps subscriptions in memory. It does not read the environment and it does not open a network connection.

## Storage port

`EntitlementStore` is the only storage port. `applyUpdates` counts three outcomes.

- `applied` means the event id was new and the event replaces the stored subscription.
- `duplicates` means that event id was already seen. The first payload wins.
- `stale` means the event id was new and the event loses. An earlier `occurredAt` loses. At the same `occurredAt`, a less restrictive state loses, and the same state loses when its period end is earlier or equal.

Event ids are global across users. A durable store may drop an id after the provider retry window. `occurredAt` still rejects an older event, so dropping those ids does not apply an old update again.

`createMemoryEntitlementStore` is the in-memory store. A Convex store belongs in `hosted/convex/` and calls `runEntitlementStoreContract` from `src/payments/store-contract.ts`. That module does not import Convex. Code under `src/payments/` cannot import Convex.

`PaymentsProvider` requires `createCustomerPortalUrl`. The issue text listed that method as optional. Callers can call it on every adapter.

Import `@polar-sh` only from `src/payments/adapters/polar/`. That ban includes `hosted/convex/`. The Polar adapter is a later change.

## Subscription states

A subscription is one of four states.

- `none` means the user has no subscription. This state has no plan and no period.
- `active` means the user is subscribed through `currentPeriodEnd`.
- `cancel_at_period_end` means the user keeps access through `currentPeriodEnd` and the subscription stops at that instant.
- `expired` means the period is over. This state keeps the plan id and the period end.

`occurredAt` orders events. An earlier event loses even when its period end is later. At the same `occurredAt`, the more restrictive state wins. `expired` outranks `cancel_at_period_end`, which outranks `active`, which outranks `none`. The same state keeps the later period end.

`hasAccess(status, now)` answers whether that status grants access at the instant you pass. `active` and `cancel_at_period_end` grant access only while `now` is before `currentPeriodEnd`. `expired`, `none`, and `null` grant no access. The function does not read the system clock.

Instants are UTC timestamps with milliseconds, such as `2026-02-01T00:00:00.000Z`. Plan ids are opaque. This module has no prices.
