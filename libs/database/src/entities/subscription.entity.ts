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

  @Column({
    name: 'price_per_month',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  pricePerMonth: number;

  @Column({ name: 'max_cars', default: 2 })
  maxCars: number;

  @Column({ name: 'max_children', nullable: true })
  maxChildren: number;

  @Column({ name: 'auto_renew', default: true })
  autoRenew: boolean;
}
