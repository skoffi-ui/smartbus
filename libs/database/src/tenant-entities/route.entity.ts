import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Car } from './car.entity';

/**
 * Type de trajet
 */
export enum RouteType {
  MORNING = 'morning',   // Aller (domicile → école)
  EVENING = 'evening',   // Retour (école → domicile)
  CUSTOM = 'custom',     // Trajet personnalisé
}

/**
 * Entité Route – trajet défini avec ses points d'arrêt.
 */
@Entity('routes')
export class Route extends BaseEntityModel {
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: RouteType, default: RouteType.MORNING })
  type: RouteType;

  @ManyToOne(() => Car, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'car_id' })
  car: Car;

  @Column({ name: 'car_id', nullable: true })
  carId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Durée estimée en minutes
  @Column({ name: 'estimated_duration_minutes', nullable: true })
  estimatedDurationMinutes: number;

  // Distance en km
  @Column({ name: 'distance_km', type: 'decimal', precision: 8, scale: 2, nullable: true })
  distanceKm: number;
}

/**
 * Entité Stop – point d'arrêt sur un trajet.
 */
@Entity('stops')
export class Stop extends BaseEntityModel {
  @ManyToOne(() => Route, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @Column({ name: 'route_id' })
  routeId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  // Ordre du point d'arrêt dans le trajet
  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  // Heure de passage estimée
  @Column({ name: 'scheduled_time', nullable: true })
  scheduledTime: string;
}
