import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseAStep2NewEntities1721140000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      // 1. Creation of `devices` table
      await queryRunner.query(`
        CREATE TABLE "devices" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "deleted_at" TIMESTAMP WITH TIME ZONE,
          "created_by" uuid,
          "updated_by" uuid,
          "created_by_type" character varying(50),
          "updated_by_type" character varying(50),
          "last_modified_source" character varying(50),
          "deleted_by" uuid,
          
          "serial_number" character varying NOT NULL,
          "mac_address" character varying,
          "model" character varying NOT NULL,
          "status" character varying NOT NULL DEFAULT 'INACTIVE',
          "last_sync_at" TIMESTAMP WITH TIME ZONE,
          
          CONSTRAINT "UQ_devices_serial_number" UNIQUE ("serial_number"),
          CONSTRAINT "PK_devices" PRIMARY KEY ("id")
        )
      `);

      // 2. Creation of `device_assignments` table
      await queryRunner.query(`
        CREATE TABLE "device_assignments" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "created_by" uuid,
          "updated_by" uuid,
          "created_by_type" character varying(50),
          "updated_by_type" character varying(50),
          "last_modified_source" character varying(50),
          
          "device_id" uuid NOT NULL,
          "car_id" uuid NOT NULL,
          "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL,
          "unassigned_at" TIMESTAMP WITH TIME ZONE,
          
          CONSTRAINT "PK_device_assignments" PRIMARY KEY ("id")
        )
      `);
      
      await queryRunner.query(`ALTER TABLE "device_assignments" ADD CONSTRAINT "FK_device_assignments_device_id" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
      await queryRunner.query(`ALTER TABLE "device_assignments" ADD CONSTRAINT "FK_device_assignments_car_id" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

      // 3. Creation of `biometric_consents` table
      await queryRunner.query(`
        CREATE TABLE "biometric_consents" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "created_by" uuid,
          "updated_by" uuid,
          "created_by_type" character varying(50),
          "updated_by_type" character varying(50),
          "last_modified_source" character varying(50),
          
          "child_id" uuid NOT NULL,
          "parent_user_id" uuid NOT NULL,
          "consent_given" boolean NOT NULL DEFAULT false,
          "legal_document_version" character varying(50) NOT NULL,
          "signed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
          "ip_address" character varying(45) NOT NULL,
          "revoked_at" TIMESTAMP WITH TIME ZONE,
          "revoked_reason" text,
          
          CONSTRAINT "PK_biometric_consents" PRIMARY KEY ("id")
        )
      `);
      
      await queryRunner.query(`ALTER TABLE "biometric_consents" ADD CONSTRAINT "FK_biometric_consents_child_id" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

      // 4. Creation of `course_executions` table
      await queryRunner.query(`
        CREATE TABLE "course_executions" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "created_by" uuid,
          "updated_by" uuid,
          "created_by_type" character varying(50),
          "updated_by_type" character varying(50),
          "last_modified_source" character varying(50),
          
          "course_id" uuid NOT NULL,
          "car_id" uuid NOT NULL,
          "driver_id" uuid NOT NULL,
          "execution_date" date NOT NULL,
          "status" character varying NOT NULL DEFAULT 'PLANNED',
          "started_at" TIMESTAMP WITH TIME ZONE,
          "ended_at" TIMESTAMP WITH TIME ZONE,
          
          CONSTRAINT "PK_course_executions" PRIMARY KEY ("id")
        )
      `);
      
      await queryRunner.query(`ALTER TABLE "course_executions" ADD CONSTRAINT "FK_course_executions_course_id" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
      await queryRunner.query(`ALTER TABLE "course_executions" ADD CONSTRAINT "FK_course_executions_car_id" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
      await queryRunner.query(`ALTER TABLE "course_executions" ADD CONSTRAINT "FK_course_executions_driver_id" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`ALTER TABLE "course_executions" DROP CONSTRAINT "FK_course_executions_driver_id"`);
      await queryRunner.query(`ALTER TABLE "course_executions" DROP CONSTRAINT "FK_course_executions_car_id"`);
      await queryRunner.query(`ALTER TABLE "course_executions" DROP CONSTRAINT "FK_course_executions_course_id"`);
      await queryRunner.query(`DROP TABLE "course_executions"`);

      await queryRunner.query(`ALTER TABLE "biometric_consents" DROP CONSTRAINT "FK_biometric_consents_child_id"`);
      await queryRunner.query(`DROP TABLE "biometric_consents"`);

      await queryRunner.query(`ALTER TABLE "device_assignments" DROP CONSTRAINT "FK_device_assignments_car_id"`);
      await queryRunner.query(`ALTER TABLE "device_assignments" DROP CONSTRAINT "FK_device_assignments_device_id"`);
      await queryRunner.query(`DROP TABLE "device_assignments"`);

      await queryRunner.query(`DROP TABLE "devices"`);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
