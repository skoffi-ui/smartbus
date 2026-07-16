import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organisation } from '@app/database';
import { OrganisationsController } from './organisations.controller';
import { OrganisationsService } from './organisations.service';

import { ProvisioningModule } from '../provisioning/provisioning.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organisation]),
    ProvisioningModule
  ],
  controllers: [OrganisationsController],
  providers: [OrganisationsService],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}
