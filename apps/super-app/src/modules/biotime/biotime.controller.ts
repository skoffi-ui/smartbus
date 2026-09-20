import {
  Controller,
  Post,
  Get,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  Render,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard, RolesGuard, Roles, UserRole, Public, CurrentUser } from '@app/common';
import { BiotimeService } from './biotime.service';
import { BiotimeConfigService, EnregistrerConfigDto } from './biotime-config.service';

/**
 * Supervision des serveurs BioTime des écoles.
 *
 * Chaque école a son propre serveur : toutes les routes sont paramétrées par
 * `organisationId`. Réservé au super admin, hormis le webhook d'ingestion.
 */
@ApiTags('BioTime')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('biotime')
export class BiotimeController {
  constructor(
    private readonly biotimeService: BiotimeService,
    private readonly configService: BiotimeConfigService,
    @InjectQueue('biotime-sync') private readonly biotimeQueue: Queue,
  ) {}

  @Get('dashboard')
  @Render('dashboard')
  @ApiOperation({ summary: 'Affiche le tableau de bord visuel' })
  getDashboard() {
    return { title: 'Tableau de Bord SMARTBUS' };
  }

  // ── Configuration par école ─────────────────────────────────────────────

  @Get('configs')
  @ApiOperation({ summary: 'Configurations BioTime de toutes les écoles' })
  listerConfigs() {
    return this.configService.listerToutes();
  }

  @Get('configs/:organisationId')
  @ApiOperation({ summary: "Configuration BioTime d'une école" })
  obtenirConfig(@Param('organisationId') organisationId: string) {
    return this.configService.obtenirPublique(organisationId);
  }

  @Post('configs/:organisationId')
  @ApiOperation({ summary: "Crée ou met à jour le serveur BioTime d'une école" })
  @ApiBody({
    schema: {
      example: {
        url: 'http://192.168.1.50:8080',
        username: 'admin',
        password: 'secret',
        isActive: true,
      },
    },
  })
  enregistrerConfig(
    @Param('organisationId') organisationId: string,
    @Body() dto: EnregistrerConfigDto,
  ) {
    return this.configService.enregistrer(organisationId, dto);
  }

  @Delete('configs/:organisationId')
  @ApiOperation({ summary: "Supprime la configuration BioTime d'une école" })
  async supprimerConfig(@Param('organisationId') organisationId: string) {
    await this.configService.supprimer(organisationId);
    return { success: true };
  }

  @Post('configs/:organisationId/test')
  @ApiOperation({ summary: "Teste la connexion au serveur BioTime d'une école" })
  testerConnexion(@Param('organisationId') organisationId: string) {
    return this.biotimeService.testerConnexion(organisationId);
  }

  // ── Répertoire de SA propre école (responsable d'établissement) ─────────
  //
  // L'école vient du JWT, jamais d'un paramètre : un responsable ne peut lire
  // que l'annuaire BioTime de son établissement. C'est ce que consomme l'APP
  // école pour importer ses enfants depuis les empreintes enrôlées sur place.

  @Get('mon-ecole/directory')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Répertoire BioTime de sa propre école" })
  getMonDirectory(@CurrentUser() user: { organisationId?: string }) {
    return this.biotimeService.getDirectory(this.ecoleDe(user));
  }

  @Post('mon-ecole/directory/bulk')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Détails d'une liste d'élèves de sa propre école" })
  @ApiBody({ schema: { example: { empCodes: ['123', '456'] } } })
  getMonDirectoryBulk(
    @CurrentUser() user: { organisationId?: string },
    @Body('empCodes') empCodes: string[],
  ) {
    return this.biotimeService.getDirectoryBulk(this.ecoleDe(user), empCodes);
  }

  @Get('mon-ecole/employee/:empCode')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Informations BioTime d'un élève de sa propre école" })
  getMonEmployee(
    @CurrentUser() user: { organisationId?: string },
    @Param('empCode') empCode: string,
  ) {
    return this.biotimeService.getEmployeeByEmpCode(this.ecoleDe(user), empCode);
  }

  @Get('mon-ecole/punches/empcode/:empCode')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Pointages d'un élève de sa propre école" })
  getMesPunches(
    @CurrentUser() user: { organisationId?: string },
    @Param('empCode') empCode: string,
  ) {
    return this.biotimeService.getPunchesByEmpCode(this.ecoleDe(user), empCode);
  }

  private ecoleDe(user: { organisationId?: string }): string {
    if (!user?.organisationId) {
      throw new ForbiddenException("Aucune école n'est associée à ce compte.");
    }
    return user.organisationId;
  }

  // ── Synchronisations ────────────────────────────────────────────────────

  @Post(':organisationId/sync-children')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Synchronise l'annuaire des enfants d'une école" })
  async syncChildren(@Param('organisationId') organisationId: string) {
    const job = await this.biotimeQueue.add('sync-children', { organisationId });
    return { message: "Synchronisation de l'annuaire mise en file.", jobId: job.id };
  }

  @Post(':organisationId/sync-punches')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Synchronise les pointages d'une école" })
  @ApiQuery({ name: 'depuis', required: false, description: 'ISO. Par défaut : dernier passage.' })
  async syncPunches(
    @Param('organisationId') organisationId: string,
    @Query('depuis') depuis?: string,
  ) {
    const job = await this.biotimeQueue.add('sync-punches', { organisationId, depuis });
    return { message: 'Synchronisation des pointages mise en file.', jobId: job.id };
  }

  // ── Lectures de supervision ─────────────────────────────────────────────

  @Get(':organisationId/devices')
  @ApiOperation({ summary: "Terminaux physiques alloués à une école" })
  getDevices(@Param('organisationId') organisationId: string) {
    return this.biotimeService.listDevices(organisationId);
  }

  @Get(':organisationId/children')
  @ApiOperation({ summary: "Enfants d'une école et leurs pointages du jour" })
  @ApiQuery({ name: 'date', required: false, description: 'Format YYYY-MM-DD.' })
  getChildren(@Param('organisationId') organisationId: string, @Query('date') date?: string) {
    return this.biotimeService.findAllChildren(organisationId, date);
  }

  @Get(':organisationId/punches')
  @ApiOperation({ summary: "Historique des pointages d'une école" })
  @ApiQuery({ name: 'date', required: false, description: 'Format YYYY-MM-DD.' })
  getPunches(@Param('organisationId') organisationId: string, @Query('date') date?: string) {
    return this.biotimeService.findAllPunches(organisationId, date);
  }

  @Get(':organisationId/punches/empcode/:empCode')
  @ApiOperation({ summary: "Historique des pointages d'un élève" })
  getPunchesByEmpCode(
    @Param('organisationId') organisationId: string,
    @Param('empCode') empCode: string,
  ) {
    return this.biotimeService.getPunchesByEmpCode(organisationId, empCode);
  }

  @Get(':organisationId/employee/:empCode')
  @ApiOperation({ summary: "Informations BioTime d'un élève" })
  getEmployeeByEmpCode(
    @Param('organisationId') organisationId: string,
    @Param('empCode') empCode: string,
  ) {
    return this.biotimeService.getEmployeeByEmpCode(organisationId, empCode);
  }

  @Get(':organisationId/directory')
  @ApiOperation({ summary: "Répertoire BioTime d'une école" })
  getDirectory(@Param('organisationId') organisationId: string) {
    return this.biotimeService.getDirectory(organisationId);
  }

  @Post(':organisationId/directory/bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Détails d'une liste d'élèves d'une école" })
  @ApiBody({ schema: { example: { empCodes: ['123', '456'] } } })
  getDirectoryBulk(
    @Param('organisationId') organisationId: string,
    @Body('empCodes') empCodes: string[],
  ) {
    return this.biotimeService.getDirectoryBulk(organisationId, empCodes);
  }


  // ── Ingestion poussée ───────────────────────────────────────────────────

  /**
   * Sans JWT : l'appelant est un relais ou un agent installé chez l'école, pas un
   * utilisateur. L'école est déduite de l'appairage du terminal.
   *
   * À FAIRE : authentifier par secret d'appareil (HMAC).
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @UseGuards()
  @ApiOperation({ summary: 'Réception poussée de pointages (relais / agent)' })
  @ApiResponse({ status: 200, description: 'Webhook traité.' })
  receiveWebhook(@Body() payload: any) {
    return this.biotimeService.handleWebhook(payload);
  }
}
