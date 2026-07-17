import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
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
  Driver 
} from '@app/database';

export interface ProvisioningResult {
  organisationId: string;
  dbName: string;
  status: 'success' | 'error';
  message: string;
}

/**
 * Service de provisionnement des bases de données école.
 *
 * Lors de la création d'une organisation, ce service :
 * 1. Génère un nom de base de données unique
 * 2. Crée la base PostgreSQL dédiée
 * 3. Crée le schéma initial (tables) via des migrations
 * 4. Met à jour l'enregistrement Organisation avec les infos de connexion
 */
@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Provisionne la base de données pour une organisation
   */
  async provisionOrganisation(organisationId: string): Promise<ProvisioningResult> {
    const organisation = await this.organisationRepository.findOne({
      where: { id: organisationId },
    });

    if (!organisation) {
      throw new NotFoundException(`Organisation ${organisationId} introuvable`);
    }

    if (organisation.dbProvisioned) {
      throw new ConflictException(
        `La base de données de l'organisation ${organisationId} est déjà provisionnée`,
      );
    }

    const dbName = this.generateDatabaseName(organisation.code);
    this.logger.log(`Provisionnement de la base: ${dbName} pour org: ${organisation.name}`);

    try {
      // 1. Créer la base de données
      await this.createDatabase(dbName);

      // 2. Créer le schéma initial
      await this.createSchoolSchema(dbName);

      // 3. Mettre à jour l'organisation
      await this.organisationRepository.update(organisationId, {
        dbName,
        dbHost: this.configService.get<string>('SUPER_DB_HOST', 'localhost'),
        dbPort: this.configService.get<number>('SUPER_DB_PORT', 5432),
        dbUser: this.configService.get<string>('SUPER_DB_USER', 'postgres'),
        dbPassword: this.configService.get<string>('SUPER_DB_PASSWORD', 'postgres'),
        dbProvisioned: true,
      });

      this.logger.log(`✅ Base ${dbName} provisionnée avec succès`);

      return {
        organisationId,
        dbName,
        status: 'success',
        message: `Base de données ${dbName} créée et configurée avec succès`,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur lors du provisionnement de ${dbName}:`, error);
      return {
        organisationId,
        dbName,
        status: 'error',
        message: `Erreur: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Génère un nom de base de données à partir du code organisation
   */
  private generateDatabaseName(orgCode: string): string {
    const sanitized = orgCode.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return `smartbus_school_${sanitized}`;
  }

  /**
   * Crée la base de données PostgreSQL
   */
  private async createDatabase(dbName: string): Promise<void> {
    // Utilise la connexion principale pour créer la base
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Vérifier si la base existe déjà
      const result = await queryRunner.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [dbName],
      );

      if (result.length === 0) {
        // Échapper le nom pour éviter les injections SQL
        await queryRunner.query(`CREATE DATABASE "${dbName}"`);
        this.logger.log(`Base de données "${dbName}" créée`);
      } else {
        this.logger.log(`Base de données "${dbName}" existe déjà`);
      }
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Crée le schéma initial de la base école
   *
   * NOTE: En production, utiliser TypeORM Migrations au lieu de synchronize.
   * Cette méthode crée les tables essentielles pour l'APP École.
   */
  private async createSchoolSchema(dbName: string): Promise<void> {
    // Créer une connexion temporaire vers la nouvelle base
    const { DataSource: DS } = await import('typeorm');
    const schoolDataSource = new DS({
      type: 'postgres',
      host: this.configService.get<string>('SUPER_DB_HOST', 'localhost'),
      port: this.configService.get<number>('SUPER_DB_PORT', 5432),
      username: this.configService.get<string>('SUPER_DB_USER', 'postgres'),
      password: this.configService.get<string>('SUPER_DB_PASSWORD', 'postgres'),
      database: dbName,
      entities: [Child, Car, Course, Trajet, PointRecuperation, Affectation, Montee, Alerte, BiometricEvent, Parent, Driver],
      synchronize: true, // Magie : Crée toutes les tables automatiquement !
    });

    try {
      await schoolDataSource.initialize();

      // Créer le schéma minimal via SQL
      await schoolDataSource.query(`
        CREATE TABLE IF NOT EXISTS meta_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          schema_version VARCHAR(20) NOT NULL,
          app_version VARCHAR(20) NOT NULL,
          migration_name VARCHAR(255),
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          description TEXT,
          organisation_id UUID,
          metadata JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Insérer la version initiale du schéma
      await schoolDataSource.query(`
        INSERT INTO meta_data (schema_version, app_version, migration_name, applied_at, description)
        VALUES ('1.0.0', '1.0.0', 'initial_schema', NOW(), 'Provisionnement initial de la base école')
        ON CONFLICT DO NOTHING;
      `);

      this.logger.log(`Schéma initial créé dans "${dbName}"`);
    } finally {
      if (schoolDataSource.isInitialized) {
        await schoolDataSource.destroy();
      }
    }
  }

  /**
   * Récupère les infos de provisionnement d'une organisation
   */
  async getProvisioningStatus(organisationId: string): Promise<{
    provisioned: boolean;
    dbName: string | null;
    dbHost: string | null;
  }> {
    const org = await this.organisationRepository.findOne({
      where: { id: organisationId },
      select: { id: true, dbProvisioned: true, dbName: true, dbHost: true },
    });

    if (!org) throw new NotFoundException(`Organisation ${organisationId} introuvable`);

    return {
      provisioned: org.dbProvisioned,
      dbName: org.dbName,
      dbHost: org.dbHost,
    };
  }

  /**
   * Détruit complètement et définitivement la base de données d'une organisation
   */
  async dropOrganisationDatabase(dbName: string): Promise<void> {
    if (!dbName || !dbName.startsWith('smartbus_school_')) {
      this.logger.warn(`Nom de base de données invalide ou dangereux ignoré : ${dbName}`);
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // 1. Fermer toutes les connexions actives à cette base (PgAdmin, requêtes fantômes...)
      await queryRunner.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1 AND pid <> pg_backend_pid();
      `, [dbName]);

      // 2. Supprimer la base de données
      await queryRunner.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      this.logger.log(`🗑️ Base de données "${dbName}" totalement détruite.`);
    } catch (error) {
      this.logger.error(`❌ Impossible de détruire la base de données "${dbName}":`, error);
    } finally {
      await queryRunner.release();
    }
  }
}
