import { Entity, Column, OneToMany, Relation } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Child } from './child.entity';

@Entity('parents')
export class Parent extends BaseEntityModel {
  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ length: 20, unique: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ name: 'pin_code', length: 4, nullable: true })
  pinCode: string;

  @Column({ default: true })
  active: boolean;

  // @OneToMany('Child', 'parent')
  // children: any[];
}
