import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User, UserStatus, UserRole } from '@app/database';
import { genererJetonActivation, DirectorInvitationService } from '@app/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateDirectorDto } from './dto/create-director.dto';
import { OrganisationsService } from '../organisations/organisations.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly organisationsService: OrganisationsService,
    private readonly configService: ConfigService,
    private readonly directorInvitationService: DirectorInvitationService,
  ) {}

  /** Construit le lien qu'un directeur utilise pour poser un mot de passe (réinitialisation). */
  private lienActivation(rawToken: string): string {
    const webUrl = this.configService.get<string>('SCHOOL_WEB_URL', 'http://localhost:5174');
    return `${webUrl}/definir-mot-de-passe?token=${rawToken}`;
  }

  async findAll() {
    return this.userRepository.find({
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, status: true,
        lastLoginAt: true, createdAt: true, activatedAt: true, organisationId: true,
        organisation: { id: true, name: true, code: true },
      },
      relations: { organisation: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  /**
   * Liste les comptes directeur de l'école de l'appelant (lui-même inclus) —
   * pour la page "Mon Équipe" côté school-web. Un directeur ne voit jamais
   * les autres écoles.
   */
  async findMyTeam(appelant: User) {
    if (!appelant.organisationId) return [];
    return this.userRepository.find({
      where: { organisationId: appelant.organisationId, role: UserRole.SCHOOL_ADMIN },
      select: {
        id: true, email: true, firstName: true, lastName: true, status: true,
        lastLoginAt: true, createdAt: true, activatedAt: true,
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Crée un collègue Super Admin. Ne crée jamais un directeur d'école : voir
   * le commentaire sur CreateUserDto.
   */
  async create(data: CreateUserDto, createdBy: string) {
    const existing = await this.userRepository.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = this.userRepository.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      createdBy,
    });
    return this.userRepository.save(user);
  }

  /**
   * Invite un directeur pour une école déjà provisionnée. Accessible à deux
   * profils, avec des règles différentes :
   * - Super Admin : n'importe quelle école (garde de classe sur le contrôleur).
   * - Directeur (School Admin) : uniquement SA PROPRE école, et seulement si
   *   le Super Admin l'y a autorisé (`Organisation.allowAdditionalDirectors`).
   *
   * Dans les deux cas, aucun `User` n'est créé ici : le futur directeur
   * choisit lui-même son prénom, nom, email et mot de passe en s'inscrivant
   * via le lien renvoyé (voir `AuthService.rejoindreEcole`), et n'apparaît
   * dans la liste des directeurs qu'à ce moment-là.
   */
  async createDirector(dto: CreateDirectorDto, appelant: User) {
    let organisationId: string;

    if (appelant.role === UserRole.SUPER_ADMIN) {
      if (!dto.organisationId) {
        throw new BadRequestException("L'école est requise.");
      }
      organisationId = dto.organisationId;
      await this.organisationsService.findOne(organisationId); // 404 si l'école n'existe pas
    } else {
      if (!appelant.organisationId) {
        throw new ForbiddenException("Vous n'avez pas encore d'école.");
      }
      const organisation = await this.organisationsService.findOne(appelant.organisationId);
      if (!organisation.allowAdditionalDirectors) {
        throw new ForbiddenException(
          "Vous n'êtes pas autorisé à créer d'autres comptes directeur. Contactez le Super Admin.",
        );
      }
      organisationId = appelant.organisationId;
    }

    const invitationToken = await this.directorInvitationService.signer(organisationId);
    return { invitationUrl: `${this.configService.get<string>('SCHOOL_WEB_URL', 'http://localhost:5174')}/rejoindre-ecole?token=${invitationToken}` };
  }

  /**
   * Active un compte directeur auto-inscrit (voir `AuthService.candidatureDirecteur`),
   * réservé au Super Admin. Idempotent si déjà actif. Enregistre `activatedAt`,
   * distinct de `createdAt` (la date d'inscription).
   */
  async activate(id: string) {
    const user = await this.findOne(id);
    if (user.status !== UserStatus.ACTIVE) {
      user.status = UserStatus.ACTIVE;
      user.activatedAt = new Date();
      await this.userRepository.save(user);
    }
    return user;
  }

  /**
   * Supprime un compte directeur — réservé au Super Admin (voir le contrôleur),
   * jamais délégué : un directeur ne peut que bloquer ses collaborateurs
   * (`toggleStatus`), pas les supprimer. Ne supprime jamais un Super Admin.
   */
  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    if (user.role !== UserRole.SCHOOL_ADMIN) {
      throw new ForbiddenException('Cette action ne supprime que des comptes directeur.');
    }
    await this.userRepository.remove(user);
  }

  /**
   * Déclenche une réinitialisation de mot de passe pour un compte existant,
   * à la demande du Super Admin (ex : un directeur a oublié le sien). Génère
   * un nouveau lien d'activation, invalidant tout lien précédent non utilisé
   * — l'ancien mot de passe reste valide jusqu'à ce que le nouveau lien soit
   * effectivement consommé (voir AuthService.resetPassword).
   */
  async resetPassword(id: string) {
    const user = await this.findOne(id);
    const { rawToken, tokenHash, expires } = genererJetonActivation();
    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpires = expires;
    await this.userRepository.save(user);
    return { activationUrl: this.lienActivation(rawToken) };
  }

  /**
   * Bloque/débloque un compte. Accessible à deux profils :
   * - Super Admin : n'importe quel compte, avec les garde-fous déjà en place
   *   (jamais soi-même, jamais le dernier super admin actif).
   * - Directeur (School Admin) : uniquement un collaborateur de SA PROPRE
   *   école, jamais lui-même, et seulement si le Super Admin l'a autorisé à
   *   gérer son équipe (`Organisation.allowAdditionalDirectors`).
   */
  async toggleStatus(id: string, appelant: User) {
    const user = await this.findOne(id);

    if (appelant.role === UserRole.SCHOOL_ADMIN) {
      if (user.role !== UserRole.SCHOOL_ADMIN || user.organisationId !== appelant.organisationId) {
        throw new ForbiddenException('Vous ne pouvez agir que sur les comptes directeur de votre propre école.');
      }
      const organisation = appelant.organisationId
        ? await this.organisationsService.findOne(appelant.organisationId)
        : null;
      if (!organisation?.allowAdditionalDirectors) {
        throw new ForbiddenException(
          "Vous n'êtes pas autorisé à gérer les comptes de votre équipe. Contactez le Super Admin.",
        );
      }
    }

    const surLePointDeBloquer = user.status === UserStatus.ACTIVE;

    if (surLePointDeBloquer) {
      if (id === appelant.id) {
        throw new BadRequestException('Vous ne pouvez pas bloquer votre propre compte.');
      }
      if (user.role === UserRole.SUPER_ADMIN) {
        const autresAdminsActifs = await this.userRepository.count({
          where: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
        });
        // `user` est encore compté ACTIVE à ce stade : 1 = lui seul.
        if (autresAdminsActifs <= 1) {
          throw new BadRequestException(
            'Impossible de bloquer le dernier super administrateur actif.',
          );
        }
      }
    }

    user.status = surLePointDeBloquer ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
    user.updatedBy = appelant.id;
    return this.userRepository.save(user);
  }
}
