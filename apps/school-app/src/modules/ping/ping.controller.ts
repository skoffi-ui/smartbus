import { Controller, Get, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@app/common';
import { TenantService } from '../tenant/tenant.service';

@ApiTags('tests')
@Controller('ping')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PingController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @ApiOperation({ summary: 'Teste la connexion à la base de données spécifique de l\'école' })
  async pingDb(@CurrentUser() user: any) {
    try {
      // Magie Multi-Tenant : On récupère la connexion spécifique à CET utilisateur
      const dataSource = await this.tenantService.getDataSource();

      // On lance une petite requête SQL pour vérifier que ça marche
      const result = await dataSource.query('SELECT current_database();');

      return {
        message: 'Succès ! Vous êtes bien isolé dans votre coffre-fort.',
        schoolId: user.organisationId,
        userEmail: user.email,
        activeDatabase: result[0].current_database,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(`Erreur de connexion à la base école: ${error.message}`);
    }
  }
}
