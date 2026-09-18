import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common';
import { PointsRecuperationService } from './points-recuperation.service';
import { CreatePointDto } from './dto/create-point.dto';

@ApiTags('Points de Récupération')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('points-recuperation')
export class PointsRecuperationController {
  constructor(private readonly pointsService: PointsRecuperationService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les points de récupération, filtrables par trajet' })
  @ApiQuery({ name: 'trajetId', required: false, description: 'Filtrer par UUID du trajet' })
  findByTrajet(@Query('trajetId') trajetId: string) {
    return this.pointsService.findByTrajet(trajetId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupère un point de récupération par son UUID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.pointsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crée un nouveau point de récupération (arrêt de bus)' })
  create(@Body() dto: CreatePointDto) {
    return this.pointsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Met à jour un point de récupération' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreatePointDto>) {
    return this.pointsService.update(id, dto);
  }

  @Patch('reorder')
  @ApiOperation({
    summary: 'Réordonne les points d\'un trajet',
    description: 'Reçoit un tableau d\'UUIDs dans l\'ordre souhaité et met à jour ordrePassage.',
  })
  reorder(@Body('pointIds') pointIds: string[]) {
    return this.pointsService.reorder(pointIds);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un point de récupération' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.pointsService.delete(id);
  }
}
