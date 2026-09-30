import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService, DeviceData } from './devices.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { UserRole } from '@app/database';
import { GpswoxService } from '../gpswox/gpswox.service';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly gpswoxService: GpswoxService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister tout le matériel du parc SaaS' })
  findAll() {
    return this.devicesService.findAll();
  }

  @Get('gpswox-sante')
  @ApiOperation({
    summary: 'Santé du sondage GPSWOX (dernier succès, échecs consécutifs)',
  })
  getGpswoxSante() {
    return this.gpswoxService.getSante();
  }

  @Post()
  @ApiOperation({ summary: 'Enregistrer un nouvel équipement' })
  create(@Body() data: DeviceData) {
    return this.devicesService.create(data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un équipement' })
  remove(@Param('id') id: string) {
    return this.devicesService.remove(id);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Allouer un équipement à une école' })
  assign(@Param('id') id: string, @Body() body: { organisationId: string }) {
    return this.devicesService.assign(id, body.organisationId);
  }

  @Post(':id/release')
  @ApiOperation({ summary: 'Libérer un équipement de son école' })
  release(@Param('id') id: string) {
    return this.devicesService.release(id);
  }
}
