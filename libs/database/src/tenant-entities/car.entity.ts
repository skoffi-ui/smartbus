import { Entity, Column, ManyToMany, JoinTable, ManyToOne, JoinColumn } from 'typeorm';
import { SoftDeleteEntityModel } from '../entities/base.entity';
import { Child } from './child.entity';

/**
 * Entité Car – véhicule du parc automobile d'un établissement.
 */
@Entity('cars')
export class Car extends SoftDeleteEntityModel {
  @Column({ name: 'plate_number', unique: true, length: 20 })
  plateNumber: string;

  @Column({ length: 100 })
  brand: string;

  @Column({ length: 100 })
  model: string;

  @Column({ nullable: true })
  year: number;

  @Column({ name: 'capacity', default: 30 })
  capacity: number;

  @Column({ name: 'photo_url', nullable: true })
  photoUrl: string;

  @Column({ name: 'gps_device_id', nullable: true })
  gpsDeviceId: string;

  @Column({ name: 'biotime_terminal_sn', nullable: true })
  biotimeTerminalSn: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'insurance_expiry', type: 'date', nullable: true })
  insuranceExpiry: Date;

  @Column({ name: 'technical_inspection_expiry', type: 'date', nullable: true })
  technicalInspectionExpiry: Date;
}
