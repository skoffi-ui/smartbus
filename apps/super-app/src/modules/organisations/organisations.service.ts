import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Like } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Organisation, OrganisationStatus } from '@app/database';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { UpdateMySchoolDto } from './dto/update-my-school.dto';
import { PaginationDto, PaginationResponseDto } from '@app/common';

import { ProvisioningService } from '../provisioning/provisioning.service';
import { BiotimeCentralService } from '../biotime/biotime-central.service';

@Injectable()
export class OrganisationsService {
  constructor(
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    private readonly provisioningService: ProvisioningService,
    private readonly biotimeCentralService: BiotimeCentralService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private generateSchoolCode(schoolName: string): string {
    const consonants = schoolName
      .replace(/[^bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g, '')
      .toUpperCase();
    const prefix = (consonants.substring(0, 3) + 'XXX').substring(0, 3);
    const randomNumbers = Math.floor(1000 + Math.random() * 9000).toString();
    return `${prefix}-${randomNumbers}`;
  }

  async create(dto: CreateOrganisationDto): Promise<Organisation> {
    // Si le code est déjà fourni, on vérifie juste s'il existe
    if (dto.code) {
      const existing = await this.organisationRepository.findOne({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException(`Le code organisation "${dto.code}" est déjà utilisé`);
      }
    }

    // Boucle de génération anti-collision (10 tentatives max)
    let generatedCode = dto.code || this.generateSchoolCode(dto.name);
    let isUnique = !!dto.code; // Si le code a été fourni et n'a pas crashé au-dessus, c'est bon
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const existing = await this.organisationRepository.findOne({ where: { code: generatedCode } });
      if (!existing) {
        isUnique = true;
      } else {
        generatedCode = this.generateSchoolCode(dto.name);
        attempts++;
      }
    }

    if (!isUnique) {
      throw new InternalServerErrorException('Impossible de générer un code unique. Veuillez réessayer.');
    }

    const org = this.organisationRepository.create({
      ...dto,
      code: generatedCode,
    });
    const saved = await this.organisationRepository.save(org);

    // 1 organisation = 1 département BioTime : bloquant et explicite, pas de
    // fallback silencieux. Une école sans département ne pourrait jamais
    // synchroniser ses élèves (voir children.service.ts), donc mieux vaut
    // échouer maintenant, clairement, que découvrir le problème plus tard
    // à la création du premier élève.
    try {
      return await this.biotimeCentralService.createDepartmentForOrganisation(saved.id);
    } catch (error: any) {
      await this.organisationRepository.remove(saved);
      throw new InternalServerErrorException(
        `L'organisation n'a pas été créée : échec de la création de son département BioTime (${error.message}).`,
      );
    }
  }

  async findAll(
    pagination: PaginationDto,
    search?: string,
  ): Promise<PaginationResponseDto<Organisation>> {
    const options: FindManyOptions<Organisation> = {
      skip: pagination.skip,
      take: pagination.limit,
      order: { createdAt: 'DESC' },
      relations: { subscriptions: true },
    };

    if (search) {
      options.where = [{ name: Like(`%${search}%`) }, { code: Like(`%${search}%`) }];
    }

    const [data, total] = await this.organisationRepository.findAndCount(options);
    return new PaginationResponseDto(data, total, pagination.page ?? 1, pagination.limit ?? 10);
  }

  async findOne(id: string): Promise<Organisation> {
    const org = await this.organisationRepository.findOne({ where: { id } });
    if (!org) throw new NotFoundException(`Organisation ${id} introuvable`);
    return org;
  }

  async update(id: string, dto: UpdateOrganisationDto): Promise<Organisation> {
    const org = await this.findOne(id);
    Object.assign(org, dto);
    const saved = await this.organisationRepository.save(org);

    // `allowedFeatures` change bel et bien : on prévient tout de suite le
    // client déjà connecté (WebSocket déjà ouvert pour le suivi live/les
    // alertes, voir HardwareStreamGateway) plutôt que le laisser avec le
    // menu périmé jusqu'à un rechargement de page ou l'expiration du jeton.
    // Aucune connexion ni requête supplémentaire n'est créée : seul un
    // évènement est émis sur le salon que le client occupe déjà.
    if (dto.allowedFeatures !== undefined || dto.allowAdditionalDirectors !== undefined) {
      this.eventEmitter.emit('organisation.permissions_updated', { organisationId: saved.id });
    }

    return saved;
  }

  /**
   * Lecture par un directeur des informations de SA PROPRE école, pour
   * Paramètres → "Mon École" (school-web) — évite de lui redemander ce
   * qu'il a déjà saisi à la création (`AuthService.creerMonEcole`).
   * `organisationId` vient toujours de `appelant.organisationId` (jamais
   * d'un paramètre d'URL) : aucune énumération possible d'une autre école.
   */
  async findMine(organisationId: string | null): Promise<Organisation> {
    if (!organisationId) {
      throw new ForbiddenException("Vous n'avez pas encore d'école.");
    }
    return this.findOne(organisationId);
  }

  /**
   * Modification par un directeur des informations de SA PROPRE école
   * (nom, adresse, téléphone, email, site web uniquement — voir
   * `UpdateMySchoolDto`). Jamais `allowedFeatures`, `allowAdditionalDirectors`,
   * `status` ni les colonnes BioTime : celles-ci restent réservées au Super
   * Admin via `update()`/`PATCH /organisations/:id`.
   */
  async updateMine(organisationId: string | null, dto: UpdateMySchoolDto): Promise<Organisation> {
    if (!organisationId) {
      throw new ForbiddenException("Vous n'avez pas encore d'école.");
    }
    const org = await this.findOne(organisationId);
    Object.assign(org, dto);
    return this.organisationRepository.save(org);
  }

  async suspend(id: string): Promise<Organisation> {
    const org = await this.findOne(id);
    org.status = OrganisationStatus.SUSPENDED;
    return this.organisationRepository.save(org);
  }

  async activate(id: string): Promise<Organisation> {
    const org = await this.findOne(id);
    org.status = OrganisationStatus.ACTIVE;
    return this.organisationRepository.save(org);
  }

  async remove(id: string): Promise<void> {
    const org = await this.findOne(id);
    
    // 1. Détruire la base de données PostgreSQL isolée si elle existe
    if (org.dbName && org.dbProvisioned) {
      await this.provisioningService.dropOrganisationDatabase(org.dbName);
    }

    // 2. Supprimer l'enregistrement de la Super Base (qui supprimera en cascade abonnements et paiements)
    await this.organisationRepository.remove(org);
  }
}
