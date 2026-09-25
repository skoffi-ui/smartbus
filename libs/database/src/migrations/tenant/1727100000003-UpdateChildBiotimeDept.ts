import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateChildBiotimeDept1727100000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajouter le département BioTime à l'élève (hérité de l'organisation)
    await queryRunner.query(`
      ALTER TABLE "children"
      ADD COLUMN IF NOT EXISTS "biotime_department_id" integer
    `);

    // Renommer empCode en biotimeEmpCode pour plus de clarté
    await queryRunner.query(`
      ALTER TABLE "children"
      ADD COLUMN IF NOT EXISTS "biotime_emp_code" varchar
    `);

    // Migrer les anciennes données
    await queryRunner.query(`
      UPDATE "children"
      SET "biotime_emp_code" = "emp_code"
      WHERE "emp_code" IS NOT NULL
      AND "biotime_emp_code" IS NULL
    `);

    // Index
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_children_biotime_dept"
      ON "children"("biotime_department_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_children_biotime_emp_code"
      ON "children"("biotime_emp_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_children_biotime_emp_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_children_biotime_dept"`);
    await queryRunner.query(`
      ALTER TABLE "children"
      DROP COLUMN IF EXISTS "biotime_emp_code",
      DROP COLUMN IF EXISTS "biotime_department_id"
    `);
  }
}
