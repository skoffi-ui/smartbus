import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, UserRole } from '@app/common';
import { SubscriptionPlan } from '@app/database';

import { ApiProperty } from '@nestjs/swagger';

export class CheckoutDto {
  @ApiProperty({ 
    enum: SubscriptionPlan, 
    default: SubscriptionPlan.STARTER, 
    description: 'Le forfait choisi (starter, basic, standard, premium, enterprise)',
    example: 'premium'
  })
  plan?: SubscriptionPlan;
}

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Simuler un paiement (Sandbox) pour l\'école connectée' })
  async checkout(@CurrentUser() user: any, @Body() body: CheckoutDto) {
    // Dans la vraie vie, on redirigerait vers l'URL de la banque ici.
    // En mode Sandbox, on valide le paiement directement.
    return this.paymentsService.sandboxCheckout(user.organisationId, body.plan);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Voir l\'historique de toutes les factures (Super Admin)' })
  findAll() {
    return this.paymentsService.findAll();
  }
}
