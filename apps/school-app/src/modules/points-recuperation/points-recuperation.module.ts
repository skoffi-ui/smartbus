import { Module } from '@nestjs/common';
import { PointsRecuperationController } from './points-recuperation.controller';
import { PointsRecuperationService } from './points-recuperation.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [PointsRecuperationController],
  providers: [PointsRecuperationService],
  exports: [PointsRecuperationService],
})
export class PointsRecuperationModule {}
