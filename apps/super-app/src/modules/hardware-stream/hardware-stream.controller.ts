import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, UserRole } from '@app/common';
import { HardwareStreamService } from './hardware-stream.service';

@ApiTags('Hardware Stream Routing')
@Controller('hardware')
export class HardwareStreamController {
  constructor(private readonly hardwareStreamService: HardwareStreamService) {}

  // ───────────────────────────────────────────────────────────────────────
  // INGESTION MATÉRIELLE
  //
  // Volontairement sans JWT : les badgeuses et balises GPS n'ont pas de session
  // utilisateur. L'école est déduite de l'appairage de l'appareil en base centrale
  // (organisation_devices), jamais du contenu du payload.
  //
  // À FAIRE : authentifier ces deux routes par secret d'appareil (HMAC) ou mTLS.
  // En l'état, n'importe qui connaissant un numéro de série peut injecter un flux.
  // ───────────────────────────────────────────────────────────────────────

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
  @ApiOperation({ summary: 'Endpoint Webhook pour la télématique Traccar' })
  async receiveTraccar(@Body() payload: any) {
    return this.hardwareStreamService.handleTraccarStream(payload);
  }

  // ───────────────────────────────────────────────────────────────────────
  // CONSULTATION — JWT obligatoire, périmètre limité à l'appelant
  // ───────────────────────────────────────────────────────────────────────

  @Get('live-locations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Positions GPS en direct des véhicules de SA propre école uniquement",
  })
  @ApiResponse({ status: 403, description: "Aucune école associée au compte appelant." })
  getLiveLocations(@CurrentUser() user: { organisationId?: string }) {
    // L'école vient du JWT vérifié. Aucun paramètre client ne peut l'élargir.
    if (!user?.organisationId) {
      throw new ForbiddenException(
        "Aucune école n'est associée à ce compte : positions indisponibles.",
      );
    }
    return this.hardwareStreamService.getLiveLocations(user.organisationId);
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Alertes sur les équipements inactifs de TOUTE la plateforme (réservé au super admin)",
  })
  @ApiResponse({ status: 200, description: 'Liste des alertes matérielles récupérée.' })
  async getDeviceAlerts() {
    // Cette vue couvre le parc entier : elle reste réservée à l'administration centrale.
    return this.hardwareStreamService.getDeviceAlerts();
  }
}
