import { Entity, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { Organisation } from './organisation.entity';
import { SuperAppChild } from './super-app-child.entity';

/**
 * Miroir central des pointages BioTime.
 *
 * Les identifiants de transaction BioTime repartent de 1 sur chaque serveur : la
 * clé de déduplication est donc (école, identifiant), sans quoi les pointages de
 * la deuxième école sont pris pour des doublons et silencieusement jetés.
 */
@Entity('super_app_punches')
@Unique('uq_super_app_punches_org_punch', ['organisationId', 'biotimePunchId'])
export class SuperAppPunch extends BaseEntityModel {
  @ManyToOne(() => Organisation, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Index()
  @Column({ name: 'organisation_id', type: 'uuid', nullable: true })
  organisationId: string;

  @ManyToOne(() => SuperAppChild, (child) => child.punches, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'child_id' })
  child?: SuperAppChild;

  @Column({ name: 'child_id', nullable: true })
  childId?: string;

  @Column({ name: 'emp_code', nullable: true })
  empCode?: string;

  @Column({ name: 'punch_time', type: 'timestamp' })
  punchTime: Date;

  @Column({ name: 'punch_state', nullable: true })
  punchState: string;

  @Column({ name: 'verify_type', nullable: true })
  verifyType: number;

  @Column({ name: 'terminal_sn', nullable: true })
  terminalSn: string;

  @Column({ name: 'biotime_punch_id' })
  biotimePunchId: string; // Identifiant BioTime, unique seulement au sein d'une école
}
