import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Child } from './child.entity';
import { CourseExecution } from './course-execution.entity';
import { PointRecuperation } from './point-recuperation.entity';

/**
 * Type de pointage biométrique.
 * MONTEE = passage le matin (montée dans le bus)
 * DESCENTE = passage le soir (descente du bus)
 */
export enum PointageType {
  MONTEE = 'montee',
  DESCENTE = 'descente',
}

export enum PointageStatut {
  VALIDE = 'valide',
  REFUSE = 'refuse',
  ALERTE = 'alerte',
}

export enum PointageValidationType {
  BIOMETRIQUE = 'biometrique', // Via badgeuse BioTime
  MANUEL = 'manuel', // Saisie manuelle par chauffeur
  QR_CODE = 'qr_code', // Scan de QR Code
  CARTE_NFC = 'carte_nfc', // Carte NFC
}

/**
 * Pointage – Événement biométrique réel.
 * Anciennement "Montee". Enregistre chaque passage d'un enfant sur la badgeuse.
 * IMMUABLE : jamais supprimé, jamais modifié après insertion.
 */
@Entity('pointages')
export class Pointage extends BaseEntityModel {
  @ManyToOne(() => Child, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'child_id' })
  child: Child;

  @Column({ name: 'child_id' })
  childId: string;

  // Lien vers l'exécution réelle du trajet (contexte du jour)
  @ManyToOne(() => CourseExecution, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'course_execution_id' })
  courseExecution: CourseExecution;

  @Column({ name: 'course_execution_id', nullable: true })
  courseExecutionId: string;

  @ManyToOne(() => PointRecuperation, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'point_id' })
  point: PointRecuperation;

  @Column({ name: 'point_id', nullable: true })
  pointId: string;

  // Type de pointage (montée ou descente)
  @Column({ type: 'enum', enum: PointageType })
  type: PointageType;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'timestamptz' })
  heure: Date;

  // Identifiant unique de la transaction BioTime (anti-doublon)
  @Column({ name: 'biotime_punch_id', nullable: true, unique: true })
  biotimePunchId: string;

  @Column({
    name: 'distance_gps',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  distanceGps: number;

  @Column({
    type: 'enum',
    enum: PointageStatut,
    default: PointageStatut.VALIDE,
  })
  statut: PointageStatut;

  @Column({
    name: 'validation_type',
    type: 'enum',
    enum: PointageValidationType,
    default: PointageValidationType.BIOMETRIQUE,
  })
  validationType: PointageValidationType;

  @Column({ name: 'validation_message', type: 'text', nullable: true })
  validationMessage: string;

  // Flag de synchronisation (pour le mode offline tablette)
  @Column({ name: 'synced', type: 'boolean', default: true })
  synced: boolean;
}
