import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard, FeaturesGuard, RequireFeature } from '@app/common';
import { AffectationsService } from './affectations.service';
import { CreateAffectationDto } from './dto/create-affectation.dto';

@ApiTags('Affectations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeaturesGuard)
@RequireFeature('affectation')
@Controller('affectations')
export class AffectationsController {
  constructor(private readonly affectationsService: AffectationsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste toutes les affectations Enfant → Point' })
  findAll() {
    return this.affectationsService.findAll();
  }

  @Get('by-child/:childId')
  @ApiOperation({
    summary:
      "Liste les affectations d'un enfant (une par course : matin, retour midi, remontée 14h...)",
  })
  findByChild(@Param('childId', ParseUUIDPipe) childId: string) {
    return this.affectationsService.findByChild(childId);
  }

  @Get('by-point/:pointId')
  @ApiOperation({
    summary: 'Liste tous les enfants affectés à un point de récupération',
  })
  findByPoint(@Param('pointId', ParseUUIDPipe) pointId: string) {
    return this.affectationsService.findByPoint(pointId);
  }

  @Post()
  @ApiOperation({ summary: 'Affecte un enfant à un point de récupération' })
  create(@Body() dto: CreateAffectationDto) {
    return this.affectationsService.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime une affectation par son UUID' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.affectationsService.delete(id);
  }

  @Delete('by-child/:childId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Supprime l'affectation d'un enfant (pour le réaffecter ensuite)",
  })
  deleteByChild(@Param('childId', ParseUUIDPipe) childId: string) {
    return this.affectationsService.deleteByChild(childId);
  }
}
