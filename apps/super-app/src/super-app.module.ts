import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '@app/database';
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

@Module({
  imports: [
    // Configuration des variables d'environnement
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    // Base de données centrale
    DatabaseModule,

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
  ],
})
export class SuperAppModule {}
