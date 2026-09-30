import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  FeaturesGuard,
  RequireFeature,
} from '@app/common';
import { UserRole } from '@app/database';
import { AlertesCritiquesService } from './alertes-critiques.service';

@ApiTags('Alertes Critiques')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, FeaturesGuard)
// Consommé par CentreAlertes.tsx (/centre-alertes), pas par AlertesTransport.tsx (/alertes, voir montees.controller.ts).
@RequireFeature('centre-alertes')
@Controller('alertes-critiques')
export class AlertesCritiquesController {
  constructor(
    private readonly alertesCritiquesService: AlertesCritiquesService,
  ) {}

  /**
   * GET /api/v1/alertes-critiques
   * Retourne les anomalies pour le tableau de bord de l'école. `statut`
   * (unresolved par défaut, resolved, ou all) permet aux onglets « Résolues »/
   * « Toutes » de CentreAlertes.tsx de lire de vraies données en base plutôt
   * que le seul historique accumulé côté client depuis l'ouverture de la page.
   */
  @Get()
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lister les anomalies de pointage' })
  @ApiResponse({ status: 200, description: 'Liste des anomalies critiques' })
  async getUnresolved(
    @Request() req: any,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('statut') statut?: 'unresolved' | 'resolved' | 'all',
  ) {
    const tenantId = req.user?.organisationId;
    return this.alertesCritiquesService.getUnresolved(
      tenantId,
      limit,
      statut ?? 'unresolved',
    );
  }

  /**
   * GET /api/v1/alertes-critiques/count
   * Retourne le nombre total d'anomalies non résolues (badge de compteur).
   */
  @Get('count')
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Compter les anomalies non résolues' })
  async countUnresolved(@Request() req: any) {
    const tenantId = req.user?.organisationId;
    const count = await this.alertesCritiquesService.countUnresolved(tenantId);
    return { count };
  }

  /**
   * PATCH /api/v1/alertes-critiques/:id/resolve
   * Marque une anomalie comme résolue (action du responsable scolaire).
   */
  @Patch(':id/resolve')
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Marquer une anomalie critique comme résolue' })
  async resolve(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    const tenantId = req.user?.organisationId;
    const resolvedBy =
      `${req.user?.firstName ?? ''} ${req.user?.lastName ?? ''}`.trim() ||
      req.user?.email;
    return this.alertesCritiquesService.resolve(
      tenantId,
      id,
      resolvedBy,
      body.note,
    );
  }
}
