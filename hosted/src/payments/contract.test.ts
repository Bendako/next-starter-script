import { createFakePaymentsHarness } from './adapters/fake/harness.js';
import { createPolarPaymentsHarness } from './adapters/polar/harness.js';
import { runPaymentsContract } from './provider-contract.js';

runPaymentsContract('fake', createFakePaymentsHarness);
runPaymentsContract('polar', createPolarPaymentsHarness);
