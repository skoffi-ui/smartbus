import { Injectable, Scope, Inject, NotFoundException, Logger, InternalServerErrorException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  Organisation,
  Child, 
  Car, 
  Course,
  Trajet,
  PointRecuperation,
  Affectation,
  Montee,
  Alerte,
  BiometricEvent, 
  Parent, 
  Driver,
  Notification 
} from '@app/database';

// Cache global en mémoire pour stocker les connexions actives aux bases de données des écoles
const tenantDataSources = new Map<string, DataSource>();

@Injectable({ scope: Scope.REQUEST })
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @Inject(REQUEST) private readonly request: any,
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Retourne la connexion TypeORM (DataSource) exclusive pour l'école actuelle.
   */
  async getDataSource(tenantIdOverride?: string): Promise<DataSource> {
    const user = this.request.user;
    
    // Pour les webhooks internes (sans session), on utilise l'override
    const tenantId = tenantIdOverride || (user && user.organisationId);

    // Sécurité: Si l'utilisateur n'est pas identifié ou n'a pas d'école assignée
    if (!tenantId) {
      throw new InternalServerErrorException("Impossible de déterminer l'école depuis le jeton de sécurité ou le paramètre.");
    }

    // 1. PERFORMANCE: Vérifier si la connexion existe déjà dans le cache global
    if (tenantDataSources.has(tenantId)) {
      const dataSource = tenantDataSources.get(tenantId)!;
      if (dataSource.isInitialized) {
        return dataSource;
      }
      // Si la connexion a été perdue (timeout), on la supprime pour la recréer
      tenantDataSources.delete(tenantId);
    }

    // 2. ISOLATION: On récupère les infos secrètes de connexion depuis la DB centrale
    const org = await this.organisationRepository.findOne({
      where: { id: tenantId },
      select: {
        id: true,
        dbName: true,
        dbHost: true,
        dbPort: true,
        dbUser: true,
        dbPassword: true,
        dbProvisioned: true,
      },
    });

    if (!org) {
      throw new NotFoundException(`L'école ${tenantId} est introuvable.`);
    }

    if (!org.dbProvisioned || !org.dbName) {
      throw new InternalServerErrorException(`La base de données de l'école n'est pas encore provisionnée.`);
    }

    this.logger.log(`Connexion à la base de données isolée: ${org.dbName}`);

    // 3. CRÉATION: Créer une nouvelle instance DataSource spécifique à l'école
    const dataSourceOptions: DataSourceOptions = {
      type: 'postgres',
      host: org.dbHost || this.configService.get<string>('SUPER_DB_HOST', 'localhost'),
      port: org.dbPort || this.configService.get<number>('SUPER_DB_PORT', 5432),
      username: org.dbUser || this.configService.get<string>('SUPER_DB_USER', 'postgres'),
      password: org.dbPassword || this.configService.get<string>('SUPER_DB_PASSWORD', 'postgres'),
      database: org.dbName,
      entities: [Child, Car, Course, Trajet, PointRecuperation, Affectation, Montee, Alerte, BiometricEvent, Parent, Driver, Notification], // <-- Entités métiers chargées dynamiquement !
      synchronize: true, // Activé temporairement pour mettre à jour le schéma (ex: ajouter emp_code)
    };

    const dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();

    // 4. CACHE: Sauvegarder la connexion pour les futures requêtes de cette même école
    tenantDataSources.set(tenantId, dataSource);

    return dataSource;
  }

  /**
   * Retourne dynamiquement l'ID de la première école (utile pour les webhooks sans session)
   */
  async getFirstOrganisationId(): Promise<string | null> {
    const org = await this.organisationRepository.findOne({
      where: {}, // Requis par TypeORM 0.3+ pour findOne
      order: { createdAt: 'DESC' }
    });
    return org ? org.id : null;
  }
}
