import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { JwtAuthGuard, RolesGuard, Roles, PaginationDto, CurrentUser } from '@app/common';
import { UserRole } from '@app/common';

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Créer un abonnement' })
  create(@Body() dto: CreateSubscriptionDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Lister tous les abonnements' })
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get('organisation/:organisationId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Abonnements d\'une organisation' })
  findByOrganisation(
    @Param('organisationId') organisationId: string,
    @CurrentUser() user: { organisationId?: string; role?: string },
  ) {
    // Un directeur ne peut consulter QUE l'abonnement de sa propre école —
    // sans ce garde, il pouvait lire l'abonnement (et son prix) d'une autre
    // école en devinant/énumérant son organisationId. Le Super Admin reste
    // libre de consulter n'importe quelle école.
    if (user.role === UserRole.SCHOOL_ADMIN && user.organisationId !== organisationId) {
      throw new ForbiddenException("Vous ne pouvez consulter que l'abonnement de votre propre école.");
    }
    return this.service.findByOrganisation(organisationId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Récupérer un abonnement' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un abonnement' })
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Annuler un abonnement' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un abonnement' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
