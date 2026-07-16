import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SuperAppChild, SuperAppPunch } from '@app/database';
import { BiotimeService } from './biotime.service';
import { BiotimeController } from './biotime.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([SuperAppChild, SuperAppPunch]),
  ],
  controllers: [BiotimeController],
  providers: [BiotimeService, AlertsService],
  exports: [BiotimeService],
})
export class BiotimeModule {}
