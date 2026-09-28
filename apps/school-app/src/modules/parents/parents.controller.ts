import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ParentsService } from './parents.service';
import { CreateParentDto, UpdateParentDto } from './dto/parents.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, FeaturesGuard, RequireFeature } from '@app/common';
import { UserRole } from '@app/database';

@ApiTags('Parents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, FeaturesGuard)
@Roles(UserRole.SCHOOL_ADMIN)
@RequireFeature('parents')
@Controller('parents')
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un parent' })
  create(@Body() createParentDto: CreateParentDto) {
    return this.parentsService.create(createParentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les parents' })
  // Aussi utilisé par Children.tsx (associer un élève à son/ses parent(s)).
  @RequireFeature('parents', 'children')
  findAll() {
    return this.parentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un parent par ID' })
  findOne(@Param('id') id: string) {
    return this.parentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un parent' })
  update(@Param('id') id: string, @Body() updateParentDto: UpdateParentDto) {
    return this.parentsService.update(id, updateParentDto);
  }

  @Post(':id/regenerate-pin')
  @ApiOperation({ summary: "Régénère le code PIN d'accès à l'app parent" })
  regeneratePin(@Param('id') id: string) {
    return this.parentsService.regeneratePin(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un parent' })
  remove(@Param('id') id: string) {
    return this.parentsService.remove(id);
  }
}
