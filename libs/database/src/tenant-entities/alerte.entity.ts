import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Course } from './course.entity';
import { Child } from './child.entity';
import { Car } from './car.entity';

export enum TypeAlerte {
  MAUVAIS_CAR = 'mauvais_car',
  MAUVAIS_ARRET = 'mauvais_arret',
  COURSE_INACTIVE = 'course_inactive',
  ENFANT_NON_AFFECTE = 'enfant_non_affecte',
  GPS_HORS_ZONE = 'gps_hors_zone',
  BADGE_HORS_HORAIRE = 'badge_hors_horaire',
  DOUBLE_VALIDATION = 'double_validation',
  /**
   * Bus à proximité d'un arrêt (événement bénin, informatif — pas un
   * badgeage rejeté). `hardware-stream.service.ts` réutilisait auparavant
   * `GPS_HORS_ZONE` pour ça : chaque approche de bus polluait Alertes
   * Transport avec une entrée « Badgeage hors zone GPS » usurpée, alors
   * qu'aucun badgeage n'avait eu lieu — contredisant l'état vide de cette
   * page qui affirme n'apparaître qu'en cas de vrai rejet.
   */
  PROXIMITE_ARRET = 'proximite_arret',
}

@Entity('alertes')
export class Alerte extends BaseEntityModel {
  @Column({ type: 'enum', enum: TypeAlerte })
  type: TypeAlerte;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'time' })
  heure: string;

  @ManyToOne(() => Course, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column({ name: 'course_id', nullable: true })
  courseId: string;

  @ManyToOne(() => Child, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'child_id' })
  child: Child;

  @Column({ name: 'child_id', nullable: true })
  childId: string;

  @ManyToOne(() => Car, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'car_id' })
  car: Car;

  @Column({ name: 'car_id', nullable: true })
  carId: string;
}
