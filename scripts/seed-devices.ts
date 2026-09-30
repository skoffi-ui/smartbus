import { NestFactory } from '@nestjs/core';
import { SuperAppModule } from '../apps/super-app/src/super-app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  console.log('--- Initialisation du contexte NestJS ---');
  const app = await NestFactory.createApplicationContext(SuperAppModule, {
    logger: ['error', 'warn', 'log'],
  });
  console.log('✅ Contexte NestJS initialisé.');

  const dataSource = app.get(DataSource);

  const defaultSerialNumber = 'CKPM223460449';

  const existing = await dataSource.query(
    `SELECT id FROM devices WHERE serial_number = $1 AND deleted_at IS NULL LIMIT 1`,
    [defaultSerialNumber],
  );

  if (!existing || existing.length === 0) {
    console.log(`Création de la badgeuse par défaut ${defaultSerialNumber}...`);
    await dataSource.query(
      `INSERT INTO devices (type_device, serial_number, status, last_seen_at) 
       VALUES ('BADGEUSE', $1, 'ACTIVE', now())`,
      [defaultSerialNumber],
    );
    console.log(`✅ Badgeuse ${defaultSerialNumber} enregistrée.`);
  } else {
    console.log(`ℹ️ La badgeuse ${defaultSerialNumber} existe déjà.`);
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Erreur lors de la création de la badgeuse :', err);
  process.exit(1);
});
