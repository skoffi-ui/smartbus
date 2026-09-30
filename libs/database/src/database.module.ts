import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
// Imports directs (pas via './index') : le barrel charge ce module avant les entités,
// ce qui les rendrait undefined au moment où TypeOrmModule.forFeature() est évalué.
import { Organisation } from './entities/organisation.entity';
import { User } from './entities/user.entity';
import { Subscription } from './entities/subscription.entity';
import { BillingRecord } from './entities/billing-record.entity';
import { MetaData } from './entities/metadata.entity';
import { Payment } from './entities/payment.entity';
import { AuditLog } from './entities/audit-log.entity';
import { SuperAppChild } from './entities/super-app-child.entity';
import { SuperAppPunch } from './entities/super-app-punch.entity';
import { TenantSchemaVersion } from './entities/tenant-schema-version.entity';
import { BiotimeConfig } from './entities/biotime-config.entity';
import { BiotimeTerminal } from './entities/biotime-terminal.entity';
import { TenantConnectionService } from './tenant-connection.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('SUPER_DB_HOST', 'localhost'),
        port: configService.get<number>('SUPER_DB_PORT', 5432),
        username: configService.get<string>('SUPER_DB_USER', 'postgres'),
        password: configService.get<string>('SUPER_DB_PASSWORD', 'postgres'),
        database: configService.get<string>('SUPER_DB_NAME', 'smartbus_super'),
        // On déclare uniquement les entités globales de la super-app.
        // BiotimeTerminal doit y figurer même si aucun contrôleur ne l'utilise
        // ici : `Organisation.biotimeTerminals` (OneToMany) exige que les deux
        // côtés de la relation soient enregistrés sur la même connexion, sinon
        // TypeORM échoue au démarrage avec "Entity metadata ... was not found"
        // — repéré uniquement dans school-app, qui n'a pas d'autre module
        // enregistrant BiotimeTerminal via `forFeature` pour compenser via
        // `autoLoadEntities` (contrairement à super-app, où biotime.module.ts
        // le fait — coïncidence qui masquait le problème).
        entities: [
          Organisation,
          User,
          Subscription,
          BillingRecord,
          MetaData,
          Payment,
          AuditLog,
          SuperAppChild,
          SuperAppPunch,
          TenantSchemaVersion,
          BiotimeConfig,
          BiotimeTerminal,
        ],
        // En développement uniquement – à désactiver en production
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        logging: configService.get<string>('NODE_ENV') === 'development',
        autoLoadEntities: true,
        ssl:
          configService.get<string>('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
      inject: [ConfigService],
    }),
    // Requis par TenantConnectionService (résolution des infos de connexion de l'école)
    TypeOrmModule.forFeature([Organisation]),
  ],
  providers: [TenantConnectionService],
  exports: [TypeOrmModule, TenantConnectionService],
})
export class DatabaseModule {}
