import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Car } from './car.entity';

export enum CourseStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('courses')
export class Course extends BaseEntityModel {
  @Column({ length: 255 })
  nom: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => Car, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'car_id' })
  car: Car;

  @Column({ name: 'car_id', nullable: true })
  carId: string;

  @Column({ length: 255, nullable: true })
  chauffeur: string;

  @Column({ length: 255, nullable: true })
  ecole: string;

  @Column({ name: 'heure_depart', type: 'time', nullable: true })
  heureDepart: string;

  @Column({ name: 'heure_arrivee', type: 'time', nullable: true })
  heureArrivee: string;

  @Column({ type: 'jsonb', nullable: true })
  joursExecution: string[];

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.ACTIVE })
  statut: CourseStatus;

  @Column({ name: 'couleur_carte', length: 50, nullable: true })
  couleurCarte: string;

  @Column({ type: 'jsonb', nullable: true })
  route: any[];

  @Column({ type: 'jsonb', nullable: true })
  markers: any[];
}
