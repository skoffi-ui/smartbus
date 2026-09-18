import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Subscription, Organisation, DatabaseModule } from '@app/database';
import { CronService } from './cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Organisation]),
    DatabaseModule,
    BullModule.registerQueue({
      name: 'biotime-sync',
    }),
  ],
  providers: [CronService],
})
export class CronModule {}
