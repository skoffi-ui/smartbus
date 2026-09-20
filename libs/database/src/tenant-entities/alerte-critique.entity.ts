import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SoftDeleteEntityModel } from '../entities/base.entity';
import { Child } from './child.entity';
import { Course } from './course.entity';
import { Car } from './car.entity';

@Entity('alertes_critiques')
export class AlerteCritique extends SoftDeleteEntityModel {
  @Column()
  type: string;

  @Column({ default: 'HIGH' })
  severity: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'child_id' })
  childId: string;

  @Column({ name: 'child_name' })
  childName: string;

  @Column({ name: 'child_emp_code', type: 'varchar', nullable: true })
  childEmpCode: string | null;

  @Column({ name: 'detected_car_id', type: 'uuid', nullable: true })
  detectedCarId: string | null;

  @Column({ name: 'detected_car_plate', type: 'varchar', nullable: true })
  detectedCarPlate: string | null;

  @Column({ name: 'terminal_sn', type: 'varchar', nullable: true })
  terminalSn: string | null;

  @Column({ name: 'detected_course_id', type: 'uuid', nullable: true })
  detectedCourseId: string | null;

  @Column({ name: 'expected_course_id', type: 'uuid', nullable: true })
  expectedCourseId: string | null;

  @Column({ name: 'detected_stop_id', type: 'uuid', nullable: true })
  detectedStopId: string | null;

  @Column({ name: 'expected_stop_id', type: 'uuid', nullable: true })
  expectedStopId: string | null;

  @Column({ name: 'expected_stop_name', type: 'varchar', nullable: true })
  expectedStopName: string | null;

  @Column({ name: 'punch_time', type: 'timestamp with time zone' })
  punchTime: Date;

  @Column({ default: false })
  resolved: boolean;

  @Column({ name: 'resolved_at', type: 'timestamp with time zone', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', type: 'varchar', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote: string | null;
}
