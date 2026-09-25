import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCarBiotimeTerminal1727100000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajouter une colonne pour la relation avec BiotimeTerminal
    await queryRunner.query(`
      ALTER TABLE "cars"
      ADD COLUMN IF NOT EXISTS "biotime_terminal_id" uuid
    `);

    // Contrainte de clé étrangère
    await queryRunner.query(`
      ALTER TABLE "cars"
      ADD CONSTRAINT "fk_cars_biotime_terminal"
      FOREIGN KEY ("biotime_terminal_id")
      REFERENCES "biotime_terminals"("id")
      ON DELETE SET NULL
    `);

    // Index
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cars_biotime_terminal"
      ON "cars"("biotime_terminal_id")
    `);

    // Migrer les anciennes données si biotimeTerminalSn existe
    await queryRunner.query(`
      UPDATE "cars" c
      SET "biotime_terminal_id" = bt.id
      FROM "biotime_terminals" bt
      WHERE c."biotime_terminal_sn" = bt."serial_number"
      AND c."biotime_terminal_sn" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cars_biotime_terminal"`);
    await queryRunner.query(`
      ALTER TABLE "cars"
      DROP CONSTRAINT IF EXISTS "fk_cars_biotime_terminal"
    `);
    await queryRunner.query(`
      ALTER TABLE "cars"
      DROP COLUMN IF EXISTS "biotime_terminal_id"
    `);
  }
}
