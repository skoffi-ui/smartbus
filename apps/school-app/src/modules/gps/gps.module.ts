import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GpsService } from './gps.service';
import { GpsController } from './gps.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [HttpModule, TenantModule],
  providers: [GpsService],
  controllers: [GpsController],
  exports: [GpsService],
})
export class GpsModule {}
