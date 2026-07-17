import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditFieldsToTenantEntities1721140000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      // Liste de TOUTES les tables métier du domaine transport
      const tables = [
        'children', 'parents', 'drivers', 'cars', 'trajets', 'courses', 
        'points_recuperation', 'affectations', 'montees', 'alertes',
        'notifications'
      ];

      for (const table of tables) {
        // Validation que la table existe dans la DB courante (au cas où)
        const tableExists = await queryRunner.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = '${table}'
          );
        `);
        if (tableExists[0].exists) {
          // Ajout des colonnes BaseEntityModel sur TOUTES les tables
          await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "created_by" uuid DEFAULT NULL;`);
          await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "updated_by" uuid DEFAULT NULL;`);
          await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "created_by_type" character varying(50) DEFAULT NULL;`);
          await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "updated_by_type" character varying(50) DEFAULT NULL;`);
          await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "last_modified_source" character varying(50) DEFAULT NULL;`);
        }
      }

      // Liste des tables ressources (celles héritant de SoftDeleteEntityModel)
      const softDeleteTables = ['children', 'parents', 'drivers', 'cars', 'trajets', 'courses'];

      for (const table of softDeleteTables) {
        const tableExists = await queryRunner.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = '${table}'
          );
        `);
        if (tableExists[0].exists) {
          // Ajout des colonnes SoftDeleteEntityModel
          await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL;`);
          await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deleted_by" uuid DEFAULT NULL;`);
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      const tables = [
        'children', 'parents', 'drivers', 'cars', 'trajets', 'courses', 
        'points_recuperation', 'affectations', 'montees', 'alertes',
        'notifications'
      ];
      for (const table of tables) {
        const tableExists = await queryRunner.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = '${table}'
          );
        `);
        if (tableExists[0].exists) {
          await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "created_by";`);
          await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "updated_by";`);
          await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "created_by_type";`);
          await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "updated_by_type";`);
          await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "last_modified_source";`);
        }
      }

      const softDeleteTables = ['children', 'parents', 'drivers', 'cars', 'trajets', 'courses'];
      for (const table of softDeleteTables) {
        const tableExists = await queryRunner.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = '${table}'
          );
        `);
        if (tableExists[0].exists) {
          await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "deleted_at";`);
          await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "deleted_by";`);
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
