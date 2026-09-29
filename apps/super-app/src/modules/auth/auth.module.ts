import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Subscription } from '@app/database';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { OrganisationsModule } from '../organisations/organisations.module';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import { secretsJwtAuDemarrage } from '@app/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Subscription]),
    OrganisationsModule,
    ProvisioningModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        // Jeton d'accès ET refresh : l'absence de l'un ou l'autre refuse le démarrage.
        secret: secretsJwtAuDemarrage(configService),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
