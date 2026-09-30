import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { Organisation } from './organisation.entity';

export enum MigrationStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

@Entity('tenant_schema_versions')
export class TenantSchemaVersion extends BaseEntityModel {
  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @Column({ name: 'migration_name', length: 255 })
  migrationName: string;

  @Column({ name: 'migration_version', type: 'int' })
  migrationVersion: number;

  @Column({ length: 255 })
  checksum: string;

  @Column({
    type: 'enum',
    enum: MigrationStatus,
    default: MigrationStatus.PENDING,
  })
  status: MigrationStatus;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ name: 'execution_time_ms', type: 'int', nullable: true })
  executionTimeMs: number;
}
