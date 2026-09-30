import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MetaDataService } from './metadata.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { UserRole } from '@app/common';

@ApiTags('metadata')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('metadata')
export class MetaDataController {
  constructor(private readonly service: MetaDataService) {}

  @Get('version')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Obtenir la version actuelle de la base de données',
  })
  getCurrentVersion() {
    return this.service.getCurrentVersion();
  }
}
