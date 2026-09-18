import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { TenantModule } from '../tenant/tenant.module';
import { GpsModule } from '../gps/gps.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [TenantModule, GpsModule, HttpModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
