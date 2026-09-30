import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ParentPortalService } from './parent-portal.service';
import { FcmService } from './fcm.service';
import { ParentLoginDto } from './dto/parent-login.dto';
import { ChangeParentPinDto } from './dto/change-parent-pin.dto';
import { ParentJwtAuthGuard } from './guards/parent-jwt-auth.guard';
import { Public, JwtAuthGuard, RolesGuard, Roles, UserRole } from '@app/common';

@ApiTags('Parent Portal')
@Controller()
export class ParentPortalController {
  constructor(
    private readonly parentPortalService: ParentPortalService,
    private readonly fcmService: FcmService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('auth/parent/login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: ParentLoginDto })
  @ApiOperation({
    summary: "Connexion de l'application mobile des parents",
    description:
      'Le code établissement est obligatoire. Le PIN est vérifié par bcrypt. ' +
      'Le jeton expire selon PARENT_JWT_EXPIRES_IN (défaut 12h, plus court que les 7 jours des comptes école). ' +
      "Après plusieurs PIN incorrects, l'identifiant est verrouillé pour une durée croissante (429, code PARENT_PIN_LOCKED). " +
      "Un plafond de requêtes (@nestjs/throttler) s'applique en plus, par identifiant et par adresse IP.",
  })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie. Le corps ne contient pas le PIN.',
  })
  @ApiResponse({
    status: 400,
    description:
      "Code établissement manquant, ou PIN qui n'est pas 4 chiffres.",
  })
  @ApiResponse({ status: 401, description: 'Identifiants ou PIN incorrects.' })
  @ApiResponse({
    status: 429,
    description:
      'Verrouillage progressif (code PARENT_PIN_LOCKED) ou limite de débit dépassée.',
  })
  async login(@Body() dto: ParentLoginDto) {
    return this.parentPortalService.login(dto);
  }

  @UseGuards(ParentJwtAuthGuard)
  @ApiBearerAuth()
  @Get('parent/enfants')
  @ApiOperation({
    summary: 'Récupère la liste des enfants associés au parent connecté',
  })
  @ApiResponse({ status: 200, description: 'Liste des enfants récupérée.' })
  @ApiResponse({ status: 401, description: 'Token invalide ou expiré.' })
  async getChildren(@Req() req: any) {
    const parentId = req.user.id;
    const organisationId = req.user.organisationId;
    return this.parentPortalService.getChildren(parentId, organisationId);
  }

  @UseGuards(ParentJwtAuthGuard)
  @ApiBearerAuth()
  @Get('parent/notifications')
  @ApiOperation({
    summary: 'Historique des notifications des enfants du parent connecté',
  })
  async getNotifications(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const parentId = req.user.id;
    const organisationId = req.user.organisationId;
    return this.parentPortalService.getNotifications(
      parentId,
      organisationId,
      limit ? parseInt(limit, 10) : undefined,
      type,
    );
  }

  @UseGuards(ParentJwtAuthGuard)
  @ApiBearerAuth()
  @Patch('parent/notifications/:id/read')
  @ApiOperation({ summary: 'Marque une notification comme lue' })
  async markNotificationRead(@Req() req: any, @Param('id') id: string) {
    const parentId = req.user.id;
    const organisationId = req.user.organisationId;
    return this.parentPortalService.markNotificationRead(
      id,
      parentId,
      organisationId,
    );
  }

  @UseGuards(ParentJwtAuthGuard)
  @ApiBearerAuth()
  @Patch('parent/me/pin')
  @ApiBody({ type: ChangeParentPinDto })
  @ApiOperation({
    summary: 'Change le code PIN du parent connecté',
    description:
      "Le nouveau PIN est stocké en bcrypt. L'ancien est vérifié par bcrypt.compare.",
  })
  @ApiResponse({
    status: 200,
    description: 'PIN modifié. La base ne contient que le hash.',
  })
  @ApiResponse({ status: 400, description: "PIN qui n'est pas 4 chiffres." })
  @ApiResponse({ status: 401, description: 'PIN actuel incorrect.' })
  async changerMonPin(@Req() req: any, @Body() dto: ChangeParentPinDto) {
    const parentId = req.user.id;
    const organisationId = req.user.organisationId;
    return this.parentPortalService.changerMonPin(
      parentId,
      organisationId,
      dto.ancienPin,
      dto.nouveauPin,
    );
  }

  @UseGuards(ParentJwtAuthGuard)
  @ApiBearerAuth()
  @Patch('parent/me/notification-prefs')
  @ApiOperation({
    summary: 'Met à jour les préférences de notification du parent connecté',
  })
  async updateNotificationPrefs(
    @Req() req: any,
    @Body()
    body: { notifPunchEnabled?: boolean; notifProximityEnabled?: boolean },
  ) {
    const parentId = req.user.id;
    const organisationId = req.user.organisationId;
    return this.parentPortalService.updateNotificationPrefs(
      parentId,
      organisationId,
      body,
    );
  }

  @UseGuards(ParentJwtAuthGuard)
  @ApiBearerAuth()
  @Post('parent/fcm-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enregistre le token push FCM du parent connecté' })
  @ApiResponse({ status: 200, description: 'Token FCM enregistré.' })
  @ApiResponse({ status: 401, description: 'Token invalide ou expiré.' })
  async saveFcmToken(@Req() req: any, @Body('token') token: string) {
    const parentId = req.user.id;
    const organisationId = req.user.organisationId;
    return this.parentPortalService.saveFcmToken(
      parentId,
      organisationId,
      token,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @Get('admin/notifications/statut')
  @ApiOperation({
    summary:
      'Indique si les notifications push (proximité, pointages) sont réellement envoyées ou seulement simulées',
  })
  getStatutNotifications() {
    // La chaîne proximité→push (HardwareStreamService.checkProximityAlerts
    // → handleProximityNotification → FcmService) est câblée et fonctionne
    // de bout en bout — mais reste simulée/journalisée tant que Firebase
    // Admin SDK n'a pas de vraies clés (voir FcmService.onModuleInit).
    const fcmConfigure = this.fcmService.estConfigure();
    return {
      fcmConfigure,
      message: fcmConfigure
        ? 'Notifications push envoyées réellement.'
        : 'Firebase non configuré : les notifications push sont seulement journalisées, jamais envoyées à un téléphone.',
    };
  }
}
