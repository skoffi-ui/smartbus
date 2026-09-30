import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateBillingRecordDto } from './dto/create-billing-record.dto';
import { JwtAuthGuard, RolesGuard, Roles, PaginationDto } from '@app/common';
import { UserRole } from '@app/common';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Créer un enregistrement de facturation' })
  create(@Body() dto: CreateBillingRecordDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Lister tous les enregistrements' })
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get('organisation/:organisationId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Facturation d'une organisation" })
  findByOrganisation(@Param('organisationId') organisationId: string) {
    return this.service.findByOrganisation(organisationId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Récupérer une facture' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/complete')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Marquer un paiement comme effectué' })
  markCompleted(
    @Param('id') id: string,
    @Body('transactionId') transactionId: string,
  ) {
    return this.service.markAsCompleted(id, transactionId);
  }

  @Patch(':id/fail')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Marquer un paiement comme échoué' })
  markFailed(@Param('id') id: string) {
    return this.service.markAsFailed(id);
  }
}
