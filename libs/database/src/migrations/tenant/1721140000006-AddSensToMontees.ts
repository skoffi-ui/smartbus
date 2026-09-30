import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajoute le sens du pointage (montée / descente) à l'historique des montées.
 *
 * Sans cette colonne, l'écran « Suivi des montées » ne pouvait pas dire si un
 * enfant était monté dans le car ou en était descendu : l'information existait
 * dans le flux BioTime (`punch_state`) mais n'était jamais conservée.
 */
export class AddSensToMontees1721140000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'montees_sens_enum') THEN
          CREATE TYPE "public"."montees_sens_enum" AS ENUM('montee', 'descente');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "montees"
      ADD COLUMN IF NOT EXISTS "sens" "public"."montees_sens_enum" NOT NULL DEFAULT 'montee';
    `);

    // Historique le plus consulté : les pointages du jour, par sens.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_montees_date_sens" ON "montees" ("date" DESC, "sens");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_montees_date_sens"`);
    await queryRunner.query(
      `ALTER TABLE "montees" DROP COLUMN IF EXISTS "sens"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."montees_sens_enum"`);
  }
}
