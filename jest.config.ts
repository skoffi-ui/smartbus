import { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'apps/super-app/**/*.(t|j)s',
    'apps/school-app/**/*.(t|j)s',
    'apps/api-gateway/**/*.(t|j)s',
    'libs/**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.interface.ts',
    '!**/*.dto.ts',
    '!**/*.entity.ts',
    '!**/*.module.ts',
    '!**/main.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/', '<rootDir>/libs/'],
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@app/database(|/.*)$': '<rootDir>/libs/database/src/$1',
    '^@app/provisioning(|/.*)$': '<rootDir>/libs/provisioning/src/$1',
  },
  // uuid >= 12 est distribué uniquement en ESM : Jest doit le transformer comme nos
  // sources, sinon tout test important @app/common échoue au chargement.
  transformIgnorePatterns: ['/node_modules/(?!uuid/)'],
  // Plancher mesuré le 2026-09-30 sur le backend Nest (super-app, school-app,
  // api-gateway, libs) : statements 17,11 % · branches 12,24 % · functions
  // 10,44 % · lines 16,73 % (129 tests, 15 suites). Volontairement un peu en
  // dessous du relevé, pour absorber le bruit d'un fichier ajouté. Ce n'est
  // pas la cible : la relever par paliers (TD-027). L'objectif documenté reste
  // 70 %.
  coverageThreshold: {
    global: {
      branches: 9,
      functions: 8,
      lines: 14,
      statements: 14,
    },
  },
  testTimeout: 30000,
  verbose: true,
};

export default config;
