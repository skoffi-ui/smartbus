import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantSchemaVersion1721140000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`
        CREATE TYPE "public"."tenant_schema_versions_status_enum" AS ENUM('pending', 'success', 'failed', 'rolled_back');
      `);

      await queryRunner.query(`
        CREATE TABLE "tenant_schema_versions" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "created_by" uuid,
          "updated_by" uuid,
          "created_by_type" character varying(50),
          "updated_by_type" character varying(50),
          "last_modified_source" character varying(50),
          "organisation_id" uuid NOT NULL,
          "migration_name" character varying(255) NOT NULL,
          "migration_version" integer NOT NULL,
          "checksum" character varying(255) NOT NULL,
          "status" "public"."tenant_schema_versions_status_enum" NOT NULL DEFAULT 'pending',
          "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
          "completed_at" TIMESTAMP WITH TIME ZONE,
          "execution_time_ms" integer,
          CONSTRAINT "PK_tenant_schema_versions" PRIMARY KEY ("id")
        );
      `);

      await queryRunner.query(`
        ALTER TABLE "tenant_schema_versions" ADD CONSTRAINT "FK_tenant_schema_versions_organisation" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
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
      await queryRunner.query(`ALTER TABLE "tenant_schema_versions" DROP CONSTRAINT "FK_tenant_schema_versions_organisation"`);
      await queryRunner.query(`DROP TABLE "tenant_schema_versions"`);
      await queryRunner.query(`DROP TYPE "public"."tenant_schema_versions_status_enum"`);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
