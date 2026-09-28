import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  Render,
  Body,
  Param,
  ParseIntPipe,
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
import { JwtAuthGuard, RolesGuard, Roles, UserRole, CurrentUser } from '@app/common';
import { BiotimeService } from './biotime.service';
import {
  CreateBiotimeEmployeeDto,
  UpdateBiotimeEmployeeDto,
  CreateBiotimeDepartmentDto,
  UpdateBiotimeDepartmentDto,
  CreateBiotimeAreaDto,
  UpdateBiotimeAreaDto,
  CreateBiotimePositionDto,
  UpdateBiotimePositionDto,
} from './dto/biotime-write.dto';

/**
 * Annuaire/employés/pointages BioTime, par école.
 *
 * L'ancien réglage par école (URL/identifiants propres, webhook d'ingestion
 * poussée) a été retiré : `biotime_configs` était vide dans les 2 seules
 * écoles réelles à ce jour, et l'architecture cible est un serveur BioTime
 * central unique (voir `BiotimeCentralService`/`BiotimeAdminController`,
 * page Super Admin « Gestion BioTime Centralisée »). `BiotimeConfigService`
 * reste néanmoins un vrai dépendance interne de `BiotimeService`
 * (résolution des identifiants, suivi succès/échec) — seules les routes
 * CRUD/test/webhook, qui n'étaient plus appelées par aucun frontend, ont
 * été retirées ici.
 */
@ApiTags('BioTime')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
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

  // ── Répertoire de SA propre école (responsable d'établissement) ─────────
  //
  // L'école vient du JWT, jamais d'un paramètre : un responsable ne peut lire
  // que l'annuaire BioTime de son établissement. C'est ce que consomme l'APP
  // école pour importer ses enfants depuis les empreintes enrôlées sur place.

  @Get('mon-ecole/biotime-employees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Employés lus directement depuis le serveur BioTime (avec ID internes)" })
  getMonBiotimeEmployees(@CurrentUser() user: { organisationId?: string }) {
    return this.biotimeService.getBiotimeEmployees(this.ecoleDe(user));
  }

  @Post('mon-ecole/sync-children')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Synchronise l'annuaire de sa propre école" })
  async syncMonChildren(@CurrentUser() user: { organisationId?: string }) {
    const organisationId = this.ecoleDe(user);
    const job = await this.biotimeQueue.add('sync-children', { organisationId });
    return { message: "Synchronisation de l'annuaire mise en file.", jobId: job.id };
  }

  @Post('mon-ecole/push-child')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Pousse un élève vers le serveur BioTime de sa propre école" })
  @ApiBody({
    schema: {
      example: {
        empCode: '10042',
        firstName: 'Aya',
        lastName: 'Konan',
        className: '6ème A',
        biotimeId: null,
      },
    },
  })
  pushMonChild(
    @CurrentUser() user: { organisationId?: string },
    @Body() body: { empCode: string; firstName: string; lastName: string; className?: string; biotimeId?: number },
  ) {
    return this.biotimeService.pushChild(this.ecoleDe(user), body);
  }

  @Post('mon-ecole/push-children-batch')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Pousse un lot d'élèves vers BioTime (async via BullMQ)" })
  @ApiBody({
    schema: {
      example: {
        enfants: [
          { childId: 'uuid', empCode: '10042', firstName: 'Aya', lastName: 'Konan', className: '6ème A' },
        ],
      },
    },
  })
  async pushMonChildrenBatch(
    @CurrentUser() user: { organisationId?: string },
    @Body('enfants') enfants: Array<{
      childId: string; empCode: string; firstName: string; lastName: string;
      className?: string; biotimeId?: number;
    }>,
  ) {
    const organisationId = this.ecoleDe(user);
    const job = await this.biotimeQueue.add('push-children-batch', {
      organisationId,
      enfants: enfants ?? [],
    });
    return {
      message: `Push de ${enfants?.length ?? 0} élève(s) mis en file.`,
      jobId: job.id,
    };
  }

  @Post('mon-ecole/sync-departments')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Synchronise les classes vers les départements BioTime" })
  @ApiBody({ schema: { example: { classNames: ['6ème A', '5ème B', 'CM2'] } } })
  syncMonDepartments(
    @CurrentUser() user: { organisationId?: string },
    @Body('classNames') classNames: string[],
  ) {
    return this.biotimeService.syncDepartmentsFromClasses(this.ecoleDe(user), classNames ?? []);
  }

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

  // ── Écriture BioTime pour sa propre école (responsable d'établissement) ─

  @Post('mon-ecole/employees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Crée un employé sur le serveur BioTime de sa propre école" })
  createMonEmployee(
    @CurrentUser() user: { organisationId?: string },
    @Body() dto: CreateBiotimeEmployeeDto,
  ) {
    return this.biotimeService.createEmployee(this.ecoleDe(user), dto);
  }

  @Patch('mon-ecole/employees/:biotimeId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Met à jour un employé sur le serveur BioTime de sa propre école" })
  updateMonEmployee(
    @CurrentUser() user: { organisationId?: string },
    @Param('biotimeId', ParseIntPipe) biotimeId: number,
    @Body() dto: UpdateBiotimeEmployeeDto,
  ) {
    return this.biotimeService.updateEmployee(this.ecoleDe(user), biotimeId, dto);
  }

  @Delete('mon-ecole/employees/:biotimeId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Supprime un employé sur le serveur BioTime de sa propre école" })
  deleteMonEmployee(
    @CurrentUser() user: { organisationId?: string },
    @Param('biotimeId', ParseIntPipe) biotimeId: number,
  ) {
    return this.biotimeService.deleteEmployee(this.ecoleDe(user), biotimeId);
  }

  @Get('mon-ecole/biotime-terminals')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Liste les terminaux BioTime de sa propre école" })
  getMonBiotimeTerminals(@CurrentUser() user: { organisationId?: string }) {
    return this.biotimeService.getBiotimeTerminals(this.ecoleDe(user));
  }

  @Get('mon-ecole/departments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Liste les départements BioTime de sa propre école" })
  getMonDepartments(@CurrentUser() user: { organisationId?: string }) {
    return this.biotimeService.getDepartments(this.ecoleDe(user));
  }

  @Post('mon-ecole/departments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Crée un département sur le serveur BioTime de sa propre école" })
  createMonDepartment(
    @CurrentUser() user: { organisationId?: string },
    @Body() dto: CreateBiotimeDepartmentDto,
  ) {
    return this.biotimeService.createDepartment(this.ecoleDe(user), dto);
  }

  @Patch('mon-ecole/departments/:deptId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Met à jour un département sur le serveur BioTime de sa propre école" })
  updateMonDepartment(
    @CurrentUser() user: { organisationId?: string },
    @Param('deptId', ParseIntPipe) deptId: number,
    @Body() dto: UpdateBiotimeDepartmentDto,
  ) {
    return this.biotimeService.updateDepartment(this.ecoleDe(user), deptId, dto);
  }

  @Delete('mon-ecole/departments/:deptId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Supprime un département sur le serveur BioTime de sa propre école" })
  deleteMonDepartment(
    @CurrentUser() user: { organisationId?: string },
    @Param('deptId', ParseIntPipe) deptId: number,
  ) {
    return this.biotimeService.deleteDepartment(this.ecoleDe(user), deptId);
  }

  @Get('mon-ecole/areas')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Liste les zones BioTime de sa propre école" })
  getMonAreas(@CurrentUser() user: { organisationId?: string }) {
    return this.biotimeService.getAreas(this.ecoleDe(user));
  }

  @Post('mon-ecole/areas')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Crée une zone sur le serveur BioTime de sa propre école" })
  createMonArea(
    @CurrentUser() user: { organisationId?: string },
    @Body() dto: CreateBiotimeAreaDto,
  ) {
    return this.biotimeService.createArea(this.ecoleDe(user), dto);
  }

  @Patch('mon-ecole/areas/:areaId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Met à jour une zone sur le serveur BioTime de sa propre école" })
  updateMonArea(
    @CurrentUser() user: { organisationId?: string },
    @Param('areaId', ParseIntPipe) areaId: number,
    @Body() dto: UpdateBiotimeAreaDto,
  ) {
    return this.biotimeService.updateArea(this.ecoleDe(user), areaId, dto);
  }

  @Delete('mon-ecole/areas/:areaId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Supprime une zone sur le serveur BioTime de sa propre école" })
  deleteMonArea(
    @CurrentUser() user: { organisationId?: string },
    @Param('areaId', ParseIntPipe) areaId: number,
  ) {
    return this.biotimeService.deleteArea(this.ecoleDe(user), areaId);
  }

  @Get('mon-ecole/positions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Liste les postes BioTime de sa propre école" })
  getMonPositions(@CurrentUser() user: { organisationId?: string }) {
    return this.biotimeService.getPositions(this.ecoleDe(user));
  }

  @Post('mon-ecole/positions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Crée un poste sur le serveur BioTime de sa propre école" })
  createMonPosition(
    @CurrentUser() user: { organisationId?: string },
    @Body() dto: CreateBiotimePositionDto,
  ) {
    return this.biotimeService.createPosition(this.ecoleDe(user), dto);
  }

  @Patch('mon-ecole/positions/:posId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Met à jour un poste sur le serveur BioTime de sa propre école" })
  updateMonPosition(
    @CurrentUser() user: { organisationId?: string },
    @Param('posId', ParseIntPipe) posId: number,
    @Body() dto: UpdateBiotimePositionDto,
  ) {
    return this.biotimeService.updatePosition(this.ecoleDe(user), posId, dto);
  }

  @Delete('mon-ecole/positions/:posId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: "Supprime un poste sur le serveur BioTime de sa propre école" })
  deleteMonPosition(
    @CurrentUser() user: { organisationId?: string },
    @Param('posId', ParseIntPipe) posId: number,
  ) {
    return this.biotimeService.deletePosition(this.ecoleDe(user), posId);
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


  // ── Écriture vers BioTime : Employés (Phase 1) ──────────────────────────

  @Post(':organisationId/employees')
  @ApiOperation({ summary: "Crée un employé sur le serveur BioTime d'une école" })
  createEmployee(
    @Param('organisationId') organisationId: string,
    @Body() dto: CreateBiotimeEmployeeDto,
  ) {
    return this.biotimeService.createEmployee(organisationId, dto);
  }

  @Patch(':organisationId/employees/:biotimeId')
  @ApiOperation({ summary: "Met à jour un employé sur le serveur BioTime d'une école" })
  updateEmployee(
    @Param('organisationId') organisationId: string,
    @Param('biotimeId', ParseIntPipe) biotimeId: number,
    @Body() dto: UpdateBiotimeEmployeeDto,
  ) {
    return this.biotimeService.updateEmployee(organisationId, biotimeId, dto);
  }

  @Delete(':organisationId/employees/:biotimeId')
  @ApiOperation({ summary: "Supprime un employé sur le serveur BioTime d'une école" })
  deleteEmployee(
    @Param('organisationId') organisationId: string,
    @Param('biotimeId', ParseIntPipe) biotimeId: number,
  ) {
    return this.biotimeService.deleteEmployee(organisationId, biotimeId);
  }

  // ── Supervision badgeuses via API BioTime (Phase 1) ────────────────────

  @Get(':organisationId/biotime-terminals')
  @ApiOperation({ summary: "Liste les terminaux depuis le serveur BioTime d'une école" })
  getBiotimeTerminals(@Param('organisationId') organisationId: string) {
    return this.biotimeService.getBiotimeTerminals(organisationId);
  }

  // ── Départements (classes) sur BioTime (Phase 2) ───────────────────────

  @Get(':organisationId/departments')
  @ApiOperation({ summary: "Liste les départements BioTime d'une école" })
  getDepartments(@Param('organisationId') organisationId: string) {
    return this.biotimeService.getDepartments(organisationId);
  }

  @Post(':organisationId/departments')
  @ApiOperation({ summary: "Crée un département sur le serveur BioTime d'une école" })
  createDepartment(
    @Param('organisationId') organisationId: string,
    @Body() dto: CreateBiotimeDepartmentDto,
  ) {
    return this.biotimeService.createDepartment(organisationId, dto);
  }

  @Patch(':organisationId/departments/:deptId')
  @ApiOperation({ summary: "Met à jour un département sur le serveur BioTime d'une école" })
  updateDepartment(
    @Param('organisationId') organisationId: string,
    @Param('deptId', ParseIntPipe) deptId: number,
    @Body() dto: UpdateBiotimeDepartmentDto,
  ) {
    return this.biotimeService.updateDepartment(organisationId, deptId, dto);
  }

  @Delete(':organisationId/departments/:deptId')
  @ApiOperation({ summary: "Supprime un département sur le serveur BioTime d'une école" })
  deleteDepartment(
    @Param('organisationId') organisationId: string,
    @Param('deptId', ParseIntPipe) deptId: number,
  ) {
    return this.biotimeService.deleteDepartment(organisationId, deptId);
  }

  // ── Zones (areas) sur BioTime (Phase 2) ────────────────────────────────

  @Get(':organisationId/areas')
  @ApiOperation({ summary: "Liste les zones BioTime d'une école" })
  getAreas(@Param('organisationId') organisationId: string) {
    return this.biotimeService.getAreas(organisationId);
  }

  @Post(':organisationId/areas')
  @ApiOperation({ summary: "Crée une zone sur le serveur BioTime d'une école" })
  createArea(
    @Param('organisationId') organisationId: string,
    @Body() dto: CreateBiotimeAreaDto,
  ) {
    return this.biotimeService.createArea(organisationId, dto);
  }

  @Patch(':organisationId/areas/:areaId')
  @ApiOperation({ summary: "Met à jour une zone sur le serveur BioTime d'une école" })
  updateArea(
    @Param('organisationId') organisationId: string,
    @Param('areaId', ParseIntPipe) areaId: number,
    @Body() dto: UpdateBiotimeAreaDto,
  ) {
    return this.biotimeService.updateArea(organisationId, areaId, dto);
  }

  @Delete(':organisationId/areas/:areaId')
  @ApiOperation({ summary: "Supprime une zone sur le serveur BioTime d'une école" })
  deleteArea(
    @Param('organisationId') organisationId: string,
    @Param('areaId', ParseIntPipe) areaId: number,
  ) {
    return this.biotimeService.deleteArea(organisationId, areaId);
  }

  // ── Postes (positions) sur BioTime (Phase 3) ───────────────────────────

  @Get(':organisationId/positions')
  @ApiOperation({ summary: "Liste les postes BioTime d'une école" })
  getPositions(@Param('organisationId') organisationId: string) {
    return this.biotimeService.getPositions(organisationId);
  }

  @Post(':organisationId/positions')
  @ApiOperation({ summary: "Crée un poste sur le serveur BioTime d'une école" })
  createPosition(
    @Param('organisationId') organisationId: string,
    @Body() dto: CreateBiotimePositionDto,
  ) {
    return this.biotimeService.createPosition(organisationId, dto);
  }

  @Patch(':organisationId/positions/:posId')
  @ApiOperation({ summary: "Met à jour un poste sur le serveur BioTime d'une école" })
  updatePosition(
    @Param('organisationId') organisationId: string,
    @Param('posId', ParseIntPipe) posId: number,
    @Body() dto: UpdateBiotimePositionDto,
  ) {
    return this.biotimeService.updatePosition(organisationId, posId, dto);
  }

  @Delete(':organisationId/positions/:posId')
  @ApiOperation({ summary: "Supprime un poste sur le serveur BioTime d'une école" })
  deletePosition(
    @Param('organisationId') organisationId: string,
    @Param('posId', ParseIntPipe) posId: number,
  ) {
    return this.biotimeService.deletePosition(organisationId, posId);
  }

}
