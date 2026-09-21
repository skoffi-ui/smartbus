import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration : Ajout de la colonne `type` à la table `points_recuperation`
 *
 * Cette colonne permet à l'utilisateur de choisir explicitement le type de marqueur
 * (départ, arrêt, arrivée) plutôt que de le déduire automatiquement de la position.
 *
 * Date : 2026-09-21
 */
export class AddTypeToPointRecuperation1726907400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajouter la colonne type avec une valeur par défaut
    await queryRunner.addColumn(
      'points_recuperation',
      new TableColumn({
        name: 'type',
        type: 'varchar',
        length: '10',
        isNullable: true,
        default: "'arret'",
        comment: 'Type de point: depart, arret, ou arrivee',
      }),
    );

    // Mettre à jour les points existants avec un type basé sur leur position
    // (Pour la rétrocompatibilité)
    await queryRunner.query(`
      WITH point_positions AS (
        SELECT
          id,
          trajet_id,
          ROW_NUMBER() OVER (PARTITION BY trajet_id ORDER BY ordre_passage) as position,
          COUNT(*) OVER (PARTITION BY trajet_id) as total_points
        FROM points_recuperation
        WHERE type IS NULL
      )
      UPDATE points_recuperation pr
      SET type = CASE
        WHEN pp.position = 1 THEN 'depart'
        WHEN pp.position = pp.total_points THEN 'arrivee'
        ELSE 'arret'
      END
      FROM point_positions pp
      WHERE pr.id = pp.id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer la colonne type
    await queryRunner.dropColumn('points_recuperation', 'type');
  }
}
