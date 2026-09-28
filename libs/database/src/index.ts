export { DatabaseModule } from './database.module';

// Entités communes
export * from './entities/base.entity';
export * from './entities/organisation.entity';
export * from './entities/user.entity';
export * from './entities/subscription.entity';
export * from './entities/plan-tarif.entity';
export * from './entities/billing-record.entity';
export * from './entities/metadata.entity';
export * from './entities/payment.entity';
export * from './entities/audit-log.entity';
export * from './entities/super-app-child.entity';
export * from './entities/super-app-punch.entity';
export * from './entities/tenant-schema-version.entity';
export * from './entities/biotime-config.entity';
export * from './entities/biotime-terminal.entity';

// Entités école (Bases Locataires)
export * from './tenant-entities/child.entity';
export * from './tenant-entities/car.entity';
export * from './tenant-entities/biometric-event.entity';
export * from './tenant-entities/parent.entity';
export * from './tenant-entities/driver.entity';
export * from './tenant-entities/notification.entity';
export * from './tenant-entities/course.entity';
export * from './tenant-entities/trajet.entity';
export * from './tenant-entities/point-recuperation.entity';
export * from './tenant-entities/affectation.entity';
export * from './tenant-entities/montee.entity'; // Legacy – sera retiré en Phase B
export * from './tenant-entities/pointage.entity';
export * from './tenant-entities/alerte.entity';
export * from './tenant-entities/device.entity';
export * from './tenant-entities/device-assignment.entity';
export * from './tenant-entities/biometric-consent.entity';
export * from './tenant-entities/course-execution.entity';
export * from './tenant-entities/alerte-critique.entity';
export * from './tenant-entities/position-historique.entity';
export { TENANT_ENTITIES } from './tenant-entity-list';
export { TenantConnectionService } from './tenant-connection.service';

