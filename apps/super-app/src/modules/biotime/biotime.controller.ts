import { Controller, Post, Get, HttpCode, HttpStatus, Query, Render, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BiotimeService } from './biotime.service';

@ApiTags('BioTime Sync Test')
@Controller('biotime')
export class BiotimeController {
  constructor(
    private readonly biotimeService: BiotimeService,
    @InjectQueue('biotime-sync') private readonly biotimeQueue: Queue,
  ) {}

  @Get('dashboard')
  @Render('dashboard')
  @ApiOperation({ summary: 'Affiche le tableau de bord visuel' })
  getDashboard() {
    return { title: 'Tableau de Bord SMARTBUS' };
  }

  @Get('config')
  @ApiOperation({ summary: 'Récupère la configuration dynamique BioTime' })
  getConfig() {
    return { url: this.biotimeService['biotimeUrl'] };
  }

  @Post('config')
  @ApiOperation({ summary: 'Met à jour la configuration dynamique BioTime' })
  saveConfig(@Body('url') url: string) {
    return this.biotimeService.saveConfigUrl(url);
  }

  @Get('devices')
  @ApiOperation({ summary: 'Récupère la liste des terminaux physiques enregistrés' })
  getDevices() {
    return this.biotimeService.listDevices();
  }

  @Post('sync-children')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Synchronise les employés (enfants) depuis BioTime via BullMQ' })
  @ApiResponse({ status: 202, description: 'Synchronisation ajoutée à la file d\'attente.' })
  async syncChildren() {
    const job = await this.biotimeQueue.add('sync-children', {});
    return {
      message: 'La synchronisation des enfants a été ajoutée à la file d\'attente.',
      jobId: job.id,
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Point d\'entrée Webhook pour les pointages en temps réel' })
  @ApiBody({ description: 'Payload envoyé par BioTime (peut être un objet ou un tableau)', required: true })
  @ApiResponse({ status: 200, description: 'Webhook traité avec succès.' })
  async receiveWebhook(@Body() payload: any) {
    return this.biotimeService.handleWebhook(payload);
  }

  @Post('sync-punches')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Synchronise les transactions (pointages) depuis BioTime via BullMQ' })
  @ApiQuery({ name: 'date', required: false, description: 'Format YYYY-MM-DD. Par défaut: aujourd\'hui' })
  @ApiResponse({ status: 202, description: 'Synchronisation ajoutée à la file d\'attente.' })
  async syncPunches(@Query('date') date?: string) {
    const job = await this.biotimeQueue.add('sync-punches', { dateStr: date });
    return {
      message: 'La synchronisation des pointages a été ajoutée à la file d\'attente.',
      jobId: job.id,
    };
  }

  @Get('children')
  @ApiOperation({ summary: 'Récupère la liste des enfants et de leurs pointages pour une date donnée' })
  @ApiQuery({ name: 'date', required: false, description: 'Format YYYY-MM-DD. Par défaut: aujourd\'hui' })
  @ApiResponse({ status: 200, description: 'Liste des enfants retournée.' })
  async getChildren(@Query('date') date?: string) {
    return this.biotimeService.findAllChildren(date);
  }

  @Get('punches')
  @ApiOperation({ summary: 'Récupère l\'historique des pointages pour une date donnée' })
  @ApiQuery({ name: 'date', required: false, description: 'Format YYYY-MM-DD. Par défaut: aujourd\'hui' })
  @ApiResponse({ status: 200, description: 'Historique des pointages retourné.' })
  async getPunches(@Query('date') date?: string) {
    return this.biotimeService.findAllPunches(date);
  }

  @Get('punches/empcode/:empCode')
  @ApiOperation({ summary: 'Récupère l\'historique des pointages pour un élève spécifique' })
  @ApiResponse({ status: 200, description: 'Historique des pointages de l\'élève retourné.' })
  async getPunchesByEmpCode(@Param('empCode') empCode: string) {
    return this.biotimeService.getPunchesByEmpCode(empCode);
  }

  @Get('employee/:empCode')
  @ApiOperation({ summary: 'Récupère les informations d\'un élève spécifique depuis BioTime' })
  @ApiResponse({ status: 200, description: 'Informations de l\'élève retournées.' })
  async getEmployeeByEmpCode(@Param('empCode') empCode: string) {
    return this.biotimeService.getEmployeeByEmpCode(empCode);
  }

  @Get('directory')
  @ApiOperation({ summary: 'Récupère le répertoire complet des employés BioTime' })
  @ApiResponse({ status: 200, description: 'Répertoire retourné avec succès.' })
  async getDirectory() {
    return this.biotimeService.getDirectory();
  }

  @Post('directory/bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Récupère les détails d\'une liste d\'employés' })
  @ApiBody({ schema: { example: { empCodes: ['123', '456'] } } })
  @ApiResponse({ status: 200, description: 'Détails retournés.' })
  async getDirectoryBulk(@Body('empCodes') empCodes: string[]) {
    return this.biotimeService.getDirectoryBulk(empCodes);
  }
}
