import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DatabaseModule,
  Organisation,
  User,
  Subscription,
  PlanTarif,
  BiotimeTerminal,
} from '@app/database';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organisation,
      User,
      Subscription,
      PlanTarif,
      BiotimeTerminal,
    ]),
    // Fournit `TenantConnectionService`, nécessaire pour compter les élèves,
    // véhicules, etc. dans chaque base tenant (voir StatsService.statsParEcole).
    DatabaseModule,
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
