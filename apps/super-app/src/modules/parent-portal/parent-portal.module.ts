import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Organisation, DatabaseModule } from '@app/database';
import { ParentPortalService } from './parent-portal.service';
import { ParentPortalController } from './parent-portal.controller';
import { FcmService } from './fcm.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organisation]),
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ParentPortalController],
  providers: [ParentPortalService, FcmService],
  exports: [ParentPortalService, FcmService],
})
export class ParentPortalModule {}
