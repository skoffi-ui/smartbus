import {
  Entity,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { Subscription } from './subscription.entity';
import { BiotimeTerminal } from './biotime-terminal.entity';

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

  // ---- Configuration BioTime (Serveur Central) ----
  @Column({ name: 'biotime_server_url', nullable: true })
  biotimeServerUrl: string;

  @Column({ name: 'biotime_username', nullable: true })
  biotimeUsername: string;

  @Column({ name: 'biotime_password', nullable: true, select: false })
  biotimePassword: string;

  /**
   * ID du département BioTime assigné à cette organisation
   * Chaque organisation = 1 département sur le serveur BioTime central
   * Utilisé pour isoler les données (élèves, pointages) par école
   */
  @Column({ name: 'biotime_department_id', type: 'int', nullable: true })
  biotimeDepartmentId: number;

  @Column({ name: 'biotime_department_name', nullable: true })
  biotimeDepartmentName: string;

  // ---- Relation vers les terminaux BioTime ----
  @OneToMany(() => BiotimeTerminal, terminal => terminal.organisation)
  biotimeTerminals: BiotimeTerminal[];

  // ---- Relation vers les abonnements ----
  @OneToMany(() => Subscription, (sub) => sub.organisation)
  subscriptions: Subscription[];
}
