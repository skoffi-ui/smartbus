export { DatabaseModule } from './database.module';

// Entités communes
export * from './entities/base.entity';
export * from './entities/organisation.entity';
export * from './entities/user.entity';
export * from './entities/subscription.entity';
export * from './entities/billing-record.entity';
export * from './entities/metadata.entity';
export * from './entities/payment.entity';
export * from './entities/audit-log.entity';
export * from './entities/super-app-child.entity';
export * from './entities/super-app-punch.entity';

// Entités école (Bases Locataires)
export * from './tenant-entities/child.entity';
export * from './tenant-entities/car.entity';
export * from './tenant-entities/route.entity';
export * from './tenant-entities/trip.entity';
export * from './tenant-entities/biometric-event.entity';
export * from './tenant-entities/parent.entity';
export * from './tenant-entities/driver.entity';
export * from './tenant-entities/notification.entity';
export * from './tenant-entities/course.entity';
export * from './tenant-entities/trajet.entity';
export * from './tenant-entities/point-recuperation.entity';
export * from './tenant-entities/affectation.entity';
export * from './tenant-entities/montee.entity';
export * from './tenant-entities/alerte.entity';
