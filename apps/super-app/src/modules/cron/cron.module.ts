import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Subscription, Organisation, DatabaseModule } from '@app/database';
import { CronService } from './cron.service';
import { BiotimeModule } from '../biotime/biotime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Organisation]),
    DatabaseModule,
    // Fournit BiotimeConfigService : le planificateur doit connaître les écoles
    // ayant un serveur BioTime configuré.
    BiotimeModule,
    BullModule.registerQueue({
      name: 'biotime-sync',
    }),
  ],
  providers: [CronService],
})
export class CronModule {}
