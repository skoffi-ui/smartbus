import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, FeaturesGuard, RequireFeature } from '@app/common';
import { MonteesService } from './montees.service';

@ApiTags('Montées & Validation')
@Controller('montees')
export class MonteesController {
  constructor(private readonly monteesService: MonteesService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, FeaturesGuard)
  @RequireFeature('suivi')
  @ApiOperation({ summary: 'Historique des 200 dernières montées/descentes' })
  findAll() {
    return this.monteesService.findAll();
  }

  @Get('enfant/:childId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, FeaturesGuard)
  @RequireFeature('suivi')
  @ApiOperation({ summary: "Historique de transport d'un enfant spécifique" })
  findByChild(@Param('childId', ParseUUIDPipe) childId: string) {
    return this.monteesService.findByChild(childId);
  }

  @Get('alertes')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, FeaturesGuard)
  @RequireFeature('alertes')
  @ApiOperation({ summary: 'Liste les 100 dernières alertes de transport' })
  findAlertes() {
    return this.monteesService.findAlertes();
  }

  // `POST /montees/validation` (ingestion biométrique via BullMQ) a été
  // retiré : bloqué à la gateway (BLOCKED_ROUTES) et jamais appelé en
  // interne — voir la note en tête de `montees.service.ts`.
}
