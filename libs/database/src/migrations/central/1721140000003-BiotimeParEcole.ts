import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Configuration BioTime par école, et cloisonnement du miroir central.
 *
 * Avant : une seule URL BioTime pour toute la plateforme (fichier sur disque) et
 * un seul couple d'identifiants (variables d'environnement). Impossible d'accueillir
 * un deuxième établissement, puisque chaque école héberge son propre serveur.
 *
 * Deux contraintes d'unicité globales bloquaient également le second client :
 *  - `super_app_children.emp_code` : les matricules repartent de 1 sur chaque
 *    serveur BioTime, donc la 2ᵉ école ne pouvait pas enregistrer ses enfants ;
 *  - `super_app_punches.biotime_punch_id` : les identifiants de transaction
 *    repartent aussi de 1, donc les pointages de la 2ᵉ école étaient pris pour
 *    des doublons et **silencieusement jetés**.
 */
export class BiotimeParEcole1721140000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Configuration BioTime par école ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "biotime_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisation_id" uuid NOT NULL,
        "url" character varying(500) NOT NULL,
        "username" character varying(255) NOT NULL,
        "password_ciphertext" text NOT NULL,
        "password_iv" character varying(64) NOT NULL,
        "password_tag" character varying(64) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_synced_punch_id" bigint,
        "last_synced_at" TIMESTAMP WITH TIME ZONE,
        "last_sync_count" integer,
        "last_error" text,
        "last_error_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "created_by_type" character varying(50),
        "updated_by_type" character varying(50),
        "last_modified_source" character varying(50),
        CONSTRAINT "PK_biotime_configs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_biotime_configs_organisation"
          FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_biotime_configs_organisation"
      ON "biotime_configs" ("organisation_id");
    `);

    // ── 2. super_app_children : rattachement à l'école ──
    await queryRunner.query(`
      ALTER TABLE "super_app_children" ADD COLUMN IF NOT EXISTS "organisation_id" uuid;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_super_app_children_organisation'
        ) THEN
          ALTER TABLE "super_app_children"
            ADD CONSTRAINT "FK_super_app_children_organisation"
            FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    // L'ancienne unicité globale du matricule doit disparaître, quel que soit
    // son nom généré (contrainte ou index selon l'historique de la base).
    await queryRunner.query(`
      DO $$
      DECLARE nom text;
      BEGIN
        FOR nom IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = '"super_app_children"'::regclass
            AND contype = 'u'
            AND pg_get_constraintdef(oid) = 'UNIQUE (emp_code)'
        LOOP
          EXECUTE format('ALTER TABLE "super_app_children" DROP CONSTRAINT %I', nom);
        END LOOP;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_super_app_children_org_emp"
      ON "super_app_children" ("organisation_id", "emp_code");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_super_app_children_organisation"
      ON "super_app_children" ("organisation_id");
    `);

    // ── 3. super_app_punches : rattachement à l'école ──
    await queryRunner.query(`
      ALTER TABLE "super_app_punches" ADD COLUMN IF NOT EXISTS "organisation_id" uuid;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_super_app_punches_organisation'
        ) THEN
          ALTER TABLE "super_app_punches"
            ADD CONSTRAINT "FK_super_app_punches_organisation"
            FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      DECLARE nom text;
      BEGIN
        FOR nom IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = '"super_app_punches"'::regclass
            AND contype = 'u'
            AND pg_get_constraintdef(oid) = 'UNIQUE (biotime_punch_id)'
        LOOP
          EXECUTE format('ALTER TABLE "super_app_punches" DROP CONSTRAINT %I', nom);
        END LOOP;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_super_app_punches_org_punch"
      ON "super_app_punches" ("organisation_id", "biotime_punch_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_super_app_punches_organisation"
      ON "super_app_punches" ("organisation_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_super_app_punches_organisation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_super_app_punches_org_punch"`);
    await queryRunner.query(
      `ALTER TABLE "super_app_punches" DROP CONSTRAINT IF EXISTS "FK_super_app_punches_organisation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_app_punches" DROP COLUMN IF EXISTS "organisation_id"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_super_app_children_organisation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_super_app_children_org_emp"`);
    await queryRunner.query(
      `ALTER TABLE "super_app_children" DROP CONSTRAINT IF EXISTS "FK_super_app_children_organisation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_app_children" DROP COLUMN IF EXISTS "organisation_id"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "biotime_configs"`);
  }
}
