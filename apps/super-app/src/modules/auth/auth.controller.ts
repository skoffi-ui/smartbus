import {
  Controller,
  Post,
  Patch,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { CandidatureDirecteurDto } from './dto/candidature-directeur.dto';
import { CreateMySchoolDto } from './dto/create-my-school.dto';
import { InscriptionDirecteurDto } from './dto/inscription-directeur.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public, CurrentUser, RolesGuard, Roles, UserRole } from '@app/common';
import { JwtAuthGuard } from '@app/common';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { User } from '@app/database';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: "Inscription d'un nouvel utilisateur" })
  @ApiResponse({ status: 201, description: 'Utilisateur créé avec succès' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // Public : c'est justement le but, aucun compte n'existe encore à ce stade.
  // Ne renvoie ni jeton ni mot de passe — le compte est créé `PENDING`, il ne
  // peut pas se connecter avant que le Super Admin l'active (voir
  // UsersService.activate et AuthService.validateUser).
  @Public()
  @Post('candidature-directeur')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Auto-inscription ouverte d'un directeur, en attente d'activation",
  })
  @ApiResponse({
    status: 201,
    description: "Inscription enregistrée, en attente d'activation",
  })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async candidatureDirecteur(@Body() dto: CandidatureDirecteurDto) {
    await this.authService.candidatureDirecteur(dto);
    return {
      message:
        'Inscription envoyée. Un administrateur doit activer votre compte avant que vous puissiez vous connecter.',
    };
  }

  // Réservé à un directeur déjà activé (voir UsersService.activate) mais sans
  // école : il crée lui-même son établissement, une seule fois (contrôlé
  // dans AuthService.creerMonEcole).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @Post('creer-mon-ecole')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Un directeur activé crée lui-même son école (organisation + provisionnement)',
  })
  @ApiResponse({
    status: 201,
    description: 'École créée et provisionnée avec succès',
  })
  @ApiResponse({ status: 409, description: 'Ce directeur a déjà une école' })
  async creerMonEcole(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMySchoolDto,
  ) {
    return this.authService.creerMonEcole(userId, dto);
  }

  // Public : c'est justement le but, un collaborateur n'a encore aucun compte
  // à ce stade. Protégé quand même par le jeton d'invitation (voir
  // DirectorInvitationService), qui porte l'école concernée et n'est délivré
  // que par un directeur déjà autorisé (voir UsersService.createDirector) —
  // impossible de s'inscrire sans en avoir reçu un.
  @Public()
  @Post('rejoindre-ecole')
  @ApiOperation({
    summary:
      "Un collaborateur termine son inscription à partir d'un lien d'invitation",
  })
  @ApiResponse({
    status: 201,
    description: 'Compte créé, connexion automatique',
  })
  @ApiResponse({
    status: 400,
    description: "Lien d'invitation invalide ou expiré",
  })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async rejoindreEcole(@Body() dto: InscriptionDirecteurDto) {
    return this.authService.rejoindreEcole(dto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion utilisateur' })
  @ApiResponse({ status: 200, description: 'Connexion réussie' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  async login(@Req() req: { user: User }) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnexion' })
  async logout(@CurrentUser('sub') userId: string) {
    await this.authService.logout(userId);
    return { message: 'Déconnexion réussie' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rafraîchissement des tokens' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.userId, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  async getMe(@CurrentUser() user: User) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour les informations personnelles' })
  @ApiResponse({
    status: 409,
    description: 'Email déjà utilisé par un autre compte',
  })
  async updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Changer son mot de passe' })
  @ApiResponse({ status: 401, description: 'Mot de passe actuel incorrect' })
  async changeMyPassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, dto);
    return { message: 'Mot de passe modifié avec succès.' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Demande de réinitialisation de mot de passe' })
  async forgotPassword(@Body('email') email: string) {
    await this.authService.forgotPassword(email);
    return {
      message: 'Si cet email existe, un lien de réinitialisation a été envoyé.',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réinitialisation du mot de passe avec le jeton' })
  async resetPassword(@Body() body: any) {
    await this.authService.resetPassword(body.token, body.newPassword);
    return { message: 'Mot de passe réinitialisé avec succès.' };
  }
}
