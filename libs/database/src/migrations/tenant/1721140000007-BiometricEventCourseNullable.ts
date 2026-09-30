import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rend `biometric_events.course_id` nullable.
 *
 * La colonne était NOT NULL alors que l'événement biométrique est enregistré dès
 * la réception du badgeage, avant toute résolution de course. L'insertion échouait
 * donc systématiquement : le flux `POST /hardware/stream` ne pouvait rien écrire.
 *
 * Un badgeage sans course reste une information à conserver : badgeuse non
 * rattachée à un car, aucune course active, ou badgeuse fixe à l'entrée de l'école.
 */
export class BiometricEventCourseNullable1721140000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "biometric_events" ALTER COLUMN "course_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Les lignes sans course doivent partir avant de rétablir la contrainte.
    await queryRunner.query(
      `DELETE FROM "biometric_events" WHERE "course_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "biometric_events" ALTER COLUMN "course_id" SET NOT NULL`,
    );
  }
}
