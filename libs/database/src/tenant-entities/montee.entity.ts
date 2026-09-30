import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Child } from './child.entity';
import { Course } from './course.entity';
import { Car } from './car.entity';
import { PointRecuperation } from './point-recuperation.entity';

export enum MonteeStatut {
  VALIDE = 'valide',
  REFUSE = 'refuse',
}

/** Sens du pointage : l'enfant monte dans le car, ou en descend. */
export enum SensPointage {
  MONTEE = 'montee',
  DESCENTE = 'descente',
}

/**
 * Codes `punch_state` de BioTime / ZKTeco signifiant une SORTIE.
 * Convention ZKTeco : 0 Check-In, 1 Check-Out, 2 Break-Out, 3 Break-In, 4 OT-In, 5 OT-Out.
 */
const PUNCH_STATES_SORTIE = new Set(['1', '2', '5']);

/**
 * Traduit le `punch_state` de BioTime en sens métier.
 *
 * Source unique de cette conversion : elle était auparavant dupliquée, avec des
 * règles divergentes, entre le traitement du flux et les notifications parents.
 */
export function sensFromPunchState(
  punchState?: string | number | null,
): SensPointage {
  const code =
    punchState === null || punchState === undefined
      ? '0'
      : String(punchState).trim();
  return PUNCH_STATES_SORTIE.has(code)
    ? SensPointage.DESCENTE
    : SensPointage.MONTEE;
}

@Entity('montees')
export class Montee extends BaseEntityModel {
  @ManyToOne(() => Child, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'child_id' })
  child: Child;

  @Column({ name: 'child_id' })
  childId: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column({ name: 'course_id' })
  courseId: string;

  @ManyToOne(() => Car, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'car_id' })
  car: Car;

  @Column({ name: 'car_id', nullable: true })
  carId: string;

  @ManyToOne(() => PointRecuperation, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'point_id' })
  point: PointRecuperation;

  @Column({ name: 'point_id', nullable: true })
  pointId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'time' })
  heure: string;

  @Column({
    name: 'distance_gps',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  distanceGps: number;

  @Column({ type: 'enum', enum: SensPointage, default: SensPointage.MONTEE })
  sens: SensPointage;

  @Column({ type: 'enum', enum: MonteeStatut, default: MonteeStatut.VALIDE })
  statut: MonteeStatut;

  @Column({ type: 'text', nullable: true })
  validationMessage: string;
}
