import { Entity, Column, OneToMany } from 'typeorm';
import { SoftDeleteEntityModel } from '../entities/base.entity';

export enum DriverStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

/**
 * Driver – Chauffeur de bus de l'établissement.
 */
@Entity('drivers')
export class Driver extends SoftDeleteEntityModel {
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

  @Column({ name: 'photo_url', type: 'varchar', nullable: true })
  photoUrl: string;

  // PIN hashé (bcrypt) pour authentification sur la tablette
  @Column({
    name: 'pin_code_hash',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  pinCodeHash: string;

  @Column({ type: 'enum', enum: DriverStatus, default: DriverStatus.ACTIVE })
  status: DriverStatus;

  // Champ legacy – à conserver pour rétrocompatibilité
  @Column({ default: true })
  active: boolean;
}
