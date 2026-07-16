import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntityModel } from './base.entity';
import { Organisation } from './organisation.entity';

/**
 * Enumération des rôles système
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  SCHOOL_ADMIN = 'school_admin',
  DRIVER = 'driver',
  PARENT = 'parent',
  CHILD = 'child',
}

/**
 * Enumération des statuts d'un utilisateur
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

/**
 * Entité User – utilisateur du système SMARTBUS.
 * Tous les acteurs (admin, parent, chauffeur) sont des utilisateurs.
 */
@Entity('users')
export class User extends BaseEntityModel {
  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ name: 'phone_number', nullable: true, length: 20 })
  phoneNumber: string;

  @Column({ select: false })
  @Exclude()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PARENT,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ name: 'refresh_token', nullable: true, select: false })
  refreshToken: string;

  // ---- Champs pour la réinitialisation du mot de passe ----
  @Column({ name: 'reset_password_token', nullable: true, select: false })
  resetPasswordToken: string;

  @Column({ name: 'reset_password_expires', type: 'timestamp', nullable: true })
  resetPasswordExpires: Date;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  // Relation vers l'organisation (null pour super_admin)
  @ManyToOne(() => Organisation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'organisation_id', nullable: true })
  organisationId: string;

  // Getter pour le nom complet
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
