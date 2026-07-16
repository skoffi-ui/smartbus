import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { SuperAppChild } from './super-app-child.entity';

@Entity('super_app_punches')
export class SuperAppPunch extends BaseEntityModel {
  @ManyToOne(() => SuperAppChild, (child) => child.punches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'child_id' })
  child: SuperAppChild;

  @Column({ name: 'child_id' })
  childId: string;

  @Column({ name: 'punch_time', type: 'timestamp' })
  punchTime: Date;

  @Column({ name: 'punch_state', nullable: true })
  punchState: string;

  @Column({ name: 'verify_type', nullable: true })
  verifyType: number;

  @Column({ name: 'terminal_sn', nullable: true })
  terminalSn: string;

  @Column({ name: 'biotime_punch_id', unique: true })
  biotimePunchId: string; // Identifier from BioTime to avoid duplicates
}
