import { Module } from '@nestjs/common';
import { AffectationsController } from './affectations.controller';
import { AffectationsService } from './affectations.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [AffectationsController],
  providers: [AffectationsService],
  exports: [AffectationsService],
})
export class AffectationsModule {}
