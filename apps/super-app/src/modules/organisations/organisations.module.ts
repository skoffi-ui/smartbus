import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organisation } from '@app/database';
import { OrganisationsController } from './organisations.controller';
import { OrganisationsService } from './organisations.service';

import { ProvisioningModule } from '../provisioning/provisioning.module';
import { BiotimeModule } from '../biotime/biotime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organisation]),
    ProvisioningModule,
    BiotimeModule,
  ],
  controllers: [OrganisationsController],
  providers: [OrganisationsService],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}
