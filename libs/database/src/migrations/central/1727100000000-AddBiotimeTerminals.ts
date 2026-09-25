import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBiotimeTerminals1727100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Création de la table biotime_terminals (idempotent)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "biotime_terminals" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "serial_number" varchar NOT NULL UNIQUE,
        "terminal_name" varchar NOT NULL,
        "biotime_terminal_id" integer,
        "ip_address" varchar,
        "model" varchar,
        "status" varchar DEFAULT 'INACTIVE' CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'ERROR')),
        "last_sync_at" timestamp,
        "organisation_id" uuid,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fk_biotime_terminals_organisation"
          FOREIGN KEY ("organisation_id")
          REFERENCES "organisations"("id")
          ON DELETE SET NULL
      )
    `);

    // Index pour les recherches fréquentes (idempotent)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_biotime_terminals_serial_number" ON "biotime_terminals"("serial_number")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_biotime_terminals_organisation" ON "biotime_terminals"("organisation_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_biotime_terminals_status" ON "biotime_terminals"("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_biotime_terminals_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_biotime_terminals_organisation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_biotime_terminals_serial_number"`);
    await queryRunner.query(`DROP TABLE "biotime_terminals"`);
  }
}
