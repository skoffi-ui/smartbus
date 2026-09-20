import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { Organisation } from './organisation.entity';

/**
 * Configuration du serveur BioTime **d'une école**.
 *
 * Chaque établissement héberge son propre serveur BioTime, sur son réseau : l'URL
 * et les identifiants sont donc propres à l'école, et non globaux à la plateforme.
 * Le mot de passe est chiffré au repos (AES-256-GCM via CryptoService).
 *
 * Cette table porte aussi l'état de synchronisation, qui est par nature propre à
 * chaque école : le curseur évite de rebalayer toute la journée à chaque passage.
 */
@Entity('biotime_configs')
export class BiotimeConfig extends BaseEntityModel {
  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Index({ unique: true })
  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  /** URL du serveur BioTime de l'école, ex. http://192.168.1.50:8080 */
  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 255 })
  username: string;

  // ── Mot de passe chiffré (jamais stocké en clair) ──
  @Column({ name: 'password_ciphertext', type: 'text' })
  passwordCiphertext: string;

  @Column({ name: 'password_iv', type: 'varchar', length: 64 })
  passwordIv: string;

  @Column({ name: 'password_tag', type: 'varchar', length: 64 })
  passwordTag: string;

  /** Une école peut être désactivée sans perdre sa configuration. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // ── État de synchronisation (curseur incrémental) ──

  /** Dernier identifiant de transaction BioTime traité pour cette école. */
  @Column({ name: 'last_synced_punch_id', type: 'bigint', nullable: true })
  lastSyncedPunchId: string | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'last_sync_count', type: 'int', nullable: true })
  lastSyncCount: number | null;

  // ── Dernière erreur, pour la supervision du parc ──
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'last_error_at', type: 'timestamptz', nullable: true })
  lastErrorAt: Date | null;
}
