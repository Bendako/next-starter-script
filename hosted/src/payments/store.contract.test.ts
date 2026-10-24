import { createMemoryEntitlementStore } from './memory-store.js';
import { runEntitlementStoreContract } from './store-contract.js';

runEntitlementStoreContract('memory', createMemoryEntitlementStore);
