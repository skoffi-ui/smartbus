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

  @Column({ name: 'child_id' })
  childId: string;

  @Column({ name: 'ordre_montee', default: 0 })
  ordreMontee: number;
}
