import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@app/common';
import { User, UserRole } from '@app/database';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateDirectorDto } from './dto/create-director.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lister tous les utilisateurs (Super Admin)' })
  findAll() {
    return this.usersService.findAll();
  }

  // Avant les routes dynamiques (`:id/...`) : sinon "mon-equipe" serait lu comme un `:id`.
  @Get('mon-equipe')
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Lister les comptes directeur de ma propre école (Directeur)',
  })
  findMyTeam(@CurrentUser() appelant: User) {
    return this.usersService.findMyTeam(appelant);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un collègue Super Admin' })
  create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usersService.create(createUserDto, currentUserId);
  }

  // Accessible au Super Admin (n'importe quelle école) et à un directeur déjà
  // autorisé par le Super Admin (uniquement sa propre école) — voir
  // UsersService.createDirector pour la logique de distinction.
  @Post('directors')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary:
      "Inviter un directeur pour une école (Super Admin : n'importe laquelle ; Directeur autorisé : la sienne)",
  })
  createDirector(
    @Body() dto: CreateDirectorDto,
    @CurrentUser() appelant: User,
  ) {
    return this.usersService.createDirector(dto, appelant);
  }

  @Patch(':id/toggle-status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary:
      'Bloquer / Débloquer un utilisateur (Super Admin : tous ; Directeur autorisé : son équipe)',
  })
  toggleStatus(@Param('id') id: string, @CurrentUser() appelant: User) {
    return this.usersService.toggleStatus(id, appelant);
  }

  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Activer un compte directeur auto-inscrit (Super Admin)',
  })
  activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Supprimer un compte directeur, réservé au Super Admin (jamais délégué)',
  })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/reset-password')
  @ApiOperation({
    summary:
      "Déclencher la réinitialisation du mot de passe d'un compte (génère un nouveau lien d'activation)",
  })
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id);
  }
}
