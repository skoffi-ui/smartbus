import { Controller, Get, Patch, Param, Body, UseGuards, ParseEnumPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlanTarifsService } from './plan-tarifs.service';
import { UpdatePlanTarifDto } from './dto/update-plan-tarif.dto';
import { JwtAuthGuard, RolesGuard, Roles, UserRole } from '@app/common';
import { SubscriptionPlan } from '@app/database';

/**
 * Grille tarifaire des 5 forfaits — lecture ouverte aux directeurs (voir
 * Abonnement.tsx, school-web, qui a besoin des vrais prix), écriture
 * réservée au Super Admin (voir Subscriptions.tsx, super-admin-web).
 */
@ApiTags('plan-tarifs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('plan-tarifs')
export class PlanTarifsController {
  constructor(private readonly service: PlanTarifsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Liste les 5 forfaits et leur tarif actuel' })
  findAll() {
    return this.service.findAll();
  }

  @Patch(':plan')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Modifie le tarif d'un forfait" })
  update(
    @Param('plan', new ParseEnumPipe(SubscriptionPlan)) plan: SubscriptionPlan,
    @Body() dto: UpdatePlanTarifDto,
  ) {
    return this.service.update(plan, dto);
  }
}
