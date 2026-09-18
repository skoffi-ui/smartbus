import { Controller, Get, Post, Body, UseGuards, Inject, Param } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { NotificationsService } from './notifications.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
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

  @Post('parents/:id/fcm-token')
  @ApiOperation({ summary: "Enregistrer le jeton FCM d'un parent (Mobile App)" })
  async updateFcmToken(@Param('id') parentId: string, @Body('token') fcmToken: string) {
    return this.notificationsService.updateParentToken(parentId, fcmToken);
  }

  // Internal Webhook called by super-app
  // In a real prod environment, we would use an API Key or internal token
  @Post('internal-webhook')
  async handleInternalPunchWebhook(@Body() payload: any) {
    // Mocking the request user for TenantService to work inside an unauthenticated webhook
    // This is a hack for the prototype since we have 1 school = 1 biotime server
    // L'identification de l'école se fera dynamiquement dans le service
    // pour éviter que ça plante si une école est supprimée.
    return this.notificationsService.handleInternalPunchWebhook(payload);
  }
}
