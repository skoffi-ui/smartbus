import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organisation, User, Subscription, BillingRecord, MetaData, Payment, AuditLog, SuperAppChild, SuperAppPunch, TenantSchemaVersion } from './index';
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
        // On déclare uniquement les entités globales de la super-app
        entities: [Organisation, User, Subscription, BillingRecord, MetaData, Payment, AuditLog, SuperAppChild, SuperAppPunch, TenantSchemaVersion],
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
  ],
  providers: [TenantConnectionService],
  exports: [TypeOrmModule, TenantConnectionService],
})
export class DatabaseModule {}
