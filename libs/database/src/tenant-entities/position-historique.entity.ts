import { Entity, Column } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';

/**
 * Historique des positions GPS ingérées (une ligne par position reçue,
 * `HardwareStreamService.ingestResolvedGpsPosition`) — pour audit et
 * rejouabilité ("le bus était-il vraiment là à cette heure ?"), distinct du
 * cache `latestCarGps`/Redis qui ne garde que la DERNIÈRE position connue.
 *
 * `courseId` reste une simple colonne `varchar`, pas une FK : elle vaut
 * `'default-course'` (littéral, pas un UUID) hors course active, exactement
 * comme dans le reste de `HardwareStreamService`.
 *
 * Purgée après 30 jours par `CronService` — sans ça, une ligne toutes les
 * ~20s par véhicule actif ferait grossir cette table indéfiniment.
 */
@Entity('gps_position_history')
export class PositionHistorique extends BaseEntityModel {
  @Column({ name: 'car_id', type: 'uuid' })
  carId: string;

  @Column({ name: 'course_id', type: 'varchar', nullable: true })
  courseId: string | null;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'int', default: 0 })
  speed: number;

  /** Horodatage rapporté par la source (GPSWOX/Traccar/Libellule), pas l'heure d'écriture en base (voir `createdAt`). */
  @Column({ name: 'reported_at', type: 'timestamptz', nullable: true })
  reportedAt: Date | null;
}
