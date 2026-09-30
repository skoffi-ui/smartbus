import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Course } from './course.entity';
import { Child } from './child.entity';

/**
 * Type d'événement biométrique
 */
export enum BiometricEventType {
  BOARDING = 'boarding', // Montée dans le car
  ALIGHTING = 'alighting', // Descente du car
}

/**
 * Entité BiometricEvent – événement de scan biométrique d'un enfant.
 * Enregistré chaque fois qu'un enfant monte ou descend du car.
 */
@Entity('biometric_events')
export class BiometricEvent extends BaseEntityModel {
  // Nullable : un badgeage peut survenir sans course identifiée (badgeuse non
  // rattachée à un car, aucune course active, badgeuse fixe à l'école). La trace
  // doit exister malgré tout — ce sont précisément les cas à auditer.
  @ManyToOne(() => Course, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column({ name: 'course_id', nullable: true })
  courseId: string;

  @ManyToOne(() => Child, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'child_id' })
  child: Child;

  @Column({ name: 'child_id', nullable: true })
  childId: string;

  @Column({ type: 'enum', enum: BiometricEventType })
  type: BiometricEventType;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  // Position GPS lors du scan
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  // Nom de l'arrêt associé
  @Column({ name: 'stop_name', nullable: true })
  stopName: string;

  // Indique si la notification a été envoyée aux parents
  @Column({ name: 'notification_sent', default: false })
  notificationSent: boolean;

  // Confiance de la reconnaissance biométrique (0-100%)
  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  confidenceScore: number;
}
