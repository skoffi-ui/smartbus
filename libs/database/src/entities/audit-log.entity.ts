import { Entity, Column } from 'typeorm';
import { BaseEntityModel } from './base.entity';

@Entity('audit_logs')
export class AuditLog extends BaseEntityModel {
  @Column({ name: 'user_id', nullable: true })
  userId: string; // L'ID de l'administrateur qui a fait l'action

  @Column({ length: 50 })
  action: string; // Ex: 'CREATE', 'UPDATE', 'DELETE', 'SUSPEND'

  @Column({ length: 100 })
  resource: string; // Ex: 'organisation', 'user', 'payment'

  @Column({ name: 'resource_id', nullable: true })
  resourceId: string; // L'ID de la cible

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown>; // Les données modifiées

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;
}
