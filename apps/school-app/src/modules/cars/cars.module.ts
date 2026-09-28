import { Module } from '@nestjs/common';
import { CarsService } from './cars.service';
import { CarsController } from './cars.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [CarsController],
  providers: [CarsService],
  exports: [CarsService],
})
export class CarsModule {}
