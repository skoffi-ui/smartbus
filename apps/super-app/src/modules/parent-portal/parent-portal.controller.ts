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
} from '@nestjs/swagger';
import { ParentPortalService } from './parent-portal.service';
import { FcmService } from './fcm.service';
import { ParentLoginDto } from './dto/parent-login.dto';
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
  @Post('auth/parent/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Connexion de l'application mobile des parents" })
  @ApiResponse({ status: 200, description: 'Connexion réussie.' })
  @ApiResponse({ status: 401, description: 'Identifiants ou PIN incorrects.' })
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
  @ApiOperation({ summary: 'Change le code PIN du parent connecté' })
  async changerMonPin(
    @Req() req: any,
    @Body() body: { ancienPin: string; nouveauPin: string },
  ) {
    const parentId = req.user.id;
    const organisationId = req.user.organisationId;
    return this.parentPortalService.changerMonPin(
      parentId,
      organisationId,
      body.ancienPin,
      body.nouveauPin,
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
