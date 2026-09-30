import { config } from 'dotenv';

/**
 * Variables réellement lues par les services (SUPER_DB_*, JWT_*, ENCRYPTION_KEY,
 * REDIS_*). Les anciens noms DB_HOST / DB_USERNAME ne sont branchés nulle part.
 *
 * Un `.env.test` ou l'environnement CI priment. Les valeurs ci-dessous ne
 * comblent que les trous, pour un poste local sans fichier d'environnement.
 * Ce ne sont pas des secrets de production.
 */
const DEFAUTS: Record<string, string> = {
  NODE_ENV: 'test',
  SUPER_DB_HOST: 'localhost',
  SUPER_DB_PORT: '5432',
  SUPER_DB_NAME: 'smartbus_test',
  SUPER_DB_USER: 'postgres',
  SUPER_DB_PASSWORD: 'postgres',
  SCHOOL_TENANT_DB_NAME: 'smartbus_school_test',
  JWT_SECRET: '0123456789abcdef0123456789abcdef',
  JWT_REFRESH_SECRET: 'fedcba9876543210fedcba9876543210',
  JWT_EXPIRES_IN: '1h',
  JWT_REFRESH_EXPIRES_IN: '7d',
  ENCRYPTION_KEY:
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
};

export function assurerVariablesE2e(): void {
  config({ path: '.env.test' });
  for (const [cle, valeur] of Object.entries(DEFAUTS)) {
    if (!process.env[cle]) {
      process.env[cle] = valeur;
    }
  }
}

assurerVariablesE2e();
