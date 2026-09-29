import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '@app/database';
import { CryptoModule, DirectorInvitationModule } from '@app/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganisationsModule } from './modules/organisations/organisations.module';
import { RolesModule } from './modules/roles/roles.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { BillingModule } from './modules/billing/billing.module';
import { ProvisioningModule } from './modules/provisioning/provisioning.module';
import { MetaDataModule } from './modules/metadata/metadata.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CronModule } from './modules/cron/cron.module';
import { AuditModule } from './modules/audit/audit.module';
import { BiotimeModule } from './modules/biotime/biotime.module';
import { HardwareStreamModule } from './modules/hardware-stream/hardware-stream.module';
import { ParentPortalModule } from './modules/parent-portal/parent-portal.module';
import { DevicesModule } from './modules/devices/devices.module';
import { GpswoxModule } from './modules/gpswox/gpswox.module';
import { PlanTarifsModule } from './modules/plan-tarifs/plan-tarifs.module';
import { StatsModule } from './modules/stats/stats.module';

@Module({
  imports: [
    // Configuration des variables d'environnement
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    // Chiffrement des secrets tiers (identifiants BioTime des écoles)
    CryptoModule,

    // Invitations directeur (sans base de données, voir director-invitation.service.ts)
    DirectorInvitationModule,

    // Base de données centrale
    DatabaseModule,

    // File d'attente Redis pour les tâches d'arrière-plan
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),

    // Modules métier
    AuthModule,
    UsersModule,
    OrganisationsModule,
    RolesModule,
    SubscriptionsModule,
    BillingModule,
    ProvisioningModule,
    MetaDataModule,
    PaymentsModule,
    CronModule,
    AuditModule,
    BiotimeModule,
    HardwareStreamModule,
    ParentPortalModule,
    DevicesModule,
    GpswoxModule,
    PlanTarifsModule,
    StatsModule,
  ],
})
export class SuperAppModule {}
