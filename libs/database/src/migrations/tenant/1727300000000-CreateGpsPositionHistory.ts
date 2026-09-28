import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant Migration : Création de la table `gps_position_history`
 *
 * Historique des positions GPS ingérées — voir `PositionHistorique`
 * (`libs/database/src/tenant-entities/position-historique.entity.ts`) et
 * `HardwareStreamService.ingestResolvedGpsPosition`. Distinct du cache
 * live (`latestCarGps`/Redis, qui ne garde que la dernière position) : une
 * ligne par position reçue, pour pouvoir rejouer un trajet après coup.
 *
 * Purgée après 30 jours par une tâche planifiée (`CronService`) — sans ça,
 * une ligne toutes les ~20s par véhicule actif ferait grossir cette table
 * sans limite.
 */
export class CreateGpsPositionHistory1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "gps_position_history" (
          "id"           uuid          NOT NULL DEFAULT uuid_generate_v4(),
          "created_at"   TIMESTAMPTZ   NOT NULL DEFAULT now(),
          "updated_at"   TIMESTAMPTZ   NOT NULL DEFAULT now(),
          "created_by"   uuid,
          "updated_by"   uuid,
          "created_by_type" VARCHAR(50),
          "updated_by_type" VARCHAR(50),
          "last_modified_source" VARCHAR(50),

          "car_id"       uuid              NOT NULL,
          "course_id"    VARCHAR(100),
          "lat"          DOUBLE PRECISION  NOT NULL,
          "lng"          DOUBLE PRECISION  NOT NULL,
          "speed"        INTEGER           NOT NULL DEFAULT 0,
          "reported_at"  TIMESTAMPTZ,

          CONSTRAINT "PK_gps_position_history" PRIMARY KEY ("id")
        )
      `);

      // Lecture fréquente : historique d'UN véhicule, du plus récent au plus ancien.
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_gps_position_history_car_created"
        ON "gps_position_history" ("car_id", "created_at" DESC)
      `);

      // Utilisée par la purge (30 jours) : cible directement les lignes à supprimer.
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_gps_position_history_created_at"
        ON "gps_position_history" ("created_at")
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
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gps_position_history_created_at"`);
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gps_position_history_car_created"`);
      await queryRunner.query(`DROP TABLE IF EXISTS "gps_position_history"`);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
