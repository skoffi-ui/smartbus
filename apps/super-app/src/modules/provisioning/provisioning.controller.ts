import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProvisioningService } from './provisioning.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { UserRole } from '@app/common';

@ApiTags('provisioning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('provisioning')
export class ProvisioningController {
  constructor(private readonly service: ProvisioningService) {}

  @Post(':organisationId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Provisionner la base de données d\'une école' })
  provision(@Param('organisationId') organisationId: string) {
    return this.service.provisionOrganisation(organisationId);
  }
}
