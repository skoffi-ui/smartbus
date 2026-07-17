import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { SoftDeleteEntityModel } from '../entities/base.entity';
import { Trajet } from './trajet.entity';

export enum CourseStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum CourseType {
  MATIN = 'matin',       // Trajet Aller
  SOIR = 'soir',         // Trajet Retour
  MIDI = 'midi',
  SPECIAL = 'special',
}

/**
 * Course – Tournée planifiée régulière.
 * Référence un Trajet géographique et définit l'horaire théorique.
 * L'affectation réelle (chauffeur/bus) se fait via CourseExecution.
 */
@Entity('courses')
export class Course extends SoftDeleteEntityModel {
  @Column({ length: 255 })
  nom: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Lien vers le gabarit géographique
  @ManyToOne(() => Trajet, (trajet) => trajet.courses, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trajet_id' })
  trajet: Trajet;

  @Column({ name: 'trajet_id', nullable: true })
  trajetId: string;

  @Column({ type: 'enum', enum: CourseType, nullable: true })
  type: CourseType;

  @Column({ name: 'heure_depart', type: 'time', nullable: true })
  heureDepart: string;

  @Column({ name: 'heure_arrivee', type: 'time', nullable: true })
  heureArrivee: string;

  @Column({ type: 'jsonb', nullable: true })
  joursExecution: string[];

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.ACTIVE })
  statut: CourseStatus;

  @Column({ name: 'couleur_carte', length: 50, nullable: true })
  couleurCarte: string;

  // --- Champs legacy (compatibilité rétroactive, à supprimer en Phase B) ---
  @Column({ name: 'car_id', nullable: true, comment: 'Legacy - utiliser CourseExecution.carId' })
  carId: string;

  @Column({ name: 'driver_id', nullable: true, comment: 'Legacy - utiliser CourseExecution.driverId' })
  driverId: string;

  @Column({ length: 255, nullable: true, comment: 'Legacy - champ texte libre remplacé par driver_id' })
  chauffeur: string;

  @Column({ length: 255, nullable: true, comment: 'Legacy - ignoré en SaaS multi-tenant' })
  ecole: string;

  @Column({ type: 'jsonb', nullable: true, comment: 'Legacy - données brutes de carte' })
  route: any[];

  @Column({ type: 'jsonb', nullable: true, comment: 'Legacy - données brutes de marqueurs' })
  markers: any[];
}
