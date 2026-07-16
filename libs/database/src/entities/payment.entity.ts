import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { Organisation } from './organisation.entity';
import { Subscription } from './subscription.entity';

export enum SandboxPaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum SandboxPaymentMethod {
  SANDBOX_CARD = 'sandbox_card',
  SANDBOX_MOBILE = 'sandbox_mobile',
  CREDIT_CARD = 'credit_card',
  MOBILE_MONEY = 'mobile_money',
}

@Entity('payments')
export class Payment extends BaseEntityModel {
  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;

  @Column({ name: 'subscription_id' })
  subscriptionId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'FCFA' })
  currency: string;

  @Column({
    type: 'enum',
    enum: SandboxPaymentStatus,
    default: SandboxPaymentStatus.PENDING,
  })
  status: SandboxPaymentStatus;

  @Column({
    type: 'enum',
    enum: SandboxPaymentMethod,
    default: SandboxPaymentMethod.SANDBOX_CARD,
  })
  method: SandboxPaymentMethod;

  @Column({ name: 'external_reference', nullable: true })
  externalReference: string; // Ex: Numéro de transaction Stripe ou Wave
}
