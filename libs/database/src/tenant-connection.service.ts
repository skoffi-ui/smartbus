import { Injectable, Scope, Inject, NotFoundException, Logger, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, DataSourceOptions, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Organisation } from './entities/organisation.entity';
import { 
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
  Notification,
  AlerteCritique,
  Device,
  DeviceAssignment,
  BiometricConsent,
  CourseExecution
} from './index';

// Cache global pour stocker les connexions actives
const tenantDataSources = new Map<string, DataSource>();

@Injectable({ scope: Scope.REQUEST })
export class TenantConnectionService {
  private readonly logger = new Logger(TenantConnectionService.name);

  constructor(
    @Inject(REQUEST) private readonly request: any,
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Résout la connexion (DataSource) appropriée pour l'école actuelle en fonction du header HTTP 'x-tenant-id'.
   */
  async getTenantConnection(tenantIdOverride?: string): Promise<DataSource> {
    // 1. Déterminer l'ID du Tenant : via override (ex: workers/crons) ou via le header HTTP 'x-tenant-id'
    let tenantId = tenantIdOverride;
    
    if (!tenantId && this.request) {
      // support de Express request headers
      const headers = this.request.headers || {};
      tenantId = headers['x-tenant-id'] || headers['x-tenant-schema'];
      
      // Fallback sur request.user si disponible via auth guards
      if (!tenantId && this.request.user) {
        tenantId = this.request.user.organisationId;
      }
    }

    if (!tenantId) {
      throw new InternalServerErrorException(
        "Impossible de déterminer l'école (Tenant). En-tête 'x-tenant-id' manquant."
      );
    }

    // 2. Vérifier le cache en mémoire
    if (tenantDataSources.has(tenantId)) {
      const cachedDS = tenantDataSources.get(tenantId)!;
      if (cachedDS.isInitialized) {
        // Obtenir le statut actuel depuis la DB globale pour s'assurer qu'il n'a pas été suspendu entre temps
        const orgCheck = await this.organisationRepository.findOne({
          where: { id: tenantId },
          select: { status: true },
        });
        if (orgCheck && orgCheck.status === 'active') {
          return cachedDS;
        }
        // Si l'école a été suspendue, on détruit la connexion et on nettoie le cache
        try {
          await cachedDS.destroy();
        } catch {}
        tenantDataSources.delete(tenantId);
      }
    }

    // 3. Récupérer les informations de connexion de l'école depuis la base globale
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
        status: true,
      },
    });

    if (!org) {
      throw new NotFoundException(`L'école avec l'identifiant ${tenantId} n'existe pas.`);
    }

    // Vérifier si l'établissement est actif
    if (org.status !== 'active') {
      throw new ForbiddenException(`L'accès à l'école [${org.id}] est actuellement suspendu ou désactivé.`);
    }

    if (!org.dbProvisioned || !org.dbName) {
      throw new InternalServerErrorException(
        `La base de données de l'école ${org.id} n'est pas encore provisionnée.`
      );
    }

    this.logger.log(`Connexion dynamique au schéma/base de données de l'école : ${org.dbName}`);

    // 4. Initialiser la nouvelle DataSource
    const dataSourceOptions: DataSourceOptions = {
      type: 'postgres',
      host: org.dbHost || this.configService.get<string>('SUPER_DB_HOST', 'localhost'),
      port: org.dbPort || this.configService.get<number>('SUPER_DB_PORT', 5432),
      username: org.dbUser || this.configService.get<string>('SUPER_DB_USER', 'postgres'),
      password: org.dbPassword || this.configService.get<string>('SUPER_DB_PASSWORD', 'postgres'),
      database: org.dbName,
      entities: [
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
        Notification, 
        AlerteCritique,
        Device,
        DeviceAssignment,
        BiometricConsent,
        CourseExecution
      ],
      synchronize: this.configService.get<string>('NODE_ENV') === 'development',
    };

    const dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();

    // Enregistrer dans le cache
    tenantDataSources.set(tenantId, dataSource);

    return dataSource;
  }
}
