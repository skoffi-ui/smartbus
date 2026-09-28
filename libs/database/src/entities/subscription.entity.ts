import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { Organisation } from './organisation.entity';

/**
 * Enumération des types d'abonnements
 */
export enum SubscriptionPlan {
  STARTER = 'starter',   // Jusqu'à 2 cars
  BASIC = 'basic',       // Jusqu'à 5 cars
  STANDARD = 'standard', // Jusqu'à 15 cars
  PREMIUM = 'premium',   // Jusqu'à 30 cars
  ENTERPRISE = 'enterprise', // Illimité
}

/**
 * Enumération des statuts d'abonnement
 */
export enum SubscriptionStatus {
  PENDING = 'pending', // En attente du premier paiement
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
  TRIAL = 'trial',
}

/**
 * Entité Subscription – abonnement d'une organisation à SMARTBUS.
 */
@Entity('subscriptions')
export class Subscription extends BaseEntityModel {
  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.STARTER,
  })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIAL,
  })
  status: SubscriptionStatus;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  // `transformer` : une colonne `decimal` revient de Postgres/pg en chaîne
  // ("50000.00", pas le nombre 50000) — sans conversion, ça casse
  // silencieusement `sub.pricePerMonth.toLocaleString()` (super-admin-web/
  // Subscriptions.tsx, apps/school-web/Abonnement.tsx) et toute validation
  // `@IsNumber()` sur une valeur relue puis renvoyée telle quelle.
  @Column({
    name: 'price_per_month',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: { to: (v: number) => v, from: (v: string | null) => (v === null ? null : parseFloat(v)) },
  })
  pricePerMonth: number;

  @Column({ name: 'max_cars', default: 2 })
  maxCars: number;

  @Column({ name: 'max_children', nullable: true })
  maxChildren: number;

  @Column({ name: 'auto_renew', default: true })
  autoRenew: boolean;
}
