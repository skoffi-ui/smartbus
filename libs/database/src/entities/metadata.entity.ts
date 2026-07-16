import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { Organisation } from './organisation.entity';

/**
 * Entité MetaData – versionnage du schéma de base de données.
 * Présente dans chaque base école et dans la base centrale.
 */
@Entity('meta_data')
export class MetaData extends BaseEntityModel {
  @Column({ name: 'schema_version', length: 20 })
  schemaVersion: string;

  @Column({ name: 'app_version', length: 20 })
  appVersion: string;

  @Column({ name: 'migration_name', length: 255, nullable: true })
  migrationName: string;

  @Column({ name: 'applied_at', type: 'timestamptz' })
  appliedAt: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => Organisation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'organisation_id', nullable: true })
  organisationId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;
}
