import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Child } from './child.entity';

@Entity('biometric_consents')
export class BiometricConsent extends BaseEntityModel {
  @ManyToOne(() => Child)
  @JoinColumn({ name: 'child_id' })
  child: Child;

  @Column({ name: 'child_id', type: 'uuid' })
  childId: string;

  // Référence logique vers la base centrale smartbus_super.users
  @Column({ name: 'parent_user_id', type: 'uuid' })
  parentUserId: string;

  @Column({ name: 'consent_given', type: 'boolean', default: false })
  consentGiven: boolean;

  @Column({ name: 'legal_document_version', type: 'varchar', length: 50 })
  legalDocumentVersion: string;

  @Column({ name: 'signed_at', type: 'timestamptz' })
  signedAt: Date;

  @Column({ name: 'ip_address', type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date;

  @Column({ name: 'revoked_reason', type: 'text', nullable: true })
  revokedReason: string;
}
