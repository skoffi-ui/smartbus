import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse, ApiSecurity, ApiProperty } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CinetpayService } from './cinetpay.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, UserRole } from '@app/common';
import { SubscriptionPlan } from '@app/database';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { CinetpayWebhookDto } from './dto/cinetpay-webhook.dto';
import { PaymentWebhookGuard } from './payment-webhook.guard';
import {
  CINETPAY_WEBHOOK_SECRET_HEADER,
  CINETPAY_WEBHOOK_SECURITY_SCHEME,
} from './payment-webhook.constants';

export class CheckoutDto {
  @ApiProperty({ 
    enum: SubscriptionPlan, 
    default: SubscriptionPlan.STARTER, 
    description: 'Le forfait choisi (starter, basic, standard, premium, enterprise)',
    example: 'premium'
  })
  @IsEnum(SubscriptionPlan)
  @IsOptional()
  plan?: SubscriptionPlan;
}

export class InitiatePaymentDto {
  @ApiProperty({ example: 'STARTER', description: 'Le forfait choisi' })
  @IsString()
  plan: string;

  @ApiProperty({ example: 50000, description: 'Le montant en FCFA' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'orange', description: 'Le moyen de paiement choisi (orange, mtn, wave, card)' })
  @IsString()
  method: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly cinetpayService: CinetpayService,
  ) {}

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Simuler un paiement (Sandbox) pour l\'école connectée' })
  async checkout(@CurrentUser() user: any, @Body() body: CheckoutDto) {
    return this.paymentsService.sandboxCheckout(user.organisationId, body.plan);
  }

  @Post('initiate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Initialiser un paiement Mobile Money (Orange, MTN, Wave, Carte)' })
  async initiatePayment(@CurrentUser() user: any, @Body() body: InitiatePaymentDto) {
    return this.cinetpayService.initiatePayment(user.organisationId, body.plan, body.amount, body.method);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PaymentWebhookGuard)
  @ApiSecurity(CINETPAY_WEBHOOK_SECURITY_SCHEME)
  @ApiHeader({
    name: CINETPAY_WEBHOOK_SECRET_HEADER,
    required: true,
    description:
      'Secret partagé (CINETPAY_WEBHOOK_SECRET), comparé en temps constant. Distinct du JWT utilisateur. Aucun paramètre d\'URL n\'est accepté.',
  })
  @ApiOperation({
    summary: 'Notification CinetPay (secret partagé, sans JWT)',
    description:
      'Route sans JWT : l\'appelant est le prestataire ou le simulateur. ' +
      'Le corps est validé, le montant et la devise sont confrontés au paiement PENDING, ' +
      'et une transaction déjà traitée est refusée (409) sans prolonger l\'abonnement une seconde fois.',
  })
  @ApiResponse({ status: 200, description: 'Notification acceptée. L\'abonnement n\'est prolongé que si le paiement était encore PENDING.' })
  @ApiResponse({ status: 400, description: 'Corps invalide, ou montant/devise différents du paiement PENDING.' })
  @ApiResponse({ status: 401, description: `Secret absent ou invalide (en-tête ${CINETPAY_WEBHOOK_SECRET_HEADER}).` })
  @ApiResponse({ status: 404, description: 'Paiement introuvable.' })
  @ApiResponse({ status: 409, description: 'Transaction déjà traitée : l\'abonnement n\'est pas prolongé une seconde fois.' })
  async webhook(@Body() body: CinetpayWebhookDto) {
    return this.cinetpayService.handleWebhook(body);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Voir l\'historique de toutes les factures (Super Admin)' })
  findAll() {
    return this.paymentsService.findAll();
  }
}
