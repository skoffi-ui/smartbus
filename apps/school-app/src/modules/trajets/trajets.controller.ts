import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common';
import { TrajetsService } from './trajets.service';
import { CreateTrajetDto } from './dto/create-trajet.dto';
import { UpdateTrajetDto } from './dto/update-trajet.dto';

@ApiTags('Trajets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trajets')
export class TrajetsController {
  constructor(private readonly trajetsService: TrajetsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste tous les trajets géographiques' })
  findAll() {
    return this.trajetsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupère un trajet avec ses points de récupération' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.trajetsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crée un nouveau trajet' })
  create(@Body() dto: CreateTrajetDto) {
    return this.trajetsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Met à jour les informations d\'un trajet' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTrajetDto) {
    return this.trajetsService.update(id, dto);
  }

  @Patch(':id/geojson')
  @ApiOperation({
    summary: 'Met à jour uniquement le tracé GeoJSON',
    description: 'Endpoint appelé par MapEditor.tsx (Leaflet.draw) lors de la sauvegarde du tracé dessiné.',
  })
  updateGeoJson(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('geoJson') geoJson: Record<string, any>,
  ) {
    return this.trajetsService.updateGeoJson(id, geoJson);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un trajet' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.trajetsService.delete(id);
  }
}
