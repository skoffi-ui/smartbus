import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { Subscription } from './subscription.entity';
import { BiotimeTerminal } from './biotime-terminal.entity';
import { OrganisationDbPasswordTransformer } from './organisation-db-password.transformer';

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

  /**
   * Chiffré au repos (AES-256-GCM, voir `OrganisationDbPasswordTransformer`) :
   * ce mot de passe ouvre la connexion Postgres de l'école, et une lecture de
   * cette table ne doit jamais l'exposer en clair. `select: false` reste en
   * plus, en défense en profondeur (ne sort pas par défaut d'une requête).
   */
  @Column({
    name: 'db_password',
    nullable: true,
    select: false,
    transformer: OrganisationDbPasswordTransformer,
  })
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

  /**
   * Permissions par école : clés de fonctionnalités school-web (voir
   * `@app/common` SCHOOL_FEATURES) que le directeur de cette organisation
   * peut utiliser. NULL = aucune restriction (toutes les écoles existantes).
   * Assigné par le Super Admin depuis super-admin-web.
   */
  @Column({ name: 'allowed_features', type: 'jsonb', nullable: true })
  allowedFeatures: string[] | null;

  /**
   * Autorise le directeur de cette école à créer des comptes directeur
   * supplémentaires pour ses collaborateurs (voir UsersService.createDirector,
   * UsersService.toggleStatus). Par défaut désactivé — accordé par le Super
   * Admin, école par école, une fois l'école créée.
   */
  @Column({ name: 'allow_additional_directors', default: false })
  allowAdditionalDirectors: boolean;

  // ---- Relation vers les terminaux BioTime ----
  @OneToMany(() => BiotimeTerminal, (terminal) => terminal.organisation)
  biotimeTerminals: BiotimeTerminal[];

  // ---- Relation vers les abonnements ----
  @OneToMany(() => Subscription, (sub) => sub.organisation)
  subscriptions: Subscription[];
}
