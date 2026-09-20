import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BiotimeConfigService } from '../biotime/biotime-config.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Subscription, SubscriptionStatus, Organisation, OrganisationStatus, TenantConnectionService } from '@app/database';

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
    private readonly tenantConnectionService: TenantConnectionService,
  ) {}

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

    this.logger.warn(`⚠️ ${expiredSubscriptions.length} école(s) expirée(s) détectée(s) !`);

    // 2. Suspendre chaque école et son abonnement
    for (const sub of expiredSubscriptions) {
      // Mettre l'abonnement en statut "Expiré"
      sub.status = SubscriptionStatus.EXPIRED;
      await this.subscriptionRepository.save(sub);

      // Bloquer l'accès à l'école entière
      if (sub.organisation) {
        sub.organisation.status = OrganisationStatus.SUSPENDED;
        await this.organisationRepository.save(sub.organisation);
        this.logger.log(`⛔ L'école ${sub.organisation.name} a été automatiquement suspendue pour défaut de paiement.`);
      }
    }
  }

  // Tâche de fond de surveillance de présence des badgeuses et GPS (Multi-Tenant)
  @Cron(CronExpression.EVERY_MINUTE)
  async handleDeviceHeartbeats() {
    this.logger.debug('🤖 Robot de surveillance des battements de cœur des équipements...');

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
          const tenantDS = await this.tenantConnectionService.getTenantConnection(school.id);
          const result = await tenantDS.query(inactiveQuery);

          if (result && result.length > 0) {
            for (const dev of result) {
              this.logger.error(
                `🚨 ALERTE SÉCURITÉ [École: ${school.name}] : L'équipement [Modèle: ${dev.model}] avec le numéro de série [${dev.serialNumber}] est inactif (aucun signal depuis plus de 5 minutes) !`
              );
            }
          }
        } catch (schoolErr) {
          this.logger.warn(
            `Impossible de vérifier les équipements pour l'école ${school.name} (${school.id}) : ${schoolErr.message}`
          );
        }
      }
    } catch (err) {
      this.logger.error(`Erreur globale lors de la vérification des battements de cœur : ${err.message}`);
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
    this.logger.debug('Planificateur : synchronisation des pointages de toutes les ecoles configurees...');
    await this.biotimeQueue.add('sync-punches', {});
  }

  /** Annuaire des enfants : un job par ecole, chaque nuit. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async triggerBioTimeChildrenSync() {
    const configs = await this.biotimeConfigService.listerActives();
    if (configs.length === 0) {
      this.logger.debug('Planificateur : aucune ecole avec un serveur BioTime configure.');
      return;
    }
    for (const config of configs) {
      await this.biotimeQueue.add('sync-children', { organisationId: config.organisationId });
    }
    this.logger.debug(`Planificateur : annuaire mis en file pour ${configs.length} ecole(s).`);
  }
}
