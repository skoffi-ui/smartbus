import { Entity, Column, OneToMany } from 'typeorm';
import { SoftDeleteEntityModel } from '../entities/base.entity';
import { PointRecuperation } from './point-recuperation.entity';
import { Course } from './course.entity';

export enum TrajetSens {
  ALLER = 'aller', // Domicile → École
  RETOUR = 'retour', // École → Domicile
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

  @Column({
    name: 'duree_estimative',
    type: 'int',
    nullable: true,
    comment: 'Durée estimée du trajet en minutes (OSRM)',
  })
  dureeEstimative: number;

  @Column({
    name: 'distance_km',
    type: 'float',
    nullable: true,
    comment: 'Distance totale calculée (OSRM)',
  })
  distanceKm: number;

  @Column({
    name: 'heure_depart',
    type: 'varchar',
    length: 5,
    nullable: true,
    comment: 'Heure de départ du trajet (format HH:mm)',
  })
  heureDepart: string;

  // Stockage du GeoJSON complet (Ligne générée par OSRM)
  @Column({ type: 'jsonb', nullable: true })
  geoJson: any;

  // Stockage des points de passage clés (Départ, Arrivée, Étapes) cliqués par l'utilisateur
  @Column({ type: 'jsonb', nullable: true })
  waypoints: any[];

  // Relations
  @OneToMany(() => PointRecuperation, (point) => point.trajet)
  points: PointRecuperation[];

  @OneToMany(() => Course, (course) => course.trajet)
  courses: Course[];
}
