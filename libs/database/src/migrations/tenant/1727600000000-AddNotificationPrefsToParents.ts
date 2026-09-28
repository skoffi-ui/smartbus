import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Préférences de notification par parent (app parent) — voir
 * `Parent.notifPunchEnabled`/`notifProximityEnabled`. Un parent qui coupe un
 * type de notification n'en reçoit plus ni en push, ni dans son historique
 * (voir `ParentPortalService.handlePunchNotification`/`handleProximityNotification`).
 */
export class AddNotificationPrefsToParents1727600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "parents"
      ADD COLUMN IF NOT EXISTS "notif_punch_enabled" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "notif_proximity_enabled" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "parents"
      DROP COLUMN IF EXISTS "notif_punch_enabled",
      DROP COLUMN IF EXISTS "notif_proximity_enabled"
    `);
  }
}
