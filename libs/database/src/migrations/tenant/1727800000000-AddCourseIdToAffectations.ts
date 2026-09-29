import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant Migration : une affectation devient (enfant, COURSE) au lieu de
 * (enfant) seul.
 *
 * Un enfant peut prendre un bus différent selon le moment de la journée
 * (matin, retour midi, remontée 14h, descente 16h) — chacun de ces trajets
 * est une Course distincte. Avec la contrainte `UQ_affectations_child_id`
 * (une seule affectation par enfant, à vie), le système ne pouvait
 * représenter qu'UN seul de ces trajets : `HardwareStreamService` déclenchait
 * une alerte critique « MAUVAIS_CAR » pour chaque badgeage sur toute autre
 * course, alors que l'enfant était exactement où il devait être.
 *
 * `course_id` reste NULLABLE : les affectations créées depuis
 * `TrajetEditor.tsx` (qui édite un Trajet géographique, indépendamment de
 * toute Course) n'en renseignent pas — `HardwareStreamService` s'y replie sur
 * l'ancienne vérification par trajet pour ces lignes précises (celles où
 * `course_id IS NULL`), donc ce chemin continue de fonctionner sans y être
 * modifié.
 *
 * Backfill : pour chaque affectation existante, on déduit sa course en
 * cherchant l'unique course (non supprimée) dont le trajet correspond au
 * trajet du point déjà affecté. Ambiguïté possible si plusieurs courses
 * partagent ce trajet — on prend alors la plus ancienne ; c'était de toute
 * façon indiscernable avant cette migration (une seule affectation existait
 * par enfant, sans lien vers une course précise).
 */
export class AddCourseIdToAffectations1727800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "affectations"
      ADD COLUMN IF NOT EXISTS "course_id" uuid NULL
        REFERENCES "courses"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      UPDATE "affectations" aff
      SET "course_id" = (
        SELECT c.id
        FROM "courses" c
        INNER JOIN "points_recuperation" pr ON pr.trajet_id = c.trajet_id
        WHERE pr.id = aff.point_id AND c.deleted_at IS NULL
        ORDER BY c.created_at ASC
        LIMIT 1
      )
      WHERE aff."course_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "affectations" DROP CONSTRAINT IF EXISTS "UQ_affectations_child_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "affectations"
      ADD CONSTRAINT "UQ_affectations_child_course" UNIQUE ("child_id", "course_id")
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "affectations"."course_id" IS
        'Course pour laquelle cette affectation s''applique. NULL = affectation créée depuis TrajetEditor.tsx (repli sur la vérification par trajet).'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "affectations" DROP CONSTRAINT IF EXISTS "UQ_affectations_child_course"
    `);

    await queryRunner.query(`
      ALTER TABLE "affectations" DROP COLUMN IF EXISTS "course_id"
    `);

    // Repose l'ancienne contrainte — n'aura de sens que si aucun enfant n'a
    // entre-temps reçu plusieurs affectations (une par course).
    await queryRunner.query(`
      ALTER TABLE "affectations" ADD CONSTRAINT "UQ_affectations_child_id" UNIQUE ("child_id")
    `);
  }
}
