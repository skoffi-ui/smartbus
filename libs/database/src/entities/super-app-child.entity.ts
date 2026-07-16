import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntityModel } from './base.entity';
import { SuperAppPunch } from './super-app-punch.entity';

@Entity('super_app_children')
export class SuperAppChild extends BaseEntityModel {
  @Column({ name: 'emp_code', unique: true })
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
