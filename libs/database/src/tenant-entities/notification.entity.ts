import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityModel } from '../entities/base.entity';
import { Child } from './child.entity';
import { Car } from './car.entity';

@Entity('notifications')
export class Notification extends BaseEntityModel {
  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ length: 50, default: 'INFO' })
  type: string; // ex: INFO, WARNING, SUCCESS

  @Column({ default: false })
  isRead: boolean;

  // Metadata JSON to store lat/lng or other context
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Child, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'child_id' })
  child: Child;

  @ManyToOne(() => Car, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'car_id' })
  car: Car;
}
