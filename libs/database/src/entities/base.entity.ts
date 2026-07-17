import {
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  BaseEntity,
  Column,
  DeleteDateColumn,
} from 'typeorm';
import { ModificationSource } from '../enums/modification-source.enum';
import { ActorType } from '../enums/actor-type.enum';

/**
 * Entité de base abstraite – tous les modèles héritent de cette classe.
 */
export abstract class BaseEntityModel extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // Référence logique vers smartbus_super.users.id (pas de FK cross-DB)
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  // Référence logique vers smartbus_super.users.id (pas de FK cross-DB)
  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string;

  @Column({ name: 'created_by_type', type: 'varchar', length: 50, nullable: true })
  createdByType: ActorType;

  @Column({ name: 'updated_by_type', type: 'varchar', length: 50, nullable: true })
  updatedByType: ActorType;

  @Column({ name: 'last_modified_source', type: 'varchar', length: 50, nullable: true })
  lastModifiedSource: ModificationSource;
}

/**
 * Entité de base abstraite pour les ressources supportant la suppression logique (Soft Delete).
 */
export abstract class SoftDeleteEntityModel extends BaseEntityModel {
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date;

  // Référence logique vers smartbus_super.users.id
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string;
}
