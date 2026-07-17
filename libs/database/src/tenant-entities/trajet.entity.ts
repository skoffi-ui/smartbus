import { Entity, Column, OneToMany } from 'typeorm';
import { SoftDeleteEntityModel } from '../entities/base.entity';
import { PointRecuperation } from './point-recuperation.entity';
import { Course } from './course.entity';

export enum TrajetSens {
  ALLER = 'aller',    // Domicile → École
  RETOUR = 'retour',  // École → Domicile
  MIXTE = 'mixte',
}

/**
 * Trajet – Parcours géographique théorique.
 * Un trajet est le gabarit géographique d'une ou plusieurs courses.
 * La relation est : Course -> Trajet (Trajet est indépendant).
 */
@Entity('trajets')
export class Trajet extends SoftDeleteEntityModel {
  @Column({ length: 255 })
  nom: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: TrajetSens, default: TrajetSens.ALLER })
  sens: TrajetSens;

  @Column({ name: 'duree_estimative', type: 'int', nullable: true, comment: 'Durée estimée du trajet en minutes' })
  dureeEstimative: number;

  // Stockage du GeoJSON complet (Polyline Leaflet.draw)
  @Column({ type: 'jsonb', nullable: true })
  geoJson: any;

  // Relations
  @OneToMany(() => PointRecuperation, (point) => point.trajet)
  points: PointRecuperation[];

  @OneToMany(() => Course, (course) => course.trajet)
  courses: Course[];
}
