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

  @OneToMany(() => Affectation, (affectation) => affectation.pointRecuperation)
  affectations: Affectation[];
}
