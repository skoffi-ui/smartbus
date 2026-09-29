import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
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
import { CandidatureDirecteurDto } from './dto/candidature-directeur.dto';
import { CreateMySchoolDto } from './dto/create-my-school.dto';
import { InscriptionDirecteurDto } from './dto/inscription-directeur.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { OrganisationsService } from '../organisations/organisations.service';
import { ProvisioningService } from '../provisioning/provisioning.service';
import { jwtSecretRequis, jwtRefreshSecretRequis, DirectorInvitationService } from '@app/common';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organisationId?: string | null;
  /** Permissions par école — voir `Organisation.allowedFeatures`. Absent/null = pas de restriction. */
  allowedFeatures?: string[] | null;
  /** Cette école peut-elle créer des comptes directeur supplémentaires ? Affichage seulement (voir DirectorInvitationService/UsersService pour la vérification réelle, toujours relue en base). */
  allowAdditionalDirectors?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Claim `type` présent uniquement sur les refresh tokens. */
export const REFRESH_TOKEN_TYPE = 'refresh' as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RefreshTokenPayload extends JwtPayload {
  type: typeof REFRESH_TOKEN_TYPE;
  exp?: number;
}

/** Empreinte du jeton entier. SHA-256 ne tronque pas, contrairement à bcrypt (72 octets). */
function empreinteRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function empreintesEgales(stockee: string, calculee: string): boolean {
  const a = Buffer.from(stockee);
  const b = Buffer.from(calculee);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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
    private readonly directorInvitationService: DirectorInvitationService,
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

    // Auto-inscription (voir `candidatureDirecteur`) en attente de validation
    // par le Super Admin — voir UsersService.activate. Aucune session tant
    // que ce n'est pas fait, pas un simple écran d'attente sans accès.
    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException("Votre compte est en attente d'activation par l'administrateur.");
    }

    return user;
  }

  /**
   * Auto-inscription ouverte d'un directeur, depuis school-web — sans
   * invitation, sans école. Compte créé `PENDING`, sans `organisationId` :
   * ne peut pas encore se connecter (voir `validateUser`). Apparaît dans
   * "Directeurs d'écoles" avec sa date d'inscription (`createdAt`) ; le
   * Super Admin doit l'activer (voir `UsersService.activate`) avant qu'il
   * puisse se connecter et créer lui-même son école (voir `creerMonEcole`).
   */
  async candidatureDirecteur(dto: CandidatureDirecteurDto): Promise<void> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Un compte avec cet email existe déjà');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: hashedPassword,
      role: UserRole.SCHOOL_ADMIN,
      status: UserStatus.PENDING,
      organisationId: null,
    });
    await this.userRepository.save(user);
  }

  /**
   * Un directeur déjà activé (mais sans école) crée lui-même son
   * établissement — Organisation + base de données dédiée + abonnement
   * d'essai, comme le faisait l'ancien `registerSchool`, mais déclenché par
   * le directeur pour son propre compte plutôt que par le Super Admin pour
   * un tiers. Un directeur ne peut créer qu'une seule école.
   */
  async creerMonEcole(userId: string, dto: CreateMySchoolDto): Promise<{ organisation: any; tokens: AuthTokens }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (user.organisationId) {
      throw new ConflictException('Vous avez déjà une école.');
    }

    // 1. Créer l'école (Organisation)
    const organisation = await this.organisationsService.create({
      name: dto.schoolName,
      address: dto.address,
      phone: dto.phone,
    } as any);

    // 2. Déclencher le provisionnement de la base de données.
    // En cas d'échec on annule la création : sinon l'école existerait sans base.
    const provisioning = await this.provisioningService.provisionOrganisation(organisation.id);
    if (provisioning.status === 'error') {
      await this.organisationsService.remove(organisation.id);
      // La base a pu être créée avant l'échec (l'organisation n'est alors pas marquée provisionnée)
      await this.provisioningService.dropOrganisationDatabase(provisioning.dbName);
      throw new InternalServerErrorException(
        "La création de la base de données de l'école a échoué. Aucune école n'a été créée, veuillez réessayer.",
      );
    }

    // 3. Créer un abonnement d'essai gratuit de 7 jours
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

    // 4. Rattacher l'école au directeur, et réémettre des jetons frais :
    // ceux qu'il avait n'ont pas d'organisationId.
    user.organisationId = organisation.id;
    const savedUser = await this.userRepository.save(user);
    const tokens = await this.generateTokens(savedUser);
    await this.saveRefreshToken(savedUser.id, tokens.refreshToken);

    return { organisation, tokens };
  }

  /**
   * Un collaborateur termine son inscription à partir d'un lien d'invitation
   * généré par un directeur déjà autorisé (voir `DirectorInvitationService`
   * et `UsersService.createDirector` — seule source de ce jeton désormais).
   * Prénom, nom, email et mot de passe sont tous choisis ici par le
   * collaborateur lui-même — c'est à cet instant précis que son compte
   * existe et qu'il apparaît dans "Directeurs d'écoles", pas avant. Comme il
   * vient de choisir son propre mot de passe, la connexion automatique est
   * légitime ici.
   */
  async rejoindreEcole(dto: InscriptionDirecteurDto): Promise<{ user: Partial<User>; tokens: AuthTokens }> {
    const organisationId = await this.directorInvitationService.verifier(dto.token);
    await this.organisationsService.findOne(organisationId); // 404 si l'école n'existe plus

    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Un compte avec cet email existe déjà');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: hashedPassword,
      role: UserRole.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
      organisationId,
    });
    const savedUser = await this.userRepository.save(user);

    const tokens = await this.generateTokens(savedUser);
    await this.saveRefreshToken(savedUser.id, tokens.refreshToken);

    const { password: _pw, ...userWithoutPassword } = savedUser as User & { password: string };
    return { user: userWithoutPassword, tokens };
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
   * Renouvelle la session à partir du seul refresh token.
   *
   * L'identifiant est le claim `sub` du jeton vérifié : le corps de la
   * requête ne le fournit pas. Signature, expiration et type sont contrôlés
   * avant toute lecture en base. L'empreinte stockée est le SHA-256 du jeton
   * entier. Chaque succès la remplace, y compris si deux requêtes arrivent
   * ensemble : une seule mise à jour trouve encore l'empreinte présentée.
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const payload = await this.verifierRefreshToken(refreshToken);

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, organisationId: true, refreshToken: true },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Accès refusé');
    }

    const empreinte = empreinteRefreshToken(refreshToken);
    if (!empreintesEgales(user.refreshToken, empreinte)) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    const tokens = await this.generateTokens(user);
    const remplacement = await this.userRepository.update(
      { id: user.id, refreshToken: empreinte },
      { refreshToken: empreinteRefreshToken(tokens.refreshToken) },
    );
    if (!remplacement.affected) {
      throw new UnauthorizedException('Refresh token invalide');
    }
    return tokens;
  }

  /**
   * Signature HMAC, expiration et type `refresh`.
   * Toute erreur de jeton (forgery, autre clé, expiration) devient un 401
   * sans le détail renvoyé par la bibliothèque.
   */
  private async verifierRefreshToken(refreshToken: string): Promise<RefreshTokenPayload> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: jwtRefreshSecretRequis(this.configService),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }

    if (
      payload?.type !== REFRESH_TOKEN_TYPE ||
      typeof payload.sub !== 'string' ||
      !UUID.test(payload.sub) ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    return payload;
  }

  /**
   * Génère les tokens d'accès et de rafraîchissement.
   *
   * Recharge `allowedFeatures` depuis l'organisation à chaque émission
   * (login, refresh) plutôt que de le figer une fois pour toutes : un
   * changement de permissions par le Super Admin s'applique donc au
   * prochain jeton émis, pas seulement à la prochaine reconnexion complète.
   */
  private async generateTokens(user: User): Promise<AuthTokens> {
    let allowedFeatures: string[] | null | undefined;
    let allowAdditionalDirectors = false;
    if (user.role === UserRole.SCHOOL_ADMIN && user.organisationId) {
      try {
        const organisation = await this.organisationsService.findOne(user.organisationId);
        allowedFeatures = organisation.allowedFeatures;
        allowAdditionalDirectors = organisation.allowAdditionalDirectors;
      } catch {
        // École introuvable/supprimée : on n'empêche pas l'émission du jeton
        // pour autant, ce n'est pas le rôle de generateTokens de trancher ça.
        allowedFeatures = undefined;
      }
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organisationId: user.organisationId,
      allowedFeatures,
      allowAdditionalDirectors,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecretRequis(this.configService),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d') as any,
      }),
      this.jwtService.signAsync(
        {
          ...payload,
          type: REFRESH_TOKEN_TYPE,
          // Sans identifiant unique, deux émissions dans la même seconde produisent
          // le même JWT : la rotation ne révoquerait pas le jeton présenté.
          jti: crypto.randomBytes(16).toString('hex'),
        },
        {
          secret: jwtRefreshSecretRequis(this.configService),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d') as any,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Enregistre l'empreinte SHA-256 du refresh token (login, inscription).
   * Le renouvellement passe par une mise à jour conditionnelle, voir `refreshTokens`.
   */
  private async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.userRepository.update(userId, {
      refreshToken: empreinteRefreshToken(refreshToken),
    });
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
   * Pose un nouveau mot de passe à partir d'un jeton valide.
   *
   * Sert à la fois à un "mot de passe oublié" classique ET à la toute
   * première activation d'un compte directeur (voir `registerSchool`,
   * `UsersService.createDirector`, `UsersService.resetPassword`) : dans les
   * trois cas, c'est le même jeton — voir `genererJetonActivation`. Si le
   * compte était `PENDING` (jamais encore activé), il passe `ACTIVE` ici.
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
    if (user.status === UserStatus.PENDING) {
      user.status = UserStatus.ACTIVE;
    }
    await this.userRepository.save(user);
  }

  /**
   * Met à jour les informations personnelles de l'utilisateur connecté
   * (prénom, nom, email). Rôle et statut ne sont volontairement pas
   * modifiables ici, voir `UpdateMeDto`.
   */
  async updateMe(userId: string, dto: UpdateMeDto): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('Un compte avec cet email existe déjà');
      }
    }

    Object.assign(user, dto);
    const saved = await this.userRepository.save(user);

    const { password: _pw, refreshToken: _rt, ...userWithoutSensitive } = saved as User & {
      password: string;
      refreshToken: string;
    };
    return userWithoutSensitive;
  }

  /**
   * Change le mot de passe de l'utilisateur connecté, après vérification de
   * l'ancien. Contrairement à `resetPassword` (jeton par email), celui-ci
   * exige de connaître le mot de passe actuel.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    user.password = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.save(user);
  }
}
