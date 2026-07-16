import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Subscription, SubscriptionStatus, Organisation, OrganisationStatus } from '@app/database';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
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
}
