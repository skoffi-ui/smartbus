import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserStatus, UserRole, Subscription, SubscriptionPlan, SubscriptionStatus } from '@app/database';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { OrganisationsService } from '../organisations/organisations.service';
import { ProvisioningService } from '../provisioning/provisioning.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organisationId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly organisationsService: OrganisationsService,
    private readonly provisioningService: ProvisioningService,
  ) {}

  /**
   * Valide les credentials (email + mot de passe)
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: { id: true, email: true, password: true, role: true, status: true, firstName: true, lastName: true, organisationId: true },
    });

    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Compte suspendu. Contactez l\'administrateur.');
    }

    return user;
  }

  /**
   * Inscription Self-Service d'une école (Organisation + Admin + Base de données)
   */
  async registerSchool(dto: RegisterSchoolDto) {
    // 1. Vérifier si l'email de l'admin existe déjà
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.adminEmail },
    });
    if (existingUser) {
      throw new ConflictException('Un compte avec cet email existe déjà');
    }

    // 2. Créer l'école (Organisation)
    const organisation = await this.organisationsService.create({
      name: dto.schoolName,
      address: dto.address,
      phone: dto.phone,
      email: dto.adminEmail,
    } as any);

    // 3. Créer le compte utilisateur Directeur
    const hashedPassword = await bcrypt.hash(dto.adminPassword, 12);
    const user = this.userRepository.create({
      firstName: dto.adminFirstName,
      lastName: dto.adminLastName,
      email: dto.adminEmail,
      password: hashedPassword,
      role: UserRole.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
      organisationId: organisation.id,
    });
    const savedUser = await this.userRepository.save(user);

    // 4. Déclencher le provisionnement de la base de données
    await this.provisioningService.provisionOrganisation(organisation.id);

    // 4.5 Créer un abonnement d'essai gratuit de 7 jours
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 jours
    const subscription = this.subscriptionRepository.create({
      organisationId: organisation.id,
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.TRIAL,
      startDate: now,
      endDate: endDate,
      pricePerMonth: 0,
      maxCars: 1,
    });
    await this.subscriptionRepository.save(subscription);

    // 5. Connecter l'utilisateur automatiquement (optionnel) et renvoyer
    const tokens = await this.generateTokens(savedUser);
    await this.saveRefreshToken(savedUser.id, tokens.refreshToken);

    const { password: _pw, ...userWithoutPassword } = savedUser as User & { password: string };
    
    return {
      message: 'École créée et provisionnée avec succès !',
      organisation,
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(registerDto: RegisterDto): Promise<{ user: Partial<User>; tokens: AuthTokens }> {
    const existing = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existing) {
      throw new ConflictException('Un compte avec cet email existe déjà');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const user = this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);
    const tokens = await this.generateTokens(savedUser);
    await this.saveRefreshToken(savedUser.id, tokens.refreshToken);

    const { password: _pw, ...userWithoutPassword } = savedUser as User & { password: string };
    return { user: userWithoutPassword, tokens };
  }

  /**
   * Connexion
   */
  async login(user: User): Promise<{ user: Partial<User>; tokens: AuthTokens }> {
    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    // Mettre à jour la date de dernière connexion
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    const { password: _pw, refreshToken: _rt, ...userWithoutSensitive } = user as User & { password: string; refreshToken: string };
    return { user: userWithoutSensitive, tokens };
  }

  /**
   * Déconnexion – suppression du refresh token
   */
  async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: null as unknown as string });
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(userId: string, refreshToken: string): Promise<AuthTokens> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, email: true, role: true, organisationId: true, refreshToken: true },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Accès refusé');
    }

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  /**
   * Génère les tokens d'accès et de rafraîchissement
   */
  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organisationId: user.organisationId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET', 'secret'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'secret'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Sauvegarde le hash du refresh token
   */
  private async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, { refreshToken: hashedRefreshToken });
  }

  /**
   * Mot de passe oublié (Génération du jeton et simulation d'email)
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) return; // Sécurité : On ne révèle pas si l'email existe ou non

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // Valable 1 heure

    await this.userRepository.save(user);

    // Simulation de l'envoi d'email
    Logger.log(`[SIMULATION EMAIL] Réinitialisation demandée pour ${email}`, 'AuthService');
    Logger.log(`[SIMULATION EMAIL] Cliquez ici : http://localhost:5173/reset-password?token=${resetToken}`, 'AuthService');
  }

  /**
   * Réinitialisation du mot de passe
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userRepository.findOne({
      where: { resetPasswordToken: resetTokenHash },
    });

    if (!user || user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Le jeton de réinitialisation est invalide ou a expiré');
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = null as any;
    user.resetPasswordExpires = null as any;
    await this.userRepository.save(user);
  }
}
