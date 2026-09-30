import { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
  },
  // uuid >= 12 est uniquement en ESM (même contournement que jest.config.ts).
  transformIgnorePatterns: ['/node_modules/(?!uuid/)'],
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@app/database(|/.*)$': '<rootDir>/libs/database/src/$1',
    '^@app/provisioning(|/.*)$': '<rootDir>/libs/provisioning/src/$1',
  },
  setupFiles: ['<rootDir>/test/env-e2e.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  globalSetup: '<rootDir>/test/global-setup.js',
  maxWorkers: 1,
  testTimeout: 120000,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
};

export default config;
