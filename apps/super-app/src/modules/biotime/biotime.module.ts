import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { SuperAppChild, SuperAppPunch, BiotimeConfig, Organisation, BiotimeTerminal } from '@app/database';
import { BiotimeService } from './biotime.service';
import { BiotimeConfigService } from './biotime-config.service';
import { BiotimeCentralService } from './biotime-central.service';
import { BiotimeController } from './biotime.controller';
import { BiotimeAdminController } from './biotime-admin.controller';
import { AlertsService } from './alerts.service';
import { BiotimeProcessor } from './biotime.processor';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      SuperAppChild,
      SuperAppPunch,
      BiotimeConfig,
      Organisation,
      BiotimeTerminal, // Nouvelle entité pour l'architecture multi-tenant
    ]),
    BullModule.registerQueue({
      name: 'biotime-sync',
    }),
  ],
  controllers: [
    BiotimeController,
    BiotimeAdminController, // Contrôleur Super Admin pour gestion centralisée
  ],
  providers: [
    BiotimeService,
    BiotimeConfigService,
    BiotimeCentralService, // Service pour serveur BioTime central
    AlertsService,
    BiotimeProcessor,
  ],
  exports: [BiotimeService, BiotimeConfigService, BiotimeCentralService, BullModule],
})
export class BiotimeModule {}
