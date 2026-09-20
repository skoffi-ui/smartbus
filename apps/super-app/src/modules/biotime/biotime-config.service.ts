import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BiotimeConfig, Organisation } from '@app/database';
import { CryptoService } from '@app/common';

/** Configuration BioTime telle qu'exposée à l'interface : jamais le mot de passe. */
export interface BiotimeConfigPublique {
  organisationId: string;
  organisationName?: string;
  url: string;
  username: string;
  isActive: boolean;
  lastSyncedAt: Date | null;
  lastSyncCount: number | null;
  lastSyncedPunchId: string | null;
  lastError: string | null;
  lastErrorAt: Date | null;
}

export interface EnregistrerConfigDto {
  url: string;
  username: string;
  /** Laissé vide lors d'une modification : le mot de passe existant est conservé. */
  password?: string;
  isActive?: boolean;
}

/**
 * Gestion de la configuration BioTime **par école**.
 *
 * Remplace l'ancien réglage global (URL dans `data/config-biotime.json` et
 * identifiants dans les variables d'environnement), qui rendait impossible
 * l'accueil d'un deuxième établissement : chaque école a son propre serveur.
 */
@Injectable()
export class BiotimeConfigService {
  private readonly logger = new Logger(BiotimeConfigService.name);

  constructor(
    @InjectRepository(BiotimeConfig)
    private readonly configRepository: Repository<BiotimeConfig>,
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    private readonly crypto: CryptoService,
  ) {}

  private versionPublique(config: BiotimeConfig): BiotimeConfigPublique {
    return {
      organisationId: config.organisationId,
      organisationName: config.organisation?.name,
      url: config.url,
      username: config.username,
      isActive: config.isActive,
      lastSyncedAt: config.lastSyncedAt,
      lastSyncCount: config.lastSyncCount,
      lastSyncedPunchId: config.lastSyncedPunchId,
      lastError: config.lastError,
      lastErrorAt: config.lastErrorAt,
    };
  }

  /** Configurations de toutes les écoles, pour la supervision centrale. */
  async listerToutes(): Promise<BiotimeConfigPublique[]> {
    const configs = await this.configRepository.find({
      relations: { organisation: true },
      order: { createdAt: 'ASC' },
    });
    return configs.map((c) => this.versionPublique(c));
  }

  async obtenirPublique(organisationId: string): Promise<BiotimeConfigPublique | null> {
    const config = await this.configRepository.findOne({
      where: { organisationId },
      relations: { organisation: true },
    });
    return config ? this.versionPublique(config) : null;
  }

  /** Écoles actives à synchroniser. */
  async listerActives(): Promise<BiotimeConfig[]> {
    return this.configRepository.find({ where: { isActive: true } });
  }

  /**
   * Crée ou met à jour la configuration d'une école.
   * Le mot de passe n'est chiffré que s'il est fourni : une modification d'URL
   * n'oblige pas à le ressaisir.
   */
  async enregistrer(
    organisationId: string,
    dto: EnregistrerConfigDto,
  ): Promise<BiotimeConfigPublique> {
    const organisation = await this.organisationRepository.findOne({
      where: { id: organisationId },
      select: { id: true, name: true },
    });
    if (!organisation) {
      throw new NotFoundException(`École ${organisationId} introuvable.`);
    }

    const url = (dto.url || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\/.+/i.test(url)) {
      throw new BadRequestException(
        "L'URL BioTime doit commencer par http:// ou https:// (ex. http://192.168.1.50:8080).",
      );
    }
    if (!dto.username?.trim()) {
      throw new BadRequestException("Le nom d'utilisateur BioTime est requis.");
    }

    let config = await this.configRepository.findOne({ where: { organisationId } });

    if (!config) {
      if (!dto.password) {
        throw new BadRequestException(
          'Le mot de passe BioTime est requis à la première configuration.',
        );
      }
      config = this.configRepository.create({ organisationId });
    }

    config.url = url;
    config.username = dto.username.trim();
    if (dto.isActive !== undefined) config.isActive = dto.isActive;

    if (dto.password) {
      const secret = this.crypto.chiffrer(dto.password);
      config.passwordCiphertext = secret.ciphertext;
      config.passwordIv = secret.iv;
      config.passwordTag = secret.tag;
    }

    // Une nouvelle configuration remet l'état de synchronisation à zéro :
    // le curseur de l'ancien serveur n'a aucun sens sur le nouveau.
    config.lastError = null;
    config.lastErrorAt = null;

    const enregistre = await this.configRepository.save(config);
    this.logger.log(`Configuration BioTime enregistrée pour l'école ${organisation.name}`);

    return this.versionPublique({ ...enregistre, organisation } as BiotimeConfig);
  }

  /** Identifiants déchiffrés, à usage interne du service de synchronisation. */
  async obtenirIdentifiants(
    organisationId: string,
  ): Promise<{ url: string; username: string; password: string }> {
    const config = await this.configRepository.findOne({ where: { organisationId } });
    if (!config) {
      throw new NotFoundException(
        `Aucun serveur BioTime configuré pour l'école ${organisationId}.`,
      );
    }
    return {
      url: config.url,
      username: config.username,
      password: this.crypto.dechiffrer({
        ciphertext: config.passwordCiphertext,
        iv: config.passwordIv,
        tag: config.passwordTag,
      }),
    };
  }

  async supprimer(organisationId: string): Promise<void> {
    await this.configRepository.delete({ organisationId });
    this.logger.log(`Configuration BioTime supprimée pour l'école ${organisationId}`);
  }

  // ── État de synchronisation ──────────────────────────────────────────────

  async enregistrerSucces(
    organisationId: string,
    dernierPunchId: string | null,
    nombre: number,
  ): Promise<void> {
    await this.configRepository.update(
      { organisationId },
      {
        lastSyncedAt: new Date(),
        lastSyncCount: nombre,
        lastError: null,
        lastErrorAt: null,
        ...(dernierPunchId ? { lastSyncedPunchId: dernierPunchId } : {}),
      },
    );
  }

  async enregistrerEchec(organisationId: string, message: string): Promise<void> {
    await this.configRepository.update(
      { organisationId },
      { lastError: message.slice(0, 1000), lastErrorAt: new Date() },
    );
  }
}
