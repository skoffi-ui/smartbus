import { NestFactory } from '@nestjs/core';
import { SuperAppModule } from '../apps/super-app/src/super-app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  console.log('--- Initialisation du contexte NestJS pour la migration ---');
  const app = await NestFactory.createApplicationContext(SuperAppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const dataSource = app.get(DataSource);

  console.log(
    'Exécution des requêtes SQL pour créer la table devices et organisation_devices...',
  );

  await dataSource
    .query(
      `
    CREATE TYPE "public"."device_type_enum" AS ENUM('BADGEUSE', 'GPS');
  `,
    )
    .catch((e) => console.log('Enum device_type_enum existe déjà:', e.message));

  await dataSource
    .query(
      `
    CREATE TYPE "public"."device_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED');
  `,
    )
    .catch((e) =>
      console.log('Enum device_status_enum existe déjà:', e.message),
    );

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "devices" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "type_device" "public"."device_type_enum" NOT NULL,
      "serial_number" character varying(255) NOT NULL,
      "imei" character varying(255),
      "encrypted_api_key" text,
      "encryption_iv" text,
      "status" "public"."device_status_enum" NOT NULL DEFAULT 'INACTIVE',
      "last_seen_at" TIMESTAMP WITH TIME ZONE,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "deleted_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "PK_devices" PRIMARY KEY ("id")
    );
  `);

  await dataSource
    .query(
      `
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_devices_serial_number" ON "devices" (LOWER("serial_number")) WHERE "deleted_at" IS NULL;
  `,
    )
    .catch((e) => console.log(e.message));

  await dataSource
    .query(
      `
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_devices_imei" ON "devices" ("imei") WHERE "imei" IS NOT NULL AND "deleted_at" IS NULL;
  `,
    )
    .catch((e) => console.log(e.message));

  await dataSource
    .query(
      `
    CREATE TABLE IF NOT EXISTS "organisation_devices" (
      "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      "organisation_id" uuid NOT NULL,
      "device_id" uuid NOT NULL,
      "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "released_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "FK_org_devices_organisation" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_org_devices_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE,
      CONSTRAINT "unique_active_device_assignment" UNIQUE ("device_id", "released_at")
    );
  `,
    )
    .catch((e) => console.log(e.message));

  console.log('✅ Tables créées avec succès.');
  await app.close();
}

bootstrap().catch(console.error);
