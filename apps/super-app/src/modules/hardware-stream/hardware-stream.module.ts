import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Organisation, DatabaseModule } from '@app/database';
import { HardwareStreamService } from './hardware-stream.service';
import { HardwareStreamController } from './hardware-stream.controller';
import { HardwareStreamGateway } from './hardware-stream.gateway';
import { jwtSecretRequis } from '@app/common';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Organisation]),
    // Fournit TenantConnectionService, résolu à la demande dans la gateway
    // pour scoper la connexion WebSocket d'un parent à SES seules courses
    // (voir HardwareStreamGateway.connexionEcole).
    DatabaseModule,
    // Vérification du JWT à l'ouverture des connexions WebSocket : les gardes
    // HTTP (Passport) ne s'appliquent pas au handshake Socket.IO.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: jwtSecretRequis(config),
      }),
    }),
  ],
  controllers: [HardwareStreamController],
  providers: [HardwareStreamService, HardwareStreamGateway],
  exports: [HardwareStreamService, HardwareStreamGateway],
})
export class HardwareStreamModule {}
