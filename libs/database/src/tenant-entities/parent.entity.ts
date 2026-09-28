import { Entity, Column, OneToMany, Relation } from 'typeorm';
import { SoftDeleteEntityModel } from '../entities/base.entity';
import { Child } from './child.entity';

@Entity('parents')
export class Parent extends SoftDeleteEntityModel {
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

  @Column({ name: 'fcm_token', length: 500, nullable: true })
  fcmToken: string;

  @Column({ default: true })
  active: boolean;

  /**
   * Préférences de notification de l'app parent — un parent qui trouve les
   * alertes de proximité trop fréquentes peut les couper sans perdre les
   * notifications de pointage (et inversement). Coupé = ni push, ni
   * entrée dans l'historique consultable (voir ParentPortalService).
   */
  @Column({ name: 'notif_punch_enabled', default: true })
  notifPunchEnabled: boolean;

  @Column({ name: 'notif_proximity_enabled', default: true })
  notifProximityEnabled: boolean;

  @OneToMany(() => Child, (child) => child.parent)
  children: Child[];
}
