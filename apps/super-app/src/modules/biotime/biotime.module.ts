import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { SuperAppChild, SuperAppPunch } from '@app/database';
import { BiotimeService } from './biotime.service';
import { BiotimeController } from './biotime.controller';
import { AlertsService } from './alerts.service';
import { BiotimeProcessor } from './biotime.processor';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([SuperAppChild, SuperAppPunch]),
    BullModule.registerQueue({
      name: 'biotime-sync',
    }),
  ],
  controllers: [BiotimeController],
  providers: [BiotimeService, AlertsService, BiotimeProcessor],
  exports: [BiotimeService, BullModule],
})
export class BiotimeModule {}
