import { Module } from '@nestjs/common';
import { AlertesCritiquesController } from './alertes-critiques.controller';
import { AlertesCritiquesService } from './alertes-critiques.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [AlertesCritiquesController],
  providers: [AlertesCritiquesService],
})
export class AlertesCritiquesModule {}
