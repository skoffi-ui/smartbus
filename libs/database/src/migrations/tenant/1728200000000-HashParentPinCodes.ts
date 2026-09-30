import { MigrationInterface, QueryRunner } from 'typeorm';
import { rehasherPinsParents } from '../../tenant-pin/rehasher-pins-parents';

/**
 * Re-hashe les PIN parents encore en clair (bcrypt, coût 12).
 * Irréversible : `down` ne peut pas retrouver le PIN.
 *
 * Ce fichier n'exporte que la classe : TypeORM instancie chaque export
 * du dossier des migrations.
 */
export class HashParentPinCodes1728200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // varchar(4) ne peut pas contenir un hash bcrypt (60 caractères).
    await queryRunner.query(
      `ALTER TABLE "parents" ALTER COLUMN "pin_code" TYPE character varying(255)`,
    );
    await rehasherPinsParents((sql, parameters) =>
      queryRunner.query(sql, parameters),
    );
  }

  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'HashParentPinCodes1728200000000 est irréversible : un hash bcrypt ne permet pas de retrouver le PIN en clair.',
      ),
    );
  }
}
