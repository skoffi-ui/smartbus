import { Controller, Get, Post, Body, UseGuards, Query, Req } from '@nestjs/common';
import { GpsService } from './gps.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, FeaturesGuard, RequireFeature } from '@app/common';
import { UserRole } from '@app/database';

@ApiTags('GPS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, FeaturesGuard)
@Roles(UserRole.SCHOOL_ADMIN)
// Pas de @RequireFeature au niveau classe : ce contrôleur mélange une
// fonctionnalité de suivi en direct (`live`) et un utilitaire de géocodage
// utilisé par un tout autre écran (l'éditeur de trajets, `trajets`). Un
// `@RequireFeature('live')` global cassait /gps/geocode pour toute école
// ayant `trajets` sans avoir `live` — voir le détail par endpoint ci-dessous.
@Controller('gps')
export class GpsController {
  constructor(private readonly gpsService: GpsService) {}

  @Get('live')
  @ApiOperation({
    summary: 'Récupérer la position GPS en direct des véhicules de son école',
  })
  @RequireFeature('live')
  async getLiveLocations(@Req() req: { headers: Record<string, string | undefined> }) {
    // Le jeton est relayé à la super-app, qui en déduit l'école propriétaire des bus.
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return this.gpsService.getLiveLocations(token);
  }

  @Post('route')
  @ApiOperation({ summary: "Calculer l'itinéraire réel et l'estimation de temps (ETA) via OSRM" })
  @RequireFeature('live')
  async calculateRoute(@Body() body: { waypoints: { lat: number; lng: number }[] }) {
    return this.gpsService.calculateRoute(body.waypoints);
  }

  @Get('geocode')
  @ApiOperation({ summary: 'Géocodage inverse via Nominatim (Convertir coordonnées en adresse)' })
  // Appelé par TrajetEditor.tsx (feature `trajets`), pas par le live tracking.
  @RequireFeature('trajets', 'live')
  async reverseGeocode(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
  ) {
    if (!lat || !lng) return { error: 'Coordonnées lat/lng manquantes' };
    return this.gpsService.reverseGeocode(lat, lng);
  }
}
