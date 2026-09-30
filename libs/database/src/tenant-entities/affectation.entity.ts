import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { PointRecuperation } from './point-recuperation.entity';
import { Child } from './child.entity';
import { Course } from './course.entity';

@Entity('affectations')
export class Affectation extends BaseEntityModel {
  @ManyToOne(() => PointRecuperation, (point) => point.affectations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'point_id' })
  pointRecuperation: PointRecuperation;

  @Column({ name: 'point_id' })
  pointId: string;

  @ManyToOne(() => Child, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'child_id' })
  child: Child;

  @Column({ name: 'child_id' })
  childId: string;

  /**
   * Course pour laquelle cette affectation s'applique — un enfant peut prendre
   * un bus différent selon le moment de la journée (matin, retour midi,
   * remontée 14h, descente 16h) : chacun de ces trajets est une `Course`
   * distincte, donc chacun a sa propre affectation.
   *
   * Nullable : les affectations créées depuis `TrajetEditor.tsx` (qui édite un
   * Trajet géographique, indépendamment de toute Course) ne renseignent pas ce
   * champ. `HardwareStreamService.validatePunch` s'y replie sur l'ancienne
   * vérification par trajet dans ce cas précis (voir son commentaire).
   *
   * La contrainte d'unicité est désormais `(child_id, course_id)` — voir
   * migration `AddCourseIdToAffectations` — au lieu de `child_id` seul :
   * c'est ce qui autorise plusieurs affectations par enfant, une par course.
   */
  @ManyToOne(() => Course, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: Course;

  @Column({ name: 'course_id', nullable: true })
  courseId?: string;

  @Column({ name: 'ordre_montee', default: 0 })
  ordreMontee: number;
}
