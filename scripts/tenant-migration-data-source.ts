import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';
import { Organisation } from '../libs/database/src/entities/organisation.entity';

/**
 * Connexion à la base centrale, juste pour lister les organisations
 * provisionnées — jamais pour leurs propres bases. Utilise l'entité
 * `Organisation` (pas du SQL brut) pour bénéficier du déchiffrement
 * transparent de `dbPassword` via son `ValueTransformer`.
 *
 * Toutes les entités centrales sont chargées (pas seulement `Organisation`) :
 * ses relations (`biotimeTerminals`, `subscriptions`) exigent que leur cible
 * soit aussi enregistrée dans la même `DataSource`, sinon TypeORM échoue au
 * démarrage (« Entity metadata ... was not found »).
 */
export async function ouvrirConnexionCentrale(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.SUPER_DB_HOST || 'localhost',
    port: parseInt(process.env.SUPER_DB_PORT || '5432', 10),
    username: process.env.SUPER_DB_USER || 'postgres',
    password: process.env.SUPER_DB_PASSWORD || 'postgres',
    database: process.env.SUPER_DB_NAME || 'smartbus_super',
    entities: [
      join(__dirname, '../libs/database/src/entities/*.entity{.ts,.js}'),
    ],
    synchronize: false,
  });
  await ds.initialize();
  return ds;
}

/** Organisations provisionnées, avec `dbPassword` explicitement sélectionné (`select: false` par défaut). */
export async function listerOrganisationsProvisionnees(
  central: DataSource,
): Promise<Organisation[]> {
  return central.getRepository(Organisation).find({
    where: { dbProvisioned: true },
    select: {
      id: true,
      name: true,
      dbName: true,
      dbHost: true,
      dbPort: true,
      dbUser: true,
      dbPassword: true,
      dbProvisioned: true,
    },
  });
}

/**
 * Options de connexion à la base d'UNE école, pour ses propres migrations.
 * `migrationsTableName` distinct de la base centrale (`migrations_central`,
 * voir `central-data-source.ts`) : chaque école piste ses migrations
 * indépendamment.
 */
export function optionsMigrationTenant(org: Organisation): DataSourceOptions {
  return {
    type: 'postgres',
    host: org.dbHost || process.env.SUPER_DB_HOST || 'localhost',
    port: org.dbPort || parseInt(process.env.SUPER_DB_PORT || '5432', 10),
    username: org.dbUser || process.env.SUPER_DB_USER || 'postgres',
    password: org.dbPassword || process.env.SUPER_DB_PASSWORD || 'postgres',
    database: org.dbName!,
    migrations: [
      join(__dirname, '../libs/database/src/migrations/tenant/*{.ts,.js}'),
    ],
    migrationsTableName: 'migrations_tenant',
    synchronize: false,
    logging: ['error', 'migration'],
  };
}
