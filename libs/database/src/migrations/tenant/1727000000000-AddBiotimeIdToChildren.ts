import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBiotimeIdToChildren1727000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "biotime_id" integer`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        CREATE TYPE "biotime_sync_status_enum" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'NOT_CONFIGURED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$`,
    );
    await queryRunner.query(
      `ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "biotime_sync_status" "biotime_sync_status_enum" DEFAULT 'NOT_CONFIGURED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "biotime_sync_error" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "children" DROP COLUMN IF EXISTS "biotime_sync_error"`,
    );
    await queryRunner.query(
      `ALTER TABLE "children" DROP COLUMN IF EXISTS "biotime_sync_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "children" DROP COLUMN IF EXISTS "biotime_id"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "biotime_sync_status_enum"`,
    );
  }
}
