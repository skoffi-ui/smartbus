import { Injectable, Logger } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BiotimeConfigService } from '../biotime/biotime-config.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource as TenantDataSource } from 'typeorm';
import {
  Subscription,
  SubscriptionStatus,
  Organisation,
  OrganisationStatus,
  TenantConnectionService,
} from '@app/database';

/**
 * Tâches planifiées de la plateforme.
 *
 * Ce service doit rester un singleton : `@nestjs/schedule` ne sait enregistrer
 * les tâches `@Cron` que sur des fournisseurs statiques. Injecter directement
 * `TenantConnectionService`, qui est en portée requête, propageait cette portée
 * à tout le service — et le planificateur refusait alors d'enregistrer **toutes**
 * les tâches, en se contentant d'un avertissement au démarrage. Résultat : ni
 * suspension des impayés, ni surveillance des équipements, ni synchronisation
 * BioTime automatique.
 *
 * La connexion tenant est donc résolue à la demande, hors de tout contexte de
 * requête HTTP.
 */
@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    private readonly dataSource: DataSource,
    @InjectQueue('biotime-sync') private readonly biotimeQueue: Queue,
    private readonly biotimeConfigService: BiotimeConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Connexion à la base d'une école, obtenue hors contexte HTTP.
   *
   * `TenantConnectionService` attend un objet requête pour lire l'en-tête de
   * l'école ; ici l'identifiant est passé explicitement, donc un contexte vide
   * suffit et aucun en-tête n'est jamais consulté.
   */
  private async connexionEcole(
    organisationId: string,
  ): Promise<TenantDataSource> {
    const contextId = ContextIdFactory.create();
    this.moduleRef.registerRequestByContextId({}, contextId);

    const service = await this.moduleRef.resolve(
      TenantConnectionService,
      contextId,
      {
        strict: false,
      },
    );
    return service.getTenantConnection(organisationId);
  }

  // En production, on utiliserait CronExpression.EVERY_DAY_AT_MIDNIGHT
  // Mais pour notre Sandbox de 5 minutes, on le fait tourner TOUTES LES MINUTES !
  @Cron(CronExpression.EVERY_MINUTE)
  async handleSubscriptionExpirations() {
    this.logger.debug('🤖 Robot de vérification des abonnements en cours...');

    const now = new Date();

    // 1. Trouver tous les abonnements actifs dont la date de fin est dépassée
    const expiredSubscriptions = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: LessThan(now),
      },
      relations: { organisation: true },
    });

    if (expiredSubscriptions.length === 0) {
      return; // Rien à faire
    }

    this.logger.warn(
      `⚠️ ${expiredSubscriptions.length} école(s) expirée(s) détectée(s) !`,
    );

    // 2. Suspendre chaque école et son abonnement
    for (const sub of expiredSubscriptions) {
      // Mettre l'abonnement en statut "Expiré"
      sub.status = SubscriptionStatus.EXPIRED;
      await this.subscriptionRepository.save(sub);

      // Bloquer l'accès à l'école entière
      if (sub.organisation) {
        sub.organisation.status = OrganisationStatus.SUSPENDED;
        await this.organisationRepository.save(sub.organisation);
        this.logger.log(
          `⛔ L'école ${sub.organisation.name} a été automatiquement suspendue pour défaut de paiement.`,
        );
      }
    }
  }

  // Tâche de fond de surveillance de présence des badgeuses et GPS (Multi-Tenant)
  @Cron(CronExpression.EVERY_MINUTE)
  async handleDeviceHeartbeats() {
    this.logger.debug(
      '🤖 Robot de surveillance des battements de cœur des équipements...',
    );

    try {
      // 1. Récupérer toutes les écoles provisionnées
      const schools = await this.organisationRepository.find({
        where: { dbProvisioned: true },
      });

      if (schools.length === 0) return;

      // 2. Requête SQL adaptée au modèle de l'entité Device
      const inactiveQuery = `
        UPDATE devices
        SET status = 'INACTIVE'
        WHERE status = 'ACTIVE'
          AND last_sync_at < now() - INTERVAL '5 minutes'
          AND deleted_at IS NULL
        RETURNING id, model, serial_number as "serialNumber"
      `;

      // 3. Boucler sur chaque école pour interroger sa base de données dédiée
      for (const school of schools) {
        try {
          const tenantDS = await this.connexionEcole(school.id);
          const result = await tenantDS.query(inactiveQuery);

          if (result && result.length > 0) {
            for (const dev of result) {
              this.logger.error(
                `🚨 ALERTE SÉCURITÉ [École: ${school.name}] : L'équipement [Modèle: ${dev.model}] avec le numéro de série [${dev.serialNumber}] est inactif (aucun signal depuis plus de 5 minutes) !`,
              );
            }
          }
        } catch (schoolErr) {
          this.logger.warn(
            `Impossible de vérifier les équipements pour l'école ${school.name} (${school.id}) : ${schoolErr.message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Erreur globale lors de la vérification des battements de cœur : ${err.message}`,
      );
    }
  }

  /**
   * Synchronisation des pointages, toutes les 5 minutes.
   *
   * Un seul job sans `organisationId` : le worker parcourt alors toutes les écoles
   * ayant une configuration BioTime active. Chaque école a son propre serveur, donc
   * son propre curseur de synchronisation.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async triggerBioTimePunchesSync() {
    this.logger.debug(
      'Planificateur : synchronisation des pointages de toutes les ecoles configurees...',
    );
    await this.biotimeQueue.add('sync-punches', {});
  }

  /** Annuaire des enfants : un job par ecole, chaque nuit. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async triggerBioTimeChildrenSync() {
    const configs = await this.biotimeConfigService.listerActives();
    if (configs.length === 0) {
      this.logger.debug(
        'Planificateur : aucune ecole avec un serveur BioTime configure.',
      );
      return;
    }
    for (const config of configs) {
      await this.biotimeQueue.add('sync-children', {
        organisationId: config.organisationId,
      });
    }
    this.logger.debug(
      `Planificateur : annuaire mis en file pour ${configs.length} ecole(s).`,
    );
  }

  /**
   * Purge l'historique des positions GPS (`gps_position_history`) au-delà de
   * 30 jours, chaque nuit. Une ligne est écrite à chaque position ingérée
   * (voir `HardwareStreamService.enregistrerHistoriquePosition`, toutes les
   * ~20s par véhicule actif) : sans purge, cette table grossirait sans
   * limite. La table peut ne pas encore exister pour une école qui n'a
   * jamais reçu de position GPS — `DROP`/`DELETE` sur une table absente est
   * silencieusement ignoré (`IF EXISTS` sur la requête elle-même n'existe pas
   * pour DELETE, d'où la vérification préalable).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgerHistoriquePositionsGps() {
    const schools = await this.organisationRepository.find({
      where: { dbProvisioned: true },
    });
    if (schools.length === 0) return;

    let totalSupprime = 0;
    for (const school of schools) {
      try {
        const tenantDS = await this.connexionEcole(school.id);
        const existe = await tenantDS.query(
          `SELECT to_regclass('public.gps_position_history') IS NOT NULL AS existe`,
        );
        if (!existe?.[0]?.existe) continue;

        // `RETURNING id` pour compter de façon fiable : la forme du résultat
        // brut d'un DELETE sans RETURNING varie selon le pilote, alors qu'un
        // tableau de lignes est toujours prévisible.
        const result = await tenantDS.query(
          `DELETE FROM gps_position_history WHERE created_at < now() - INTERVAL '30 days' RETURNING id`,
        );
        totalSupprime += Array.isArray(result) ? result.length : 0;
      } catch (err: any) {
        this.logger.warn(
          `Purge historique GPS impossible pour ${school.name} : ${err.message}`,
        );
      }
    }

    if (totalSupprime > 0) {
      this.logger.log(
        `Purge historique GPS : ${totalSupprime} position(s) de plus de 30 jours supprimée(s).`,
      );
    }
  }
}
