import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHardwareDevices1721140000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      // 1. Création des types ENUM
      await queryRunner.query(`
        CREATE TYPE "public"."device_type_enum" AS ENUM('BADGEUSE', 'GPS');
      `);
      await queryRunner.query(`
        CREATE TYPE "public"."device_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED');
      `);

      // 2. Création de la table devices
      await queryRunner.query(`
        CREATE TABLE "devices" (
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

      // 3. Création des index d'unicité sur devices
      await queryRunner.query(`
        CREATE UNIQUE INDEX "idx_devices_serial_number" ON "devices" (LOWER("serial_number")) WHERE "deleted_at" IS NULL;
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "idx_devices_imei" ON "devices" ("imei") WHERE "imei" IS NOT NULL AND "deleted_at" IS NULL;
      `);

      // 4. Création de la table organisation_devices (liaison)
      await queryRunner.query(`
        CREATE TABLE "organisation_devices" (
          "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          "organisation_id" uuid NOT NULL,
          "device_id" uuid NOT NULL,
          "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "released_at" TIMESTAMP WITH TIME ZONE,
          CONSTRAINT "FK_org_devices_organisation" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_org_devices_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE,
          CONSTRAINT "unique_active_device_assignment" UNIQUE ("device_id", "released_at")
        );
      `);

      // 5. Création des index de performances
      await queryRunner.query(`
        CREATE INDEX "idx_org_devices_device_id" ON "organisation_devices" ("device_id");
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_org_devices_organisation_id" ON "organisation_devices" ("organisation_id");
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_org_devices_active" ON "organisation_devices" ("device_id") WHERE "released_at" IS NULL;
      `);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`DROP TABLE "organisation_devices"`);
      await queryRunner.query(`DROP TABLE "devices"`);
      await queryRunner.query(`DROP TYPE "public"."device_status_enum"`);
      await queryRunner.query(`DROP TYPE "public"."device_type_enum"`);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
