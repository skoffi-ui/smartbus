import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase A - Étape 3 : Refactorisation de Trajet, Course, Pointage (ex-Montée), Driver
 *
 * STRATÉGIE :
 * - Ajout des nouvelles colonnes sans suppression des anciennes (safe migration)
 * - Les colonnes legacy restent présentes pour la compatibilité avec le code existant
 * - La table 'pointages' est créée en parallèle de 'montees' (suppression en Phase B)
 */
export class PhaseAStep3RefactorEntities1721140000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      // ========================================================
      // 1. TRAJET : Ajout des nouveaux champs descriptifs
      //    (la suppression de course_id se fera après migration des données, en Phase B)
      // ========================================================
      await queryRunner.query(
        `ALTER TABLE "trajets" ADD COLUMN IF NOT EXISTS "nom" character varying(255) DEFAULT 'Trajet sans nom'`,
      );
      await queryRunner.query(
        `ALTER TABLE "trajets" ADD COLUMN IF NOT EXISTS "description" text`,
      );
      await queryRunner.query(
        `ALTER TABLE "trajets" ADD COLUMN IF NOT EXISTS "sens" character varying(50) DEFAULT 'aller'`,
      );
      await queryRunner.query(
        `ALTER TABLE "trajets" ADD COLUMN IF NOT EXISTS "duree_estimative" integer`,
      );

      // ========================================================
      // 2. COURSE : Ajout du lien vers Trajet et du type
      //    (les colonnes car_id/driver_id sont conservées pour legacy)
      // ========================================================
      await queryRunner.query(
        `ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "trajet_id" uuid`,
      );
      await queryRunner.query(
        `ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "type" character varying(50)`,
      );

      // Création de la Foreign Key (safe : pas de données à migrer pour l'instant)
      const fkExists = await queryRunner.query(`
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FK_courses_trajet_id' AND table_name = 'courses'
      `);
      if (!fkExists.length) {
        await queryRunner.query(
          `ALTER TABLE "courses" ADD CONSTRAINT "FK_courses_trajet_id" FOREIGN KEY ("trajet_id") REFERENCES "trajets"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
      }

      // ========================================================
      // 3. DRIVER : Ajout de pin_code_hash, photo_url, status
      // ========================================================
      await queryRunner.query(
        `ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "pin_code_hash" character varying`,
      );
      await queryRunner.query(
        `ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "photo_url" character varying`,
      );
      await queryRunner.query(
        `ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "status" character varying(50) DEFAULT 'active'`,
      );

      // ========================================================
      // 4. POINTAGES : Création de la nouvelle table
      //    (remplacera 'montees' en Phase B)
      // ========================================================
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "pointages" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "created_by" uuid,
          "updated_by" uuid,
          "created_by_type" character varying(50),
          "updated_by_type" character varying(50),
          "last_modified_source" character varying(50),

          "child_id" uuid NOT NULL,
          "course_execution_id" uuid,
          "point_id" uuid,
          "type" character varying(50) NOT NULL,
          "date" date NOT NULL,
          "heure" TIMESTAMP WITH TIME ZONE NOT NULL,
          "biotime_punch_id" character varying,
          "distance_gps" numeric(8,2),
          "statut" character varying(50) NOT NULL DEFAULT 'valide',
          "validation_type" character varying(50) NOT NULL DEFAULT 'biometrique',
          "validation_message" text,
          "synced" boolean NOT NULL DEFAULT true,

          CONSTRAINT "UQ_pointages_biotime_punch_id" UNIQUE ("biotime_punch_id"),
          CONSTRAINT "PK_pointages" PRIMARY KEY ("id")
        )
      `);

      await queryRunner.query(
        `ALTER TABLE "pointages" ADD CONSTRAINT "FK_pointages_child_id" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
      await queryRunner.query(
        `ALTER TABLE "pointages" ADD CONSTRAINT "FK_pointages_course_execution_id" FOREIGN KEY ("course_execution_id") REFERENCES "course_executions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
      );
      await queryRunner.query(
        `ALTER TABLE "pointages" ADD CONSTRAINT "FK_pointages_point_id" FOREIGN KEY ("point_id") REFERENCES "points_recuperation"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      // Suppression de la table pointages
      await queryRunner.query(
        `ALTER TABLE "pointages" DROP CONSTRAINT IF EXISTS "FK_pointages_point_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "pointages" DROP CONSTRAINT IF EXISTS "FK_pointages_course_execution_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "pointages" DROP CONSTRAINT IF EXISTS "FK_pointages_child_id"`,
      );
      await queryRunner.query(`DROP TABLE IF EXISTS "pointages"`);

      // Suppression des colonnes drivers
      await queryRunner.query(
        `ALTER TABLE "drivers" DROP COLUMN IF EXISTS "status"`,
      );
      await queryRunner.query(
        `ALTER TABLE "drivers" DROP COLUMN IF EXISTS "photo_url"`,
      );
      await queryRunner.query(
        `ALTER TABLE "drivers" DROP COLUMN IF EXISTS "pin_code_hash"`,
      );

      // Suppression des colonnes courses
      await queryRunner.query(
        `ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "FK_courses_trajet_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "courses" DROP COLUMN IF EXISTS "type"`,
      );
      await queryRunner.query(
        `ALTER TABLE "courses" DROP COLUMN IF EXISTS "trajet_id"`,
      );

      // Suppression des colonnes trajets
      await queryRunner.query(
        `ALTER TABLE "trajets" DROP COLUMN IF EXISTS "duree_estimative"`,
      );
      await queryRunner.query(
        `ALTER TABLE "trajets" DROP COLUMN IF EXISTS "sens"`,
      );
      await queryRunner.query(
        `ALTER TABLE "trajets" DROP COLUMN IF EXISTS "description"`,
      );
      await queryRunner.query(
        `ALTER TABLE "trajets" DROP COLUMN IF EXISTS "nom"`,
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
