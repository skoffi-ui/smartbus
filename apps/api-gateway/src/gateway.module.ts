import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organisation, Subscription, BiotimeTerminal } from '@app/database';
import { GatewayService } from './gateway.service';
import { TenantGateService } from './tenant-gate.service';
import { HealthController } from './health.controller';
import { jwtSecretRequis } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.local'] }),

    // Connexion en lecture seule à la base centrale (statut des écoles) – pas de synchronize
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('SUPER_DB_HOST', 'localhost'),
        port: config.get<number>('SUPER_DB_PORT', 5432),
        username: config.get<string>('SUPER_DB_USER', 'postgres'),
        password: config.get<string>('SUPER_DB_PASSWORD', 'postgres'),
        database: config.get<string>('SUPER_DB_NAME', 'smartbus_super'),
        // BiotimeTerminal doit y figurer même si la gateway ne l'utilise pas :
        // Organisation.biotimeTerminals (OneToMany) exige que les deux côtés
        // de la relation soient enregistrés sur la même connexion (voir le
        // même correctif dans libs/database/src/database.module.ts).
        entities: [Organisation, Subscription, BiotimeTerminal],
        synchronize: false,
        ssl: config.get<string>('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
    }),
    TypeOrmModule.forFeature([Organisation]),

    // Même secret que la SUPER APP : la gateway vérifie les JWT qu'elle émet
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: jwtSecretRequis(config) }),
    }),
  ],
  controllers: [HealthController],
  providers: [GatewayService, TenantGateService],
})
export class GatewayModule {}
