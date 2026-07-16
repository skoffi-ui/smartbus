import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Trip } from './trip.entity';

@Entity('drivers')
export class Driver extends BaseEntityModel {
  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ length: 20, unique: true })
  phone: string;

  @Column({ name: 'license_number', length: 50, unique: true })
  licenseNumber: string;

  @Column({ name: 'license_expiry', type: 'date', nullable: true })
  licenseExpiry: Date;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ default: true })
  active: boolean;

  // Un chauffeur peut avoir plusieurs trajets
  // On ne met pas de relation forte obligatoire pour l'instant
}
