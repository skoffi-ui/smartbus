import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grille tarifaire — voir `PlanTarif`. Seed des 5 forfaits (l'enum
 * `SubscriptionPlan` est fixe, jamais de 6e ligne à créer) avec les mêmes
 * plafonds de véhicules déjà utilisés dans super-admin-web/Subscriptions.tsx
 * et des prix de départ, à ajuster par le Super Admin (c'est justement le
 * but de cette table).
 */
export class CreatePlanTarifs1727700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "plan_tarifs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_by" uuid, "updated_by" uuid,
        "created_by_type" VARCHAR(50), "updated_by_type" VARCHAR(50),
        "last_modified_source" VARCHAR(50),
        "plan" "subscriptions_plan_enum" NOT NULL,
        "label" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "price_per_month" DECIMAL(10,2) NOT NULL,
        "max_cars" INTEGER NOT NULL,
        "max_children" INTEGER,
        CONSTRAINT "PK_plan_tarifs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_plan_tarifs_plan" UNIQUE ("plan")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "plan_tarifs" ("plan", "label", "description", "price_per_month", "max_cars", "max_children")
      VALUES
        ('starter', 'Démarrage', 'Jusqu''à 2 véhicules', 50000, 2, NULL),
        ('basic', 'Basique', 'Jusqu''à 5 véhicules', 90000, 5, NULL),
        ('standard', 'Standard', 'Jusqu''à 15 véhicules', 180000, 15, NULL),
        ('premium', 'Premium', 'Jusqu''à 30 véhicules', 320000, 30, NULL),
        ('enterprise', 'Entreprise', 'Illimité', 500000, 999, NULL)
      ON CONFLICT ("plan") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "plan_tarifs"`);
  }
}
