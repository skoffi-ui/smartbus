import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Organisation } from '@app/database';
import { HardwareStreamService } from './hardware-stream.service';
import { HardwareStreamController } from './hardware-stream.controller';
import { HardwareStreamGateway } from './hardware-stream.gateway';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Organisation]),
  ],
  controllers: [HardwareStreamController],
  providers: [HardwareStreamService, HardwareStreamGateway],
  exports: [HardwareStreamService, HardwareStreamGateway],
})
export class HardwareStreamModule {}
