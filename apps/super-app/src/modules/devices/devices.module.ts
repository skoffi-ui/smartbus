import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DatabaseModule } from '@app/database';
import { GpswoxModule } from '../gpswox/gpswox.module';

@Module({
  imports: [DatabaseModule, GpswoxModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
