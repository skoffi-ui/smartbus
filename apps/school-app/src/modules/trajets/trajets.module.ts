import { Module } from '@nestjs/common';
import { TrajetsController } from './trajets.controller';
import { TrajetsService } from './trajets.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [TrajetsController],
  providers: [TrajetsService],
  exports: [TrajetsService],
})
export class TrajetsModule {}
