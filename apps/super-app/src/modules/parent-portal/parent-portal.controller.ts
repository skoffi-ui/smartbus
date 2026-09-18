import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ParentPortalService } from './parent-portal.service';
import { ParentLoginDto } from './dto/parent-login.dto';
import { ParentJwtAuthGuard } from './guards/parent-jwt-auth.guard';
import { Public } from '@app/common';

@ApiTags('Parent Portal')
@Controller()
export class ParentPortalController {
  constructor(private readonly parentPortalService: ParentPortalService) {}

  @Public()
  @Post('auth/parent/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion de l\'application mobile des parents' })
  @ApiResponse({ status: 200, description: 'Connexion réussie.' })
  @ApiResponse({ status: 401, description: 'Identifiants ou PIN incorrects.' })
  async login(@Body() dto: ParentLoginDto) {
    return this.parentPortalService.login(dto);
  }

  @UseGuards(ParentJwtAuthGuard)
  @ApiBearerAuth()
  @Get('parent/enfants')
  @ApiOperation({ summary: 'Récupère la liste des enfants associés au parent connecté' })
  @ApiResponse({ status: 200, description: 'Liste des enfants récupérée.' })
  @ApiResponse({ status: 401, description: 'Token invalide ou expiré.' })
  async getChildren(@Req() req: any) {
    const parentId = req.user.id;
    const organisationId = req.user.organisationId;
    return this.parentPortalService.getChildren(parentId, organisationId);
  }

  @UseGuards(ParentJwtAuthGuard)
  @ApiBearerAuth()
  @Post('parent/fcm-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enregistre le token push FCM du parent connecté' })
  @ApiResponse({ status: 200, description: 'Token FCM enregistré.' })
  @ApiResponse({ status: 401, description: 'Token invalide ou expiré.' })
  async saveFcmToken(@Req() req: any, @Body('token') token: string) {
    const parentId = req.user.id;
    const organisationId = req.user.organisationId;
    return this.parentPortalService.saveFcmToken(parentId, organisationId, token);
  }
}
