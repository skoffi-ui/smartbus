import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, UserRole } from '@app/common';
import { StatsService } from './stats.service';

/** Statistiques globales pour le tableau de bord Super Admin (super-admin-web/Dashboard.tsx). */
@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary:
      'Statistiques agrégées et par école (flotte, chauffeurs, parents, élèves, courses, trajets, ' +
      'affectations, alertes, abonnements, grille tarifaire, BioTime centralisée)',
  })
  dashboard() {
    return this.statsService.dashboard();
  }
}
