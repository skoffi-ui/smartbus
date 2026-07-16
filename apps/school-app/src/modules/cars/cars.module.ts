import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CarsService } from './cars.service';
import { CarsController } from './cars.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule, HttpModule],
  controllers: [CarsController],
  providers: [CarsService],
  exports: [CarsService],
})
export class CarsModule {}
