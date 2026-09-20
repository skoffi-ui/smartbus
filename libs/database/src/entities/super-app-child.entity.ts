import { Entity, Column, OneToMany, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { Organisation } from './organisation.entity';
import { SuperAppPunch } from './super-app-punch.entity';

/**
 * Miroir central des employés BioTime, utilisé par la supervision Super Admin.
 *
 * `emp_code` n'est unique QUE dans un serveur BioTime donné : deux écoles ont
 * toutes les deux un matricule « 1 ». La clé est donc (école, matricule), sans
 * quoi la deuxième école ne peut pas enregistrer ses enfants.
 */
@Entity('super_app_children')
@Unique('uq_super_app_children_org_emp', ['organisationId', 'empCode'])
export class SuperAppChild extends BaseEntityModel {
  @ManyToOne(() => Organisation, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Index()
  @Column({ name: 'organisation_id', type: 'uuid', nullable: true })
  organisationId: string;

  @Column({ name: 'emp_code' })
  empCode: string;

  @Column({ name: 'first_name', nullable: true })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @Column({ nullable: true })
  position: string;

  @Column({ name: 'hire_date', type: 'date', nullable: true })
  hireDate: Date;

  @Column({ nullable: true })
  fingerprint: string;

  @Column({ name: 'department_name', nullable: true })
  departmentName: string;

  @Column({ type: 'json', nullable: true })
  areas: any;

  @Column({ nullable: true })
  photo: string;

  @Column({ nullable: true })
  mobile: string;

  @Column({ name: 'contact_tel', nullable: true })
  contactTel: string;

  @Column({ nullable: true })
  email: string;

  @OneToMany(() => SuperAppPunch, (punch) => punch.child)
  punches: SuperAppPunch[];
}
