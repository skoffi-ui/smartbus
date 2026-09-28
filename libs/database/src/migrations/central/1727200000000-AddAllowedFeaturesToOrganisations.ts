import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissions par école : quelles fonctionnalités school-web le compte
 * directeur d'une organisation peut utiliser. NULL = aucune restriction
 * (comportement actuel, valable pour toutes les écoles existantes).
 */
export class AddAllowedFeaturesToOrganisations1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organisations"
      ADD COLUMN IF NOT EXISTS "allowed_features" jsonb
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "organisations"."allowed_features" IS
        'Clés de fonctionnalités school-web autorisées pour le directeur de cette école. NULL = tout autorisé.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organisations"
      DROP COLUMN IF EXISTS "allowed_features"
    `);
  }
}
