import { createFakePaymentsHarness } from './adapters/fake/harness.js';
import { runPaymentsContract } from './provider-contract.js';

runPaymentsContract('fake', createFakePaymentsHarness);
