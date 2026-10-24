# Payments

Call this module for checkout, subscription status, webhook normalization, and entitlement storage. Provider HTTP and the database stay behind two ports, `PaymentsProvider` and `EntitlementStore`.

## Add an adapter

1. Implement `PaymentsProvider` in `src/payments/adapters/<name>/`.
2. Map that provider's customer id to `UserId`, and map its product id to `PlanId`, inside the adapter.
3. Verify the webhook signature in the adapter, then return `NormalizedWebhookEvent` values. Leave storage to the caller.
4. Build a `PaymentsContractHarness` that signs a body the adapter accepts, and that can break the signature.
5. Add the harness factory to the adapter list in `src/payments/contract.test.ts`.
6. From `hosted/`, run `npm test`. The new adapter has to pass the same suite as the fake adapter.

Tests should call `createFakePaymentsHarness` from `src/payments/adapters/fake/harness.ts`. The fake adapter keeps subscriptions in memory. It does not read the environment and it does not open a network connection.

## Storage port

`EntitlementStore` is the only storage port. `applyUpdates` counts three outcomes.

- `applied` means the event id was new and its `occurredAt` is later than the stored instant.
- `duplicates` means that event id was already seen. The first payload wins.
- `stale` means the event id was new, and `occurredAt` is earlier than or equal to the stored instant.

`createMemoryEntitlementStore` is the in-memory store. A Convex store belongs in `hosted/convex/` and has to pass `store.contract.test.ts`. Code under `src/payments/` cannot import Convex. Convex code imports this module.

Import `@polar-sh` only from `src/payments/adapters/polar/`. That adapter is a later change.

## Subscription states

A subscription is one of four states.

- `none` means the user has no subscription. This state has no plan and no period.
- `active` means the user is subscribed through `currentPeriodEnd`.
- `cancel_at_period_end` means the user keeps access through `currentPeriodEnd` and the subscription stops at that instant.
- `expired` means the period is over. This state keeps the plan id and the period end.

`occurredAt` orders events. Period end does not order events. An earlier `active` event can name a later period than an `expired` event that already won. The store keeps the expired state.

Instants are UTC timestamps with milliseconds, such as `2026-02-01T00:00:00.000Z`. Plan ids are opaque. This module has no prices.
