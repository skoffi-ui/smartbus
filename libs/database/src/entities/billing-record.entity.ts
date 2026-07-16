import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { Organisation } from './organisation.entity';

/**
 * Enumération des statuts de paiement
 */
export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/**
 * Enumération des méthodes de paiement
 */
export enum PaymentMethod {
  CARD = 'card',
  MOBILE_MONEY = 'mobile_money',
  BANK_TRANSFER = 'bank_transfer',
  CASH = 'cash',
}

/**
 * Entité BillingRecord – historique des paiements d'une organisation.
 */
@Entity('billing_records')
export class BillingRecord extends BaseEntityModel {
  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3, default: 'XOF' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.MOBILE_MONEY,
  })
  method: PaymentMethod;

  @Column({ name: 'transaction_id', nullable: true, unique: true })
  transactionId: string;

  @Column({ name: 'invoice_number', nullable: true, unique: true })
  invoiceNumber: string;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;
}
