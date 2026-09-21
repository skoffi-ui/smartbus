import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Trajet } from './trajet.entity';
import { Affectation } from './affectation.entity';

@Entity('points_recuperation')
export class PointRecuperation extends BaseEntityModel {
  @ManyToOne(() => Trajet, (trajet) => trajet.points, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trajet_id' })
  trajet: Trajet;

  @Column({ name: 'trajet_id' })
  trajetId: string;

  @Column({ length: 255 })
  nom: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ name: 'ordre_passage', default: 0 })
  ordrePassage: number;

  @Column({ name: 'temps_arret', nullable: true })
  tempsArret: string;

  @Column({ type: 'text', nullable: true })
  commentaire: string;

  /**
   * Tolérance GPS de cet arrêt, en mètres.
   *
   * La colonne manquait alors que l'API l'acceptait et que la validation des
   * montées la lisait : la valeur était silencieusement jetée et la tolérance
   * retombait systématiquement à 30 m. Un GPS embarqué dérive couramment de 20
   * à 50 m en ville, d'où des refus « hors zone » injustifiés.
   */
  @Column({ name: 'rayon_detection', type: 'int', default: 100 })
  rayonDetection: number;

  /**
   * Type de point : départ, arrêt intermédiaire, ou arrivée.
   *
   * Permet à l'utilisateur de choisir explicitement le type de marqueur
   * à afficher sur la carte (vert pour départ, bleu pour arrêt, rouge pour arrivée).
   * Nullable pour la rétrocompatibilité avec les points existants.
   */
  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    default: 'arret',
    comment: 'Type de point: depart, arret, ou arrivee'
  })
  type: string;

  @OneToMany(() => Affectation, (affectation) => affectation.pointRecuperation)
  affectations: Affectation[];
}
