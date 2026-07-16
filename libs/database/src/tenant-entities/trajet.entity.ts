import { Entity, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Course } from './course.entity';
import { PointRecuperation } from './point-recuperation.entity';

@Entity('trajets')
export class Trajet extends BaseEntityModel {
  @OneToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column({ name: 'course_id' })
  courseId: string;

  // Stockage du GeoJSON complet (Polyline Leaflet.draw)
  @Column({ type: 'jsonb', nullable: true })
  geoJson: any;

  @OneToMany(() => PointRecuperation, (point) => point.trajet)
  points: PointRecuperation[];
}
