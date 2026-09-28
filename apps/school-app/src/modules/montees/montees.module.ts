import { Module } from '@nestjs/common';
import { MonteesController } from './montees.controller';
import { MonteesService } from './montees.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [MonteesController],
  providers: [MonteesService],
  exports: [MonteesService],
})
export class MonteesModule {}
