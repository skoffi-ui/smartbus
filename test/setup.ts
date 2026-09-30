import { assurerVariablesE2e } from './env-e2e';

assurerVariablesE2e();

beforeAll(() => {
  console.log('🧪 Starting SMARTBUS test suite...');
});

afterAll(() => {
  console.log('✅ Test suite completed');
});
