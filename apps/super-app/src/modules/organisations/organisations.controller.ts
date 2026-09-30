import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrganisationsService } from './organisations.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { UpdateMySchoolDto } from './dto/update-my-school.dto';
import { SearchOrganisationsDto } from './dto/search-organisations.dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@app/common';
import { UserRole } from '@app/common';
import { User } from '@app/database';

@ApiTags('organisations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organisations')
export class OrganisationsController {
  constructor(private readonly service: OrganisationsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Créer une organisation' })
  create(@Body() dto: CreateOrganisationDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Lister toutes les organisations' })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query() query: SearchOrganisationsDto) {
    return this.service.findAll(query, query.search);
  }

  // Déclarées avant les routes `:id` : sinon Nest/Express matcherait
  // "mon-ecole" comme si c'était un `:id` (premier enregistré = prioritaire).
  @Get('mon-ecole')
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Récupérer les informations de ma propre école (directeur)',
  })
  findMine(@CurrentUser() user: User) {
    return this.service.findMine(user.organisationId);
  }

  @Patch('mon-ecole')
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Modifier les informations de ma propre école (directeur)',
  })
  updateMine(@CurrentUser() user: User, @Body() dto: UpdateMySchoolDto) {
    return this.service.updateMine(user.organisationId, dto);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Récupérer une organisation par son ID' })
  // Réservé au Super Admin : un directeur qui connaîtrait/deviendrait l'ID
  // d'une autre école pourrait sinon lire tout son enregistrement (dbName,
  // biotimeDepartmentId, etc. — aucun contrôle de propriété ici). Un
  // directeur consulte désormais SA PROPRE école via `GET /organisations/mon-ecole`
  // ci-dessus, qui ne se fie jamais à un ID fourni par le client.
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mettre à jour une organisation' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganisationDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspendre une organisation' })
  suspend(@Param('id') id: string) {
    return this.service.suspend(id);
  }

  @Patch(':id/activate')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activer une organisation' })
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une organisation' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
