import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { SuperAppChild, SuperAppPunch, BiotimeConfig, Organisation } from '@app/database';
import { BiotimeService } from './biotime.service';
import { BiotimeConfigService } from './biotime-config.service';
import { BiotimeController } from './biotime.controller';
import { AlertsService } from './alerts.service';
import { BiotimeProcessor } from './biotime.processor';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([SuperAppChild, SuperAppPunch, BiotimeConfig, Organisation]),
    BullModule.registerQueue({
      name: 'biotime-sync',
    }),
  ],
  controllers: [BiotimeController],
  providers: [BiotimeService, BiotimeConfigService, AlertsService, BiotimeProcessor],
  exports: [BiotimeService, BiotimeConfigService, BullModule],
})
export class BiotimeModule {}
