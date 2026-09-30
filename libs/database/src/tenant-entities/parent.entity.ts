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

  /**
   * Hash bcrypt du PIN (coût 12), jamais le code en clair.
   * varchar(255) : un hash fait 60 caractères. La migration tenant
   * `HashParentPinCodes1728200000000` élargit la colonne et re-hashe
   * les valeurs déjà présentes.
   */
  @Column({ name: 'pin_code', type: 'varchar', length: 255, nullable: true })
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
