import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Auto-inscription des directeurs : un compte s'inscrit lui-même (statut
 * `pending`) puis le Super Admin l'active — `activated_at` distingue la date
 * d'inscription (`created_at`, déjà existant) de la date d'activation.
 *
 * Gestion d'équipe déléguée : une fois son école créée, un directeur peut
 * inviter des collaborateurs seulement si le Super Admin l'y autorise pour
 * cette école (`allow_additional_directors`, par défaut désactivé).
 */
export class AddDirectorActivationAndTeamDelegation1727200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "activated_at" timestamptz
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."activated_at" IS
        'Date à laquelle le Super Admin a activé ce compte directeur (distincte de created_at, la date d''inscription).'
    `);

    await queryRunner.query(`
      ALTER TABLE "organisations"
      ADD COLUMN IF NOT EXISTS "allow_additional_directors" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "organisations"."allow_additional_directors" IS
        'Autorise le directeur de cette école à créer des comptes directeur supplémentaires pour ses collaborateurs. Accordé par le Super Admin.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organisations"
      DROP COLUMN IF EXISTS "allow_additional_directors"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "activated_at"
    `);
  }
}
