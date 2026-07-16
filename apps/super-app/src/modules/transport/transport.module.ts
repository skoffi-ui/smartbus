import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransportController } from './transport.controller';
import { TransportService } from './transport.service';
import { ValidationService } from './validation.service';
import { BiotimeModule } from '../biotime/biotime.module';
import { 
  Course, 
  Trajet, 
  PointRecuperation, 
  Affectation, 
  Montee, 
  Alerte,
  Car,
  Child,
  Parent
} from '@app/database';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course, 
      Trajet, 
      PointRecuperation, 
      Affectation, 
      Montee, 
      Alerte,
      Car,
      Child
    ]),
    BiotimeModule // Inject BiotimeModule to use biotime.service.ts
  ],
  controllers: [TransportController],
  providers: [TransportService, ValidationService],
  exports: [TransportService, ValidationService],
})
export class TransportModule {}
