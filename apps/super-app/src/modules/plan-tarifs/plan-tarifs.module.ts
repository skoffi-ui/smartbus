import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanTarif } from '@app/database';
import { PlanTarifsController } from './plan-tarifs.controller';
import { PlanTarifsService } from './plan-tarifs.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlanTarif])],
  controllers: [PlanTarifsController],
  providers: [PlanTarifsService],
  exports: [PlanTarifsService],
})
export class PlanTarifsModule {}
