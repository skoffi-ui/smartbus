import { DataSource } from 'typeorm';
import {
  AuditLog,
  BillingRecord,
  BiotimeConfig,
  BiotimeTerminal,
  MetaData,
  Organisation,
  Payment,
  Subscription,
  SuperAppChild,
  SuperAppPunch,
  TENANT_ENTITIES,
  TenantSchemaVersion,
  User,
} from '@app/database';
import { assurerVariablesE2e } from './env-e2e';

/** Même liste que `DatabaseModule` : le schéma de test doit coller à l'app. */
const ENTITES_CENTRALES = [
  Organisation,
  User,
  Subscription,
  BillingRecord,
  MetaData,
  Payment,
  AuditLog,
  SuperAppChild,
  SuperAppPunch,
  TenantSchemaVersion,
  BiotimeConfig,
  BiotimeTerminal,
];

async function creerBaseSiAbsente(nom: string): Promise<void> {
  const admin = new DataSource({
    type: 'postgres',
    host: process.env.SUPER_DB_HOST,
    port: Number(process.env.SUPER_DB_PORT || 5432),
    username: process.env.SUPER_DB_USER,
    password: process.env.SUPER_DB_PASSWORD,
    database: 'postgres',
  });
  await admin.initialize();
  try {
    const existe: unknown[] = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [nom],
    );
    if (existe.length === 0) {
      await admin.query(`CREATE DATABASE "${nom.replace(/"/g, '')}"`);
    }
  } finally {
    await admin.destroy();
  }
}

async function synchroniser(database: string, entities: any[]): Promise<void> {
  const source = new DataSource({
    type: 'postgres',
    host: process.env.SUPER_DB_HOST,
    port: Number(process.env.SUPER_DB_PORT || 5432),
    username: process.env.SUPER_DB_USER,
    password: process.env.SUPER_DB_PASSWORD,
    database,
    entities,
    synchronize: true,
    logging: false,
  });
  await source.initialize();
  await source.destroy();
}

/**
 * Crée les tables sans passer `NODE_ENV` à `development`.
 * L'app ne synchronise qu'en development ; en test le schéma est préparé ici.
 */
export async function synchroniserSchemasDeTest(): Promise<void> {
  assurerVariablesE2e();
  const centrale = process.env.SUPER_DB_NAME || 'smartbus_test';
  const ecole = process.env.SCHOOL_TENANT_DB_NAME || 'smartbus_school_test';
  await creerBaseSiAbsente(centrale);
  await creerBaseSiAbsente(ecole);
  await synchroniser(centrale, ENTITES_CENTRALES);
  await synchroniser(ecole, TENANT_ENTITIES);
}
