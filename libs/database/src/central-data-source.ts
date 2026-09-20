import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

/**
 * DataSource de la base centrale, dédiée aux migrations.
 *
 * Les migrations du dossier `migrations/central` n'étaient jusqu'ici jamais
 * exécutées : le schéma ne tenait que par `synchronize: true` en développement.
 * Conséquence constatée : la table `devices` n'existait pas, et tout le mécanisme
 * d'appartenance des appareils aux écoles était inerte.
 *
 * Usage : `npm run migration:central` (ou `migration:central:revert`).
 */
// Un seul export dans ce fichier : la CLI TypeORM refuse d'en charger plusieurs.
const CentralDataSource = new DataSource({
  type: 'postgres',
  host: process.env.SUPER_DB_HOST || 'localhost',
  port: parseInt(process.env.SUPER_DB_PORT || '5432', 10),
  username: process.env.SUPER_DB_USER || 'postgres',
  password: process.env.SUPER_DB_PASSWORD || 'postgres',
  database: process.env.SUPER_DB_NAME || 'smartbus_super',
  // Chargées depuis les sources en TS (ts-node) comme depuis le build en JS.
  migrations: [join(__dirname, 'migrations/central/*{.ts,.js}')],
  migrationsTableName: 'migrations_central',
  synchronize: false,
  logging: ['error', 'migration'],
});

export default CentralDataSource;
