import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant Migration : Création de la table `alertes_critiques`
 *
 * Cette table stocke les anomalies de badgeage détectées en temps réel :
 *  - Élève montant dans le mauvais véhicule (MAUVAIS_CAR)
 *  - Élève embarquant au mauvais arrêt (MAUVAIS_ARRET)
 *  - Élève non affecté à aucune tournée (ENFANT_NON_AFFECTE)
 *  - Course inactive lors du badgeage (COURSE_INACTIVE)
 *
 * INDEX : Optimisés pour les consultations par statut et horodatage (filtre de résolution).
 */
export class CreateAlertsCritiques1721140000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "alertes_critiques" (
          "id"               uuid          NOT NULL DEFAULT uuid_generate_v4(),
          "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMPTZ,

          -- Nature de l'anomalie
          "type"             VARCHAR(60)   NOT NULL,
          "severity"         VARCHAR(20)   NOT NULL DEFAULT 'HIGH',

          -- Description lisible pour l'interface
          "message"          TEXT          NOT NULL,

          -- Snapshot des données à l'instant T (conservées même si l'objet est supprimé)
          "child_id"         uuid          NOT NULL,
          "child_name"       VARCHAR(255)  NOT NULL,
          "child_emp_code"   VARCHAR(100),

          -- Véhicule et badgeuse impliqués
          "detected_car_id"  uuid,
          "detected_car_plate" VARCHAR(50),
          "terminal_sn"      VARCHAR(100),

          -- Course détectée vs course attendue
          "detected_course_id"  uuid,
          "expected_course_id"  uuid,

          -- Arrêt détecté vs arrêt attendu
          "detected_stop_id"    uuid,
          "expected_stop_id"    uuid,
          "expected_stop_name"  VARCHAR(255),

          -- Horodatage du badgeage
          "punch_time"       TIMESTAMPTZ   NOT NULL,

          -- Statut de résolution (pour le tableau de bord de l'école)
          "resolved"         BOOLEAN       NOT NULL DEFAULT false,
          "resolved_at"      TIMESTAMPTZ,
          "resolved_by"      VARCHAR(255),
          "resolution_note"  TEXT,

          CONSTRAINT "PK_alertes_critiques" PRIMARY KEY ("id")
        )
      `);

      // ─── Index de performance ──────────────────────────────────────────────
      // Lecture fréquente : lister les alertes non résolues par ordre chronologique
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_alertes_critiques_resolved_created"
        ON "alertes_critiques" ("resolved", "created_at" DESC)
      `);

      // Filtrage par élève (pour la vue du profil de l'élève)
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_alertes_critiques_child_id"
        ON "alertes_critiques" ("child_id")
      `);

      // Filtrage par severity pour les tableaux de bord
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_alertes_critiques_severity"
        ON "alertes_critiques" ("severity", "resolved")
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
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_alertes_critiques_severity"`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_alertes_critiques_child_id"`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_alertes_critiques_resolved_created"`,
      );
      await queryRunner.query(`DROP TABLE IF EXISTS "alertes_critiques"`);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
