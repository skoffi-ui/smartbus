import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { GpsService } from './gps.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { UserRole } from '@app/database';

@ApiTags('GPS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SCHOOL_ADMIN)
@Controller('gps')
export class GpsController {
  constructor(private readonly gpsService: GpsService) {}

  @Get('live')
  @ApiOperation({ summary: 'Récupérer la position GPS en direct de tous les véhicules' })
  async getLiveLocations() {
    return this.gpsService.getLiveLocations();
  }

  @Post('route')
  @ApiOperation({ summary: "Calculer l'itinéraire réel et l'estimation de temps (ETA) via OSRM" })
  async calculateRoute(@Body() body: { waypoints: { lat: number; lng: number }[] }) {
    return this.gpsService.calculateRoute(body.waypoints);
  }

  @Get('geocode')
  @ApiOperation({ summary: 'Géocodage inverse via Nominatim (Convertir coordonnées en adresse)' })
  async reverseGeocode(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
  ) {
    if (!lat || !lng) return { error: 'Coordonnées lat/lng manquantes' };
    return this.gpsService.reverseGeocode(lat, lng);
  }
}
