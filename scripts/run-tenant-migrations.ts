import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { ouvrirConnexionCentrale, listerOrganisationsProvisionnees, optionsMigrationTenant } from './tenant-migration-data-source';

/**
 * Exécute les migrations tenant en attente sur TOUTES les écoles
 * provisionnées. Équivalent de `migration:central`, mais celui-ci ne gère
 * qu'une seule base fixe (`central-data-source.ts`) — ici il faut ouvrir
 * une connexion par école, dont les infos ne sont connues qu'à l'exécution
 * (lues dans la base centrale), d'où ce script plutôt qu'un fichier
 * `-d <chemin>` unique pour la CLI TypeORM.
 *
 * À exécuter manuellement après tout déploiement ajoutant des migrations
 * tenant, et après le provisionnement d'une nouvelle école (pas encore
 * automatisé — voir la feuille de route).
 *
 * Pour une école déjà provisionnée AVANT l'introduction de cet exécuteur :
 * lancer `npm run migration:tenant:baseline` une fois, avant le premier
 * `migration:tenant` (voir `baseline-tenant-migrations.ts`) — sinon ce
 * script échouera en tentant de rejouer des migrations déjà réalisées via
 * `synchronize`.
 */
async function main() {
  const central = await ouvrirConnexionCentrale();
  const orgs = await listerOrganisationsProvisionnees(central);
  await central.destroy();

  console.log(`${orgs.length} école(s) provisionnée(s) trouvée(s).`);

  let echecs = 0;
  for (const org of orgs) {
    const ds = new DataSource(optionsMigrationTenant(org));
    try {
      await ds.initialize();
      const appliquees = await ds.runMigrations({ transaction: 'each' });
      if (appliquees.length === 0) {
        console.log(`[${org.name}] déjà à jour.`);
      } else {
        console.log(
          `[${org.name}] ${appliquees.length} migration(s) appliquée(s) : ${appliquees.map((m) => m.name).join(', ')}`,
        );
      }
    } catch (err: any) {
      echecs++;
      console.error(`[${org.name}] ÉCHEC : ${err.message}`);
    } finally {
      if (ds.isInitialized) await ds.destroy();
    }
  }

  if (echecs > 0) {
    console.error(`\n${echecs} école(s) en échec sur ${orgs.length} — voir le détail ci-dessus.`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
