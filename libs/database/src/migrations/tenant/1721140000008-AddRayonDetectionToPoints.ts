import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajoute la tolérance GPS par arrêt.
 *
 * L'API acceptait déjà `rayonDetection` et la validation des montées le lisait,
 * mais la colonne n'existait pas : la valeur était silencieusement jetée et la
 * tolérance retombait toujours sur la valeur par défaut de 30 mètres codée dans
 * le service. Un GPS embarqué dérive couramment de 20 à 50 mètres en ville, ce
 * qui produisait des refus « hors zone GPS » sur des montées légitimes.
 *
 * La valeur par défaut est portée à 100 mètres, plus réaliste en conditions
 * urbaines, et reste ajustable arrêt par arrêt.
 */
export class AddRayonDetectionToPoints1721140000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "points_recuperation"
      ADD COLUMN IF NOT EXISTS "rayon_detection" integer NOT NULL DEFAULT 100;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "points_recuperation" DROP COLUMN IF EXISTS "rayon_detection";
    `);
  }
}
