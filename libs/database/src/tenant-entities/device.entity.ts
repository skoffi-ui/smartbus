import { Entity, Column } from 'typeorm';
import { SoftDeleteEntityModel } from '../entities/base.entity';

export enum DeviceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  LOST = 'LOST',
}

@Entity('devices')
export class Device extends SoftDeleteEntityModel {
  @Column({ name: 'serial_number', type: 'varchar', unique: true })
  serialNumber: string;

  @Column({ name: 'mac_address', type: 'varchar', nullable: true })
  macAddress: string;

  @Column({ type: 'varchar' })
  model: string;

  @Column({ type: 'enum', enum: DeviceStatus, default: DeviceStatus.INACTIVE })
  status: DeviceStatus;

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt: Date;
}
