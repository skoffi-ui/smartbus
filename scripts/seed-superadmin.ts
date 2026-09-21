import { NestFactory } from '@nestjs/core';
import { SuperAppModule } from '../apps/super-app/src/super-app.module';
import { User, UserRole, UserStatus } from '@app/database';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  console.log('--- Initialisation du contexte NestJS ---');
  const app = await NestFactory.createApplicationContext(SuperAppModule, { logger: ['error', 'warn', 'log'] });
  console.log('✅ Contexte NestJS initialisé.');

  const dataSource = app.get(DataSource);
  const userRepo = dataSource.getRepository(User);

  // Le mot de passe était écrit en dur (`superadminpassword`) : il est donc connu
  // de quiconque lit ce dépôt, et ce script le RÉINITIALISE sur les comptes
  // existants — le rejouer sur une base réelle rouvrait l'accès SUPER_ADMIN à
  // tout le monde. Il doit désormais être fourni au lancement.
  const motDePasse = process.env.SUPERADMIN_PASSWORD;
  if (!motDePasse || motDePasse.length < 12) {
    console.error(
      '❌ SUPERADMIN_PASSWORD est requis (12 caractères minimum).\n' +
        '   Exemple : SUPERADMIN_PASSWORD="<mot de passe fort>" npm run seed:superadmin',
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(motDePasse, 10);

  const adminEmails = ['superadmin@smartbus.com', 'admin@smartbus.com'];

  for (const email of adminEmails) {
    const existing = await userRepo.findOne({ where: { email } });
    if (!existing) {
      console.log(`Création de l'utilisateur ${email}...`);
      const user = userRepo.create({
        firstName: 'Super',
        lastName: 'Admin',
        email: email,
        password: passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      });
      await userRepo.save(user);
      console.log(`✅ Utilisateur ${email} créé.`);
    } else {
      console.log(`ℹ️ L'utilisateur ${email} existe déjà. Réinitialisation du mot de passe...`);
      existing.password = passwordHash;
      existing.status = UserStatus.ACTIVE;
      await userRepo.save(existing);
      console.log(`✅ Utilisateur ${email} mis à jour.`);
    }
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Erreur lors de la création des administrateurs :', err);
  process.exit(1);
});
