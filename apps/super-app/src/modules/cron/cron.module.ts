import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription, Organisation } from '@app/database';
import { CronService } from './cron.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Organisation])],
  providers: [CronService],
})
export class CronModule {}
