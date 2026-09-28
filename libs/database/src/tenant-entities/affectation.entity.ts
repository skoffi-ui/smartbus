import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { PointRecuperation } from './point-recuperation.entity';
import { Child } from './child.entity';

@Entity('affectations')
export class Affectation extends BaseEntityModel {
  @ManyToOne(() => PointRecuperation, (point) => point.affectations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'point_id' })
  pointRecuperation: PointRecuperation;

  @Column({ name: 'point_id' })
  pointId: string;

  @ManyToOne(() => Child, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'child_id' })
  child: Child;

  // `unique: true` : `AffectationsService.create()` vérifiait déjà "un seul
  // point par enfant" en applicatif (recherche puis insertion), mais sans
  // contrainte en base c'est une vérification-puis-écriture non atomique —
  // deux requêtes concurrentes pour le même enfant pouvaient toutes les deux
  // passer la vérification avant qu'aucune n'ait encore validé, produisant
  // deux affectations pour le même enfant malgré l'invariant documenté.
  @Column({ name: 'child_id', unique: true })
  childId: string;

  @Column({ name: 'ordre_montee', default: 0 })
  ordreMontee: number;
}
