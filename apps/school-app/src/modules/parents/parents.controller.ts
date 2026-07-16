import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ParentsService } from './parents.service';
import { CreateParentDto, UpdateParentDto } from './dto/parents.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { UserRole } from '@app/database';

@ApiTags('Parents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SCHOOL_ADMIN)
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

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un parent' })
  remove(@Param('id') id: string) {
    return this.parentsService.remove(id);
  }
}
