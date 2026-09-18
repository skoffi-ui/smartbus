import { NestFactory } from '@nestjs/core';
import { SuperAppModule } from '../apps/super-app/src/super-app.module';
import { ProvisioningService } from '../apps/super-app/src/modules/provisioning/provisioning.service';
import { Organisation, OrganisationStatus } from '@app/database';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

async function bootstrap() {
  console.log('--- Initialisation du contexte NestJS ---');
  const app = await NestFactory.createApplicationContext(SuperAppModule, { logger: ['error', 'warn', 'log'] });
  console.log('✅ Contexte NestJS initialisé avec succès.');

  const provisioningService = app.get(ProvisioningService);
  const organisationRepository = app.get<Repository<Organisation>>(getRepositoryToken(Organisation));

  const testCode = 'test_sch_prov';
  const dbName = `smartbus_school_${testCode}`;

  // 1. Nettoyer l'ancienne base et organisation de test si elles existent
  const existingOrg = await organisationRepository.findOne({ where: { code: testCode } });
  if (existingOrg) {
    console.log(`⚠️ L'organisation de test existe déjà. Nettoyage de l'ancienne base...`);
    await provisioningService.dropOrganisationDatabase(dbName);
    await organisationRepository.remove(existingOrg);
    console.log('✅ Nettoyage terminé.');
  }

  // 2. Créer une organisation de test
  console.log(`Création de l'organisation de test...`);
  const org = organisationRepository.create({
    name: 'École de Test Provisioning',
    code: testCode,
    status: OrganisationStatus.TRIAL,
    email: 'test-prov@smartbus.com',
  });
  await organisationRepository.save(org);
  console.log(`✅ Organisation créée avec l'ID: ${org.id}`);

  // 3. Lancer le provisioning
  console.log(`Lancement du provisioning de la base de données "${dbName}"...`);
  const result = await provisioningService.provisionOrganisation(org.id);
  console.log('Résultat du provisioning :', result);

  if (result.status === 'success') {
    console.log('🎉 SUCCÈS : La base de données et le schéma ont été créés.');
  } else {
    console.error('❌ ÉCHEC : Erreur lors de la création de la base de données.');
  }

  // 4. Nettoyage final pour laisser l'environnement propre
  console.log('Désinstallation de la base de données de test...');
  await provisioningService.dropOrganisationDatabase(dbName);
  await organisationRepository.remove(org);
  console.log('✅ Nettoyage final terminé.');

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Erreur lors de l\'exécution du script :', err);
  process.exit(1);
});
