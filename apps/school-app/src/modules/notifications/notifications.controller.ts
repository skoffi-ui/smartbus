import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Inject,
  Param,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { NotificationsService } from './notifications.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  InternalApiKeyGuard,
} from '@app/common';
import { UserRole } from '@app/database';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    @Inject(REQUEST) private request: any,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @Get()
  async getRecentNotifications() {
    return this.notificationsService.getRecentNotifications();
  }

  /**
   * Cette route était ouverte : n'importe qui pouvait enregistrer un jeton de
   * notification pour n'importe quel parent, et détourner ainsi les alertes de
   * montée et de descente de son enfant vers un autre téléphone.
   *
   * À revoir lorsque l'App Parent existera : elle devra s'authentifier comme
   * parent et ne pouvoir modifier que son propre jeton.
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @Post('parents/:id/fcm-token')
  @ApiOperation({ summary: "Enregistrer le jeton FCM d'un parent" })
  async updateFcmToken(
    @Param('id') parentId: string,
    @Body('token') fcmToken: string,
  ) {
    return this.notificationsService.updateParentToken(parentId, fcmToken);
  }

  /**
   * Relais de pointage envoyé par la SUPER APP.
   *
   * Aucun utilisateur ne l'appelle, donc pas de JWT possible — elle était de ce
   * fait totalement ouverte, et permettait d'injecter de fausses notifications
   * aux parents. Elle exige désormais le secret partagé entre services.
   */
  @UseGuards(InternalApiKeyGuard)
  @Post('internal-webhook')
  async handleInternalPunchWebhook(@Body() payload: any) {
    // Mocking the request user for TenantService to work inside an unauthenticated webhook
    // This is a hack for the prototype since we have 1 school = 1 biotime server
    // L'identification de l'école se fera dynamiquement dans le service
    // pour éviter que ça plante si une école est supprimée.
    return this.notificationsService.handleInternalPunchWebhook(payload);
  }
}
