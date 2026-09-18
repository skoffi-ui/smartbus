import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFcmTokenToParents1721140000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`
        ALTER TABLE "parents" 
        ADD COLUMN IF NOT EXISTS "fcm_token" character varying(500)
      `);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`
        ALTER TABLE "parents" 
        DROP COLUMN IF EXISTS "fcm_token"
      `);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
