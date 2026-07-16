import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
