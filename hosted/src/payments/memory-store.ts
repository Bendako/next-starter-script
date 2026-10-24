import { reduceEntitlement, type ApplyResult, type EntitlementStore } from './store.js';
import type { Entitlement, EntitlementUpdate, EventId, UserId } from './types.js';

export function createMemoryEntitlementStore(): EntitlementStore {
  const entitlements = new Map<UserId, Entitlement>();
  const seen = new Set<EventId>();

  return {
    async applyUpdates(updates: readonly EntitlementUpdate[]): Promise<ApplyResult> {
      let applied = 0;
      let duplicates = 0;
      let stale = 0;

      for (const update of updates) {
        const current = entitlements.get(update.userId) ?? null;
        const reduced = reduceEntitlement(current, seen.has(update.eventId), update);
        if (reduced.decision === 'duplicate') {
          duplicates += 1;
          continue;
        }
        if (reduced.decision === 'stale') {
          seen.add(update.eventId);
          stale += 1;
          continue;
        }
        const entitlement = reduced.entitlement;
        seen.add(update.eventId);
        entitlements.set(update.userId, entitlement);
        applied += 1;
      }

      return { applied, duplicates, stale };
    },

    async getEntitlement(userId: UserId): Promise<Entitlement | null> {
      return entitlements.get(userId) ?? null;
    },
  };
}
