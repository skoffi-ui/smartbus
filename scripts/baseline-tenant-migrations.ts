import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import {
  ouvrirConnexionCentrale,
  listerOrganisationsProvisionnees,
  optionsMigrationTenant,
} from './tenant-migration-data-source';

/**
 * Amorçage à exécuter UNE SEULE FOIS, pour les écoles déjà provisionnées
 * avant l'introduction de `migration:tenant` (`run-tenant-migrations.ts`).
 *
 * Leur schéma reflète déjà ces 14 migrations — construit via `synchronize:
 * true` (dev) ou via des correctifs défensifs au premier usage pour les 3
 * plus récentes (voir `HardwareStreamService.enregistrerHistoriquePosition`
 * et consorts) — mais aucune n'a jamais été *appliquée* au sens TypeORM
 * (table `migrations_tenant` inexistante). Sans cet amorçage,
 * `migration:tenant` essaierait de les rejouer depuis la migration n°1 sur
 * un schéma qui les a déjà toutes, et échouerait immédiatement (`CREATE
 * TABLE` sur une table déjà existante, etc.).
 *
 * Liste figée intentionnellement : NE JAMAIS y ajouter une migration plus
 * récente. Une nouvelle migration doit être appliquée pour de vrai par
 * `migration:tenant`, pas ajoutée ici comme si elle était déjà en place.
 */
const MIGRATIONS_A_AMORCER: ReadonlyArray<{ timestamp: number; name: string }> =
  [
    {
      timestamp: 1721140000001,
      name: 'AddAuditFieldsToTenantEntities1721140000001',
    },
    { timestamp: 1721140000002, name: 'PhaseAStep2NewEntities1721140000002' },
    {
      timestamp: 1721140000003,
      name: 'PhaseAStep3RefactorEntities1721140000003',
    },
    { timestamp: 1721140000004, name: 'AddFcmTokenToParents1721140000004' },
    { timestamp: 1721140000005, name: 'CreateAlertsCritiques1721140000005' },
    { timestamp: 1721140000006, name: 'AddSensToMontees1721140000006' },
    {
      timestamp: 1721140000007,
      name: 'BiometricEventCourseNullable1721140000007',
    },
    {
      timestamp: 1721140000008,
      name: 'AddRayonDetectionToPoints1721140000008',
    },
    {
      timestamp: 1726907400000,
      name: 'AddTypeToPointRecuperation1726907400000',
    },
    { timestamp: 1727000000000, name: 'AddBiotimeIdToChildren1727000000000' },
    { timestamp: 1727100000003, name: 'UpdateChildBiotimeDept1727100000003' },
    { timestamp: 1727300000000, name: 'CreateGpsPositionHistory1727300000000' },
    {
      timestamp: 1727400000000,
      name: 'AddProximiteArretToTypeAlerte1727400000000',
    },
    {
      timestamp: 1727400000001,
      name: 'UniqueChildIdOnAffectations1727400000001',
    },
  ];

async function amorcerEcole(ds: DataSource, nomEcole: string): Promise<void> {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "migrations_tenant" (
      "id" SERIAL PRIMARY KEY,
      "timestamp" bigint NOT NULL,
      "name" varchar NOT NULL
    )
  `);

  const dejaPresentes: Array<{ name: string }> = await ds.query(
    `SELECT name FROM "migrations_tenant"`,
  );
  if (dejaPresentes.length > 0) {
    console.log(
      `[${nomEcole}] déjà amorcée (${dejaPresentes.length} entrée(s)) — ignorée.`,
    );
    return;
  }

  for (const m of MIGRATIONS_A_AMORCER) {
    await ds.query(
      `INSERT INTO "migrations_tenant" ("timestamp", "name") VALUES ($1, $2)`,
      [m.timestamp, m.name],
    );
  }
  console.log(
    `[${nomEcole}] amorcée avec ${MIGRATIONS_A_AMORCER.length} migration(s) marquée(s) "déjà appliquée(s)".`,
  );
}

async function main() {
  const central = await ouvrirConnexionCentrale();
  const orgs = await listerOrganisationsProvisionnees(central);
  await central.destroy();

  console.log(`${orgs.length} école(s) provisionnée(s) trouvée(s).`);

  for (const org of orgs) {
    const ds = new DataSource(optionsMigrationTenant(org));
    try {
      await ds.initialize();
      await amorcerEcole(ds, org.name);
    } catch (err: any) {
      console.error(`[${org.name}] ÉCHEC de l'amorçage : ${err.message}`);
    } finally {
      if (ds.isInitialized) await ds.destroy();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
