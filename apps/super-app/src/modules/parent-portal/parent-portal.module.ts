import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { Organisation, DatabaseModule } from '@app/database';
import { jwtSecretRequis } from '@app/common';
import { ParentPortalService } from './parent-portal.service';
import { ParentPortalController } from './parent-portal.controller';
import { FcmService } from './fcm.service';
import { ParentPinLockoutService } from './parent-pin-lockout.service';
import {
  cleIdentifiantDepuisRequete,
  dureeJetonParent,
  entierPositif,
  extraireIpClient,
} from './parent-auth.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organisation]),
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: jwtSecretRequis(configService),
        signOptions: {
          expiresIn: dureeJetonParent(
            configService,
          ) as JwtSignOptions['expiresIn'],
        },
      }),
      inject: [ConfigService],
    }),
    // Limite de débit du seul login parent (pas de garde globale).
    // Deux compteurs : l'identifiant (école + email/téléphone) et l'IP.
    // L'IP lue est le dernier saut de X-Forwarded-For, ajouté par la gateway.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        errorMessage: 'Trop de requêtes sur la connexion parent.',
        throttlers: [
          {
            name: 'parentIdentifiant',
            ttl: entierPositif(config, 'PARENT_LOGIN_THROTTLE_TTL_MS', 60_000),
            limit: entierPositif(config, 'PARENT_LOGIN_THROTTLE_LIMIT', 10),
            getTracker: (req) => cleIdentifiantDepuisRequete(req),
          },
          {
            name: 'parentIp',
            ttl: entierPositif(config, 'PARENT_LOGIN_THROTTLE_TTL_MS', 60_000),
            limit: entierPositif(config, 'PARENT_LOGIN_IP_THROTTLE_LIMIT', 60),
            getTracker: (req) => extraireIpClient(req),
          },
        ],
      }),
    }),
  ],
  controllers: [ParentPortalController],
  providers: [ParentPortalService, FcmService, ParentPinLockoutService],
  exports: [ParentPortalService, FcmService],
})
export class ParentPortalModule {}
