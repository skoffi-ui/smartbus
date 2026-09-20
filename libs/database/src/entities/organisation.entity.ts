import {
  Entity,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { Subscription } from './subscription.entity';

/**
 * Enumération des statuts d'une organisation
 */
export enum OrganisationStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TRIAL = 'trial',
  PENDING = 'pending',
}

/** Statuts autorisés à utiliser l'APP école (une école neuve est en essai gratuit). */
export const TENANT_ACCESS_STATUSES: readonly OrganisationStatus[] = [
  OrganisationStatus.ACTIVE,
  OrganisationStatus.TRIAL,
];

/**
 * Entité Organisation – représente un établissement scolaire ou un groupe.
 * Contient la configuration de la base de données dédiée.
 */
@Entity('organisations')
export class Organisation extends BaseEntityModel {
  @Column({ length: 255 })
  name: string;

  @Column({ name: 'code', length: 50, unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true, name: 'phone' })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true, name: 'logo_url' })
  logoUrl: string;

  @Column({
    type: 'enum',
    enum: OrganisationStatus,
    default: OrganisationStatus.TRIAL,
  })
  status: OrganisationStatus;

  // ---- Configuration base de données dédiée ----
  @Column({ name: 'db_name', nullable: true })
  dbName: string;

  @Column({ name: 'db_host', nullable: true, default: 'localhost' })
  dbHost: string;

  @Column({ name: 'db_port', nullable: true, default: 5432 })
  dbPort: number;

  @Column({ name: 'db_user', nullable: true })
  dbUser: string;

  @Column({ name: 'db_password', nullable: true, select: false })
  dbPassword: string;

  @Column({ name: 'db_provisioned', default: false })
  dbProvisioned: boolean;

  // ---- Relation vers les abonnements ----
  @OneToMany(() => Subscription, (sub) => sub.organisation)
  subscriptions: Subscription[];
}
