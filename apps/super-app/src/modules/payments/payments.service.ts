import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Payment,
  SandboxPaymentStatus,
  SandboxPaymentMethod,
  Subscription,
  SubscriptionStatus,
  SubscriptionPlan,
  Organisation,
  OrganisationStatus,
} from '@app/database';
import { PlanTarifsService } from '../plan-tarifs/plan-tarifs.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    private readonly planTarifsService: PlanTarifsService,
  ) {}

  /**
   * Simule un paiement réussi en Sandbox et prolonge l'abonnement d'un mois.
   *
   * Prolongeait auparavant de 5 minutes ("mode test") — un reliquat de
   * développement qui rendait ce point d'entrée inutilisable comme vrai
   * geste de paiement pour un directeur (voir Abonnement.tsx, school-web) :
   * même si l'argent lui-même reste simulé (vrai CinetPay hors périmètre),
   * la durée accordée doit être réelle. Même calcul que
   * `CinetpayService.handleWebhook` (flux Mobile Money).
   */
  async sandboxCheckout(
    organisationId: string,
    plan: SubscriptionPlan = SubscriptionPlan.STARTER,
  ) {
    const org = await this.organisationRepository.findOne({
      where: { id: organisationId },
    });
    if (!org) {
      throw new NotFoundException(
        `Organisation ${organisationId} introuvable.`,
      );
    }

    // 1. Chercher l'abonnement existant ou en créer un nouveau
    let subscription = await this.subscriptionRepository.findOne({
      where: { organisationId },
    });

    // Tarif réel du forfait demandé (voir PlanTarif) — avant ce correctif,
    // seuls 2 prix existaient en dur pour les 5 forfaits (BASIC/STANDARD/
    // PREMIUM/ENTERPRISE partageaient tous le même prix "par défaut", sans
    // rapport avec leurs plafonds réels de véhicules).
    const tarif = await this.planTarifsService.findOne(plan);

    const now = new Date();
    const endDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
    );

    if (subscription) {
      // Lu AVANT d'écraser le statut ci-dessous : sinon la comparaison
      // suivante ("était-il expiré ?") se faisait déjà contre la nouvelle
      // valeur ACTIVE qu'on venait d'assigner, toujours vraie — la date de
      // début n'était donc jamais réinitialisée après une vraie expiration.
      const statutAvant = subscription.status;
      subscription.plan = plan;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.endDate = endDate;
      subscription.pricePerMonth = tarif.pricePerMonth;
      subscription.maxCars = tarif.maxCars;
      subscription.maxChildren = tarif.maxChildren;
      if (statutAvant !== SubscriptionStatus.ACTIVE) {
        subscription.startDate = now;
      }
      subscription = await this.subscriptionRepository.save(subscription);
    } else {
      subscription = this.subscriptionRepository.create({
        organisationId,
        plan,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        endDate,
        pricePerMonth: tarif.pricePerMonth,
        maxCars: tarif.maxCars,
        maxChildren: tarif.maxChildren,
      });
      subscription = await this.subscriptionRepository.save(subscription);
    }

    // 2. Enregistrer la transaction financière
    const payment = this.paymentRepository.create({
      organisationId,
      subscriptionId: subscription.id,
      amount: subscription.pricePerMonth,
      currency: 'FCFA',
      status: SandboxPaymentStatus.SUCCESS,
      method: SandboxPaymentMethod.SANDBOX_CARD,
      externalReference: `SANDBOX_${Date.now()}`,
    });
    await this.paymentRepository.save(payment);

    // 3. Réactiver l'école si elle était suspendue
    if (org.status !== OrganisationStatus.ACTIVE) {
      org.status = OrganisationStatus.ACTIVE;
      await this.organisationRepository.save(org);
    }

    this.logger.log(
      `Paiement Sandbox réussi pour l'école ${org.code}. Fin de l'abonnement: ${endDate.toLocaleTimeString()}`,
    );

    return {
      message:
        "Paiement de test réussi ! L'abonnement est prolongé de 5 minutes.",
      subscription,
      payment,
    };
  }

  /**
   * Récupère tout l'historique des paiements (pour le Super Admin)
   */
  async findAll() {
    return this.paymentRepository.find({
      relations: { organisation: true, subscription: true },
      order: { createdAt: 'DESC' },
    });
  }
}
