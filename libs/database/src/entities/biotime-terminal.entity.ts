import { Entity, Column, ManyToOne, JoinColumn, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Organisation } from './organisation.entity';

export enum TerminalStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
}

/**
 * Entité BiotimeTerminal - Badgeuse/Terminal BioTime
 *
 * Représente un terminal physique du serveur BioTime central
 * qui peut être assigné à une organisation (école) spécifique.
 */
@Entity('biotime_terminals')
export class BiotimeTerminal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Numéro de série du terminal (unique sur le serveur BioTime)
   */
  @Column({ name: 'serial_number', unique: true })
  serialNumber: string;

  /**
   * Nom personnalisé du terminal (ex: "Badgeuse Bus 1 - Nangui")
   */
  @Column({ name: 'terminal_name' })
  terminalName: string;

  /**
   * ID du terminal sur le serveur BioTime central
   */
  @Column({ name: 'biotime_terminal_id', type: 'int', nullable: true })
  biotimeTerminalId: number;

  /**
   * Adresse IP du terminal
   */
  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  /**
   * Modèle du terminal (ex: "ZKTeco F18", "SpeedFace-V5L")
   */
  @Column({ nullable: true })
  model: string;

  /**
   * Statut actuel du terminal
   */
  @Column({
    type: 'varchar',
    enum: TerminalStatus,
    default: TerminalStatus.INACTIVE
  })
  status: TerminalStatus;

  /**
   * Dernière synchronisation avec le serveur BioTime
   */
  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt: Date;

  /**
   * Organisation (école) à laquelle ce terminal est assigné
   * NULL = terminal disponible pour affectation
   */
  @ManyToOne(() => Organisation, org => org.biotimeTerminals, {
    nullable: true,
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'organisation_id', nullable: true })
  organisationId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
