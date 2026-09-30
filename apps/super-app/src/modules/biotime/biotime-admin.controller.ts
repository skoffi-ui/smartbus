import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BiotimeCentralService } from './biotime-central.service';
import {
  AssignTerminalDto,
  CreateDepartmentDto,
  SyncTerminalsResponseDto,
} from './dto';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { UserRole } from '@app/database';

/**
 * Contrôleur Super Admin pour la gestion centralisée du serveur BioTime
 *
 * Permet de :
 * - Gérer les départements BioTime (1 département = 1 école)
 * - Gérer les terminaux (badgeuses) et leur affectation aux écoles
 * - Synchroniser les données avec le serveur BioTime central
 */
@ApiTags('BioTime Admin')
@ApiBearerAuth()
@Controller('admin/biotime')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class BiotimeAdminController {
  constructor(private readonly biotimeService: BiotimeCentralService) {}

  // ==================== DÉPARTEMENTS ====================

  @Post('departments/create')
  @ApiOperation({
    summary: 'Créer un département BioTime pour une organisation',
    description:
      "Crée un département sur le serveur BioTime central et l'associe à l'organisation. 1 organisation = 1 département BioTime.",
  })
  @ApiResponse({ status: 201, description: 'Département créé avec succès' })
  @ApiResponse({
    status: 400,
    description: "L'organisation a déjà un département ou erreur BioTime",
  })
  @ApiResponse({ status: 404, description: 'Organisation non trouvée' })
  async createDepartment(@Body() dto: CreateDepartmentDto) {
    const org = await this.biotimeService.createDepartmentForOrganisation(
      dto.organisationId,
    );
    return {
      message: 'Department created successfully',
      organisation: {
        id: org.id,
        name: org.name,
        biotimeDepartmentId: org.biotimeDepartmentId,
        biotimeDepartmentName: org.biotimeDepartmentName,
      },
    };
  }

  @Get('departments')
  @ApiOperation({
    summary: 'Lister tous les départements du serveur BioTime',
    description:
      'Récupère la liste complète des départements disponibles sur le serveur BioTime central.',
  })
  @ApiResponse({ status: 200, description: 'Liste des départements récupérée' })
  async getAllDepartments() {
    return await this.biotimeService.getAllDepartmentsFromBiotime();
  }

  // ==================== TERMINAUX ====================

  @Get('terminals')
  @ApiOperation({
    summary: 'Lister tous les terminaux connus localement',
    description:
      'Retourne tous les terminaux enregistrés dans notre base (assignés ou non), avec leur école le cas échéant. Ne dépend pas du serveur BioTime central.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste complète des terminaux locaux',
  })
  async getAllTerminals() {
    return await this.biotimeService.getAllTerminals();
  }

  @Get('terminals/available')
  @ApiOperation({
    summary: 'Lister les terminaux disponibles (non assignés)',
    description:
      'Retourne tous les terminaux qui ne sont pas encore assignés à une organisation et qui sont disponibles pour affectation.',
  })
  @ApiResponse({ status: 200, description: 'Liste des terminaux disponibles' })
  async getAvailableTerminals() {
    return await this.biotimeService.getAvailableTerminals();
  }

  @Get('terminals/all-from-server')
  @ApiOperation({
    summary: 'Récupérer tous les terminaux du serveur BioTime central',
    description:
      'Interroge directement le serveur BioTime pour obtenir la liste complète des terminaux enregistrés.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des terminaux du serveur BioTime',
  })
  async fetchAllTerminalsFromServer() {
    return await this.biotimeService.fetchAllTerminalsFromBiotime();
  }

  @Post('terminals/sync')
  @ApiOperation({
    summary: 'Synchroniser les terminaux depuis le serveur BioTime',
    description:
      'Récupère tous les terminaux du serveur BioTime et met à jour la base de données locale. Crée les nouveaux terminaux et met à jour les existants.',
  })
  @ApiResponse({
    status: 200,
    description: 'Terminaux synchronisés avec succès',
    type: SyncTerminalsResponseDto,
  })
  async syncTerminals(): Promise<SyncTerminalsResponseDto> {
    return await this.biotimeService.syncTerminalsFromBiotime();
  }

  @Post('terminals/assign')
  @ApiOperation({
    summary: 'Assigner un terminal à une organisation',
    description:
      'Affecte un terminal (badgeuse) à une organisation (école) spécifique. Le terminal devient exclusif à cette école.',
  })
  @ApiResponse({ status: 200, description: 'Terminal assigné avec succès' })
  @ApiResponse({
    status: 404,
    description: 'Terminal ou organisation non trouvé(e)',
  })
  async assignTerminal(@Body() dto: AssignTerminalDto) {
    const terminal = await this.biotimeService.assignTerminalToOrganisation(
      dto.serialNumber,
      dto.organisationId,
      dto.terminalName,
    );

    return {
      message: 'Terminal assigned successfully',
      terminal: {
        id: terminal.id,
        serialNumber: terminal.serialNumber,
        terminalName: terminal.terminalName,
        status: terminal.status,
        organisationId: terminal.organisationId,
      },
    };
  }

  @Delete('terminals/:id/unassign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Désassigner un terminal',
    description:
      'Libère un terminal pour le rendre disponible pour affectation à une autre organisation.',
  })
  @ApiParam({ name: 'id', description: 'ID du terminal à désassigner' })
  @ApiResponse({ status: 200, description: 'Terminal désassigné avec succès' })
  @ApiResponse({ status: 404, description: 'Terminal non trouvé' })
  async unassignTerminal(@Param('id') id: string) {
    await this.biotimeService.unassignTerminal(id);
    return { message: 'Terminal unassigned successfully' };
  }

  @Get('organisations/:orgId/terminals')
  @ApiOperation({
    summary: "Lister les terminaux d'une organisation",
    description:
      'Retourne tous les terminaux assignés à une organisation (école) spécifique.',
  })
  @ApiParam({ name: 'orgId', description: "ID de l'organisation" })
  @ApiResponse({
    status: 200,
    description: "Liste des terminaux de l'organisation",
  })
  async getOrganisationTerminals(@Param('orgId') orgId: string) {
    return await this.biotimeService.getOrganisationTerminals(orgId);
  }

  @Get('terminals/:serialNumber')
  @ApiOperation({
    summary: 'Récupérer un terminal par son numéro de série',
    description:
      "Retourne les détails d'un terminal spécifique, y compris son organisation assignée.",
  })
  @ApiParam({
    name: 'serialNumber',
    description: 'Numéro de série du terminal',
  })
  @ApiResponse({ status: 200, description: 'Détails du terminal' })
  @ApiResponse({ status: 404, description: 'Terminal non trouvé' })
  async getTerminalBySerialNumber(@Param('serialNumber') serialNumber: string) {
    return await this.biotimeService.getTerminalBySerialNumber(serialNumber);
  }

  // ==================== TRANSACTIONS (POINTAGES) ====================

  @Get('organisations/:orgId/transactions/recent')
  @ApiOperation({
    summary: "Récupérer les transactions récentes d'une organisation",
    description:
      "Retourne les 100 dernières transactions (pointages) d'une organisation, filtrées automatiquement par son département BioTime.",
  })
  @ApiParam({ name: 'orgId', description: "ID de l'organisation" })
  @ApiResponse({ status: 200, description: 'Liste des transactions récentes' })
  @ApiResponse({
    status: 404,
    description: 'Organisation non trouvée ou sans département BioTime',
  })
  async getRecentTransactions(@Param('orgId') orgId: string) {
    return await this.biotimeService.getRecentOrganisationTransactions(
      orgId,
      100,
    );
  }
}
