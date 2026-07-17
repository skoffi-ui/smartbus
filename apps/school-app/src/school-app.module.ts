import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { TenantModule } from './modules/tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { PingModule } from './modules/ping/ping.module';
import { CarsModule } from './modules/cars/cars.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { ParentsModule } from './modules/parents/parents.module';
import { ChildrenModule } from './modules/children/children.module';
import { GpsModule } from './modules/gps/gps.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TransportModule } from './modules/transport/transport.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    TenantModule,
    PingModule,
    CarsModule,
    DriversModule,
    ParentsModule,
    ChildrenModule,
    GpsModule,
    NotificationsModule,
    TransportModule,
  ],
  controllers: [],
  providers: [],
})
export class SchoolAppModule {}
