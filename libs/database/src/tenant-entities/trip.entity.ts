import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Route } from './route.entity';
import { Car } from './car.entity';
import { Driver } from './driver.entity';

/**
 * Statut d'une course
 */
export enum TripStatus {
  SCHEDULED = 'scheduled',     // Planifiée
  IN_PROGRESS = 'in_progress', // En cours
  COMPLETED = 'completed',     // Terminée
  CANCELLED = 'cancelled',     // Annulée
}

/**
 * Entité Trip – exécution d'un trajet (une course).
 */
@Entity('trips')
export class Trip extends BaseEntityModel {
  @ManyToOne(() => Route, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @Column({ name: 'route_id', nullable: true })
  routeId: string;

  @ManyToOne(() => Car, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'car_id' })
  car: Car;

  @Column({ name: 'car_id', nullable: true })
  carId: string;

  @ManyToOne(() => Driver, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ name: 'driver_id', nullable: true })
  driverId: string;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate: Date;

  @Column({ name: 'start_time', nullable: true, type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', nullable: true, type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.SCHEDULED })
  status: TripStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
