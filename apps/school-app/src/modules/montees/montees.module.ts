import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MonteesController } from './montees.controller';
import { MonteesService, VALIDATION_QUEUE } from './montees.service';
import { ValidationProcessor } from './validation.processor';
import { TenantModule } from '../tenant/tenant.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TenantModule,
    NotificationsModule,
    // Enregistrement de la file BullMQ dédiée à la validation
    BullModule.registerQueue({ name: VALIDATION_QUEUE }),
  ],
  controllers: [MonteesController],
  providers: [
    MonteesService,
    ValidationProcessor, // Worker qui consomme la file
  ],
  exports: [MonteesService],
})
export class MonteesModule {}
