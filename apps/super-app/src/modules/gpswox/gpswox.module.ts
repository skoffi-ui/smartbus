import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { HardwareStreamModule } from '../hardware-stream/hardware-stream.module';
import { GpswoxService } from './gpswox.service';

/**
 * Intégration GPSWOX (récupération périodique des positions de véhicules —
 * voir `GpswoxService` pour le détail). Ne fait qu'appeler
 * `HardwareStreamService.ingestGpsPosition` : c'est `HardwareStreamModule`
 * qui possède le cache de positions et la diffusion WebSocket, tous deux déjà
 * partagés avec les webhooks Libellule/Traccar.
 */
@Module({
  imports: [HttpModule, ConfigModule, HardwareStreamModule],
  providers: [GpswoxService],
  exports: [GpswoxService],
})
export class GpswoxModule {}
