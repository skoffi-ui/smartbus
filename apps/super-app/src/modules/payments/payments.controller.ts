import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CinetpayService } from './cinetpay.service';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
  UserRole,
} from '@app/common';
import { SubscriptionPlan } from '@app/database';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({
    enum: SubscriptionPlan,
    default: SubscriptionPlan.STARTER,
    description:
      'Le forfait choisi (starter, basic, standard, premium, enterprise)',
    example: 'premium',
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

  @ApiProperty({
    example: 'orange',
    description: 'Le moyen de paiement choisi (orange, mtn, wave, card)',
  })
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
  @ApiOperation({
    summary: "Simuler un paiement (Sandbox) pour l'école connectée",
  })
  async checkout(@CurrentUser() user: any, @Body() body: CheckoutDto) {
    return this.paymentsService.sandboxCheckout(user.organisationId, body.plan);
  }

  @Post('initiate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Initialiser un paiement Mobile Money (Orange, MTN, Wave, Carte)',
  })
  async initiatePayment(
    @CurrentUser() user: any,
    @Body() body: InitiatePaymentDto,
  ) {
    return this.cinetpayService.initiatePayment(
      user.organisationId,
      body.plan,
      body.amount,
      body.method,
    );
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook de notification CinetPay (Public)' })
  async webhook(
    @Body() body: { paymentId: string; status: string; transactionId: string },
  ) {
    return this.cinetpayService.handleWebhook(body);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Voir l'historique de toutes les factures (Super Admin)",
  })
  findAll() {
    return this.paymentsService.findAll();
  }
}
