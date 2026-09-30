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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
  UserRole,
  creerGardeCleFluxMateriel,
  DEVICE_STREAM_API_KEY_HEADER,
} from '@app/common';
import { HardwareStreamService } from './hardware-stream.service';

// Un secret distinct par flux : une fuite sur l'un (ex. la config d'un
// forwarder Traccar mal protégée) ne compromet pas les autres.
const GardeFluxZktLibellule = creerGardeCleFluxMateriel(
  'HARDWARE_STREAM_API_KEY',
);
const GardeFluxTraccar = creerGardeCleFluxMateriel('HARDWARE_TRACCAR_API_KEY');

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
  // Authentifiées par secret partagé (voir `creerGardeCleFluxMateriel`) : ces
  // flux viennent de logiciels tiers qu'on ne programme pas (serveur Traccar,
  // terminaux ZKTeco, forwarder Libellule) — impossible de leur faire calculer
  // une signature HMAC par appareil, donc secret partagé + comparaison en
  // temps constant, même principe que `InternalApiKeyGuard`. Avant ce garde,
  // n'importe qui connaissant un numéro de série pouvait injecter un flux.
  // ───────────────────────────────────────────────────────────────────────

  @Post('stream')
  @UseGuards(GardeFluxZktLibellule)
  @ApiSecurity('device-api-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Point d'entrée unique de streaming matériel pour ZKTeco et Libellule",
  })
  @ApiResponse({
    status: 200,
    description: 'Flux routé et traité avec succès.',
  })
  @ApiResponse({
    status: 401,
    description: `Secret manquant/invalide (en-tête ${DEVICE_STREAM_API_KEY_HEADER}).`,
  })
  async receiveStream(@Body() payload: any) {
    return this.hardwareStreamService.handleStream(payload);
  }

  @Post('traccar')
  @UseGuards(GardeFluxTraccar)
  @ApiSecurity('device-api-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Endpoint Webhook pour la télématique Traccar' })
  @ApiResponse({
    status: 401,
    description: `Secret manquant/invalide (en-tête ${DEVICE_STREAM_API_KEY_HEADER}).`,
  })
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
    summary:
      'Positions GPS en direct des véhicules de SA propre école uniquement',
  })
  @ApiResponse({
    status: 403,
    description: 'Aucune école associée au compte appelant.',
  })
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
      'Alertes sur les équipements inactifs de TOUTE la plateforme (réservé au super admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des alertes matérielles récupérée.',
  })
  async getDeviceAlerts() {
    // Cette vue couvre le parc entier : elle reste réservée à l'administration centrale.
    return this.hardwareStreamService.getDeviceAlerts();
  }
}
