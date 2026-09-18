import {
  Controller, Get, Post, Param, Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common';
import { MonteesService } from './montees.service';

@ApiTags('Montées & Validation')
@Controller('montees')
export class MonteesController {
  constructor(private readonly monteesService: MonteesService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Historique des 200 dernières montées/descentes' })
  findAll() {
    return this.monteesService.findAll();
  }

  @Get('enfant/:childId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Historique de transport d\'un enfant spécifique' })
  findByChild(@Param('childId', ParseUUIDPipe) childId: string) {
    return this.monteesService.findByChild(childId);
  }

  @Get('alertes')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Liste les 100 dernières alertes de transport' })
  findAlertes() {
    return this.monteesService.findAlertes();
  }

  /**
   * Endpoint de validation biométrique.
   * Appelé par la badgeuse ou le service BioTime.
   * NE REQUIERT PAS d'authentification JWT pour permettre les appels matériels.
   * Répond instantanément et délègue le traitement à BullMQ.
   */
  @Post('validation')
  @ApiOperation({
    summary: 'Validation biométrique (point d\'entrée BioTime / Badgeuse)',
    description: 'Met en file un job asynchrone BullMQ. Répond immédiatement sans attendre le calcul GPS.',
  })
  async enqueueValidation(
    @Body() payload: {
      empCode: string;
      terminalSn: string;
      gpsLat?: number;
      gpsLng?: number;
      punchTime: string;
      tenantId?: string;
    },
  ) {
    return this.monteesService.enqueueValidation(payload);
  }
}
