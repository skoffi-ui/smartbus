import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOrganisationBiotime1727100000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajouter les colonnes pour le département BioTime assigné à l'organisation
    await queryRunner.query(`
      ALTER TABLE "organisations"
      ADD COLUMN IF NOT EXISTS "biotime_department_id" integer,
      ADD COLUMN IF NOT EXISTS "biotime_department_name" varchar
    `);

    // Renommer/clarifier les colonnes de config BioTime centrale
    await queryRunner.query(`
      COMMENT ON COLUMN "organisations"."biotime_server_url" IS
        'URL du serveur BioTime CENTRAL (identique pour toutes les orgs)'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "organisations"."biotime_department_id" IS
        'ID du département BioTime assigné à cette organisation'
    `);

    // Index pour les recherches par département
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_organisations_biotime_dept"
      ON "organisations"("biotime_department_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_organisations_biotime_dept"`,
    );
    await queryRunner.query(`
      ALTER TABLE "organisations"
      DROP COLUMN IF EXISTS "biotime_department_name",
      DROP COLUMN IF EXISTS "biotime_department_id"
    `);
  }
}
