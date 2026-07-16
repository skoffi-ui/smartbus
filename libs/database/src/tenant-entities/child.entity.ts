import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Relation } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Parent } from './parent.entity';

/**
 * Sexe de l'enfant
 */
export enum ChildGender {
  MALE = 'M',
  FEMALE = 'F',
}

/**
 * Entité Child – enfant scolarisé dans l'établissement.
 * Contient les données biométriques (hash de l'empreinte digitale).
 */
@Entity('children')
export class Child extends BaseEntityModel {
  // @ManyToOne('Parent', 'children', { onDelete: 'CASCADE' })
  // @JoinColumn({ name: 'parent_id' })
  // parent: any;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: Date;

  @Column({ type: 'enum', enum: ChildGender, nullable: true })
  gender: ChildGender;

  @Column({ name: 'student_id', nullable: true, unique: true })
  studentId: string;

  @Column({ name: 'emp_code', nullable: true })
  empCode: string;

  @Column({ name: 'class_name', nullable: true })
  className: string;

  @Column({ name: 'photo_url', nullable: true })
  photoUrl: string;

  // Biométrie – stockage sécurisé du template d'empreinte
  @Column({ name: 'biometric_template', nullable: true, select: false })
  biometricTemplate: string;

  @Column({ name: 'biometric_enrolled', default: false })
  biometricEnrolled: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Arrêt d'embarquement/débarquement par défaut
  @Column({ name: 'default_boarding_stop', nullable: true })
  defaultBoardingStop: string;

  @Column({ name: 'default_alighting_stop', nullable: true })
  defaultAlightingStop: string;
}
