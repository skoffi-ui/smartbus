import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TD-001 — invalide toutes les sessions au déploiement.
 *
 * Les refresh tokens déjà en base sont des empreintes bcrypt. bcrypt ne
 * retient que les 72 premiers octets du jeton, et la signature n'était pas
 * vérifiée : ces empreintes ne prouvent pas la possession d'un jeton signé.
 * Le code ne les compare plus (il attend un SHA-256 hexadécimal). Les effacer
 * force une reconnexion ; aucun ancien jeton ne reste accepté.
 *
 * Irréversible : les empreintes bcrypt ne sont pas conservées.
 */
export class InvalidateRefreshTokens1728000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      COMMENT ON COLUMN "users"."refresh_token" IS
        'Empreinte SHA-256 (hex) du refresh token courant. NULL = session révoquée. Les empreintes bcrypt antérieures ont été effacées (TD-001).'
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "refresh_token" = NULL
      WHERE "refresh_token" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Les jetons invalidés ne sont pas restaurables.
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."refresh_token" IS NULL`,
    );
  }
}
