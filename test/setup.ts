import { config } from 'dotenv';

config({ path: '.env.test' });

beforeAll(() => {
  console.log('🧪 Starting SMARTBUS test suite...');
});

afterAll(() => {
  console.log('✅ Test suite completed');
});
