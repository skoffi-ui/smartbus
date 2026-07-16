import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { UserRole as UR } from '@app/common';
import { UserRole } from '@app/database';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @Roles(UR.SUPER_ADMIN)
  @ApiOperation({ summary: 'Lister tous les rôles disponibles' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':role')
  @Roles(UR.SUPER_ADMIN)
  @ApiOperation({ summary: 'Détails d\'un rôle' })
  @ApiParam({ name: 'role', enum: UserRole, description: 'Le nom du rôle (ex: school_admin)' })
  findOne(@Param('role') role: UserRole) {
    const roleDesc = this.service.findOne(role);
    if (!roleDesc) {
      throw new NotFoundException(`Rôle '${role}' introuvable`);
    }
    return roleDesc;
  }
}
