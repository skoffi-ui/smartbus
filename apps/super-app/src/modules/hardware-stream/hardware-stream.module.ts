import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Organisation } from '@app/database';
import { HardwareStreamService } from './hardware-stream.service';
import { HardwareStreamController } from './hardware-stream.controller';
import { HardwareStreamGateway } from './hardware-stream.gateway';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Organisation]),
    // Vérification du JWT à l'ouverture des connexions WebSocket : les gardes
    // HTTP (Passport) ne s'appliquent pas au handshake Socket.IO.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'secret'),
      }),
    }),
  ],
  controllers: [HardwareStreamController],
  providers: [HardwareStreamService, HardwareStreamGateway],
  exports: [HardwareStreamService, HardwareStreamGateway],
})
export class HardwareStreamModule {}
