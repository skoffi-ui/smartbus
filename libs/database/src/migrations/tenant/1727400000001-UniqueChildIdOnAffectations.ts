import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant Migration : contrainte UNIQUE sur `affectations.child_id`.
 *
 * `AffectationsService.create()` vérifiait déjà "un seul point par enfant"
 * en applicatif (recherche puis insertion) mais sans contrainte en base —
 * une vérification-puis-écriture non atomique, donc deux requêtes
 * concurrentes pour le même enfant pouvaient toutes les deux passer la
 * vérification avant qu'aucune n'ait validé, produisant deux affectations
 * pour le même enfant malgré l'invariant documenté. Vérifié au préalable
 * (bases réelles) : aucun doublon existant, la contrainte s'applique donc
 * sans nettoyage préalable.
 */
export class UniqueChildIdOnAffectations1727400000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "affectations" ADD CONSTRAINT "UQ_affectations_child_id" UNIQUE ("child_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "affectations" DROP CONSTRAINT "UQ_affectations_child_id"`,
    );
  }
}
