import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  obtenirCleChiffrementDepuisEnv,
  chiffrerAvecCle,
  dechiffrerAvecCle,
  emballerSecret,
  deballerSecret,
} from '@app/common/crypto/secret-crypto.util';

/**
 * Chiffre au repos les `organisations.db_password` existants (voir
 * `OrganisationDbPasswordTransformer`, qui chiffre/déchiffre désormais de
 * façon transparente à chaque lecture/écriture via l'entité `Organisation`).
 * Sans cette migration, les lignes déjà écrites avant ce changement restent
 * en clair — le transformer les lit sans erreur (repli `from()`), mais elles
 * ne sont pas protégées jusqu'à ce que cette migration les rechiffre une
 * fois.
 *
 * `ENCRYPTION_KEY` doit être présente dans l'environnement pour exécuter
 * cette migration — jamais de repli silencieux qui laisserait un mot de
 * passe de connexion Postgres en clair.
 */
export class EncryptOrganisationDbPassword1727500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const cle = obtenirCleChiffrementDepuisEnv();

    const lignes: Array<{ id: string; db_password: string | null }> = await queryRunner.query(
      `SELECT id, db_password FROM organisations WHERE db_password IS NOT NULL`,
    );

    for (const ligne of lignes) {
      if (deballerSecret(ligne.db_password!)) continue; // déjà chiffré (migration rejouée)
      const chiffre = emballerSecret(chiffrerAvecCle(ligne.db_password!, cle));
      await queryRunner.query(`UPDATE organisations SET db_password = $1 WHERE id = $2`, [chiffre, ligne.id]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cle = obtenirCleChiffrementDepuisEnv();

    const lignes: Array<{ id: string; db_password: string | null }> = await queryRunner.query(
      `SELECT id, db_password FROM organisations WHERE db_password IS NOT NULL`,
    );

    for (const ligne of lignes) {
      const secret = deballerSecret(ligne.db_password!);
      if (!secret) continue; // déjà en clair
      const clair = dechiffrerAvecCle(secret, cle);
      await queryRunner.query(`UPDATE organisations SET db_password = $1 WHERE id = $2`, [clair, ligne.id]);
    }
  }
}
