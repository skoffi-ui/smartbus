import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HardwareStreamService } from './hardware-stream.service';

@ApiTags('Hardware Stream Routing')
@Controller('hardware')
export class HardwareStreamController {
  constructor(private readonly hardwareStreamService: HardwareStreamService) {}

  @Post('stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Point d'entrée unique de streaming matériel pour ZKTeco et Libellule",
  })
  @ApiResponse({ status: 200, description: 'Flux routé et traité avec succès.' })
  async receiveStream(@Body() payload: any) {
    return this.hardwareStreamService.handleStream(payload);
  }

  @Post('traccar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Endpoint Webhook pour la télématique Traccar" })
  async receiveTraccar(@Body() payload: any) {
    return this.hardwareStreamService.handleTraccarStream(payload);
  }

  @Get('live-locations')
  @ApiOperation({ summary: "Récupérer la dernière position GPS en RAM de tous les véhicules" })
  getLiveLocations() {
    return this.hardwareStreamService.getLiveLocations();
  }

  @Get('alerts')
  @ApiOperation({
    summary: "Récupère les alertes sur les équipements inactifs (hors-ligne depuis > 5 minutes)",
  })
  @ApiResponse({ status: 200, description: 'Liste des alertes matérielles récupérée.' })
  async getDeviceAlerts() {
    return this.hardwareStreamService.getDeviceAlerts();
  }
}
