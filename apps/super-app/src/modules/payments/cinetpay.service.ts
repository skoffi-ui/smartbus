import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Payment,
  SandboxPaymentStatus,
  SandboxPaymentMethod,
  Subscription,
  SubscriptionStatus,
  Organisation,
  OrganisationStatus,
} from '@app/database';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CinetpayService {
  private readonly logger = new Logger(CinetpayService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
  ) {}

  /**
   * Initialise un paiement mobile money ou carte bancaire.
   * Retourne un lien vers notre guichet de paiement simulé (ou CinetPay réel en prod).
   */
  async initiatePayment(
    organisationId: string,
    plan: string,
    amount: number,
    method: string,
  ) {
    const org = await this.organisationRepository.findOne({
      where: { id: organisationId },
    });
    if (!org) {
      throw new NotFoundException(
        `Organisation ${organisationId} introuvable.`,
      );
    }

    // 1. Déterminer ou créer l'abonnement
    let subscription = await this.subscriptionRepository.findOne({
      where: { organisationId },
    });
    if (!subscription) {
      subscription = this.subscriptionRepository.create({
        organisationId,
        plan: plan as any,
        status: SubscriptionStatus.PENDING,
        startDate: new Date(),
        endDate: new Date(),
        pricePerMonth: amount,
        maxCars: plan === 'STARTER' ? 2 : 10,
      });
      subscription = await this.subscriptionRepository.save(subscription);
    }

    // 2. Créer un paiement PENDING
    const payment = this.paymentRepository.create({
      organisationId,
      subscriptionId: subscription.id,
      amount,
      currency: 'FCFA',
      status: SandboxPaymentStatus.PENDING,
      method: this.mapMethod(method),
      externalReference: `OMN_${uuidv4().split('-')[0].toUpperCase()}`,
    });
    const savedPayment = await this.paymentRepository.save(payment);

    // 3. Retourner l'URL de redirection vers notre simulateur frontend
    // En production, ce serait l'URL de CinetPay
    const checkoutUrl = `http://localhost:5174/checkout-sandbox?paymentId=${savedPayment.id}&amount=${amount}&schoolName=${encodeURIComponent(org.name)}&method=${method}`;

    return {
      success: true,
      paymentId: savedPayment.id,
      checkoutUrl,
    };
  }

  /**
   * Traite le webhook de notification de paiement.
   */
  async handleWebhook(payload: {
    paymentId: string;
    status: string;
    transactionId: string;
  }) {
    const { paymentId, status, transactionId } = payload;

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: { subscription: true, organisation: true },
    });

    if (!payment) {
      this.logger.error(
        `Webhook reçu pour un paiement introuvable : ${paymentId}`,
      );
      throw new NotFoundException('Paiement introuvable');
    }

    if (status === 'success') {
      payment.status = SandboxPaymentStatus.SUCCESS;
      payment.externalReference = transactionId;
      await this.paymentRepository.save(payment);

      // Prolonger l'abonnement
      const now = new Date();
      const subscription = payment.subscription;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.startDate = now;
      // Prolonger d'un mois
      subscription.endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate(),
      );
      await this.subscriptionRepository.save(subscription);

      // Réactiver l'organisation
      const org = payment.organisation;
      if (org.status !== OrganisationStatus.ACTIVE) {
        org.status = OrganisationStatus.ACTIVE;
        await this.organisationRepository.save(org);
      }

      this.logger.log(
        `Abonnement activé avec succès via Mobile Money pour l'école : ${org.name}`,
      );
    } else {
      payment.status = SandboxPaymentStatus.FAILED;
      await this.paymentRepository.save(payment);

      const subscription = payment.subscription;
      if (subscription.status === SubscriptionStatus.PENDING) {
        subscription.status = SubscriptionStatus.EXPIRED;
        await this.subscriptionRepository.save(subscription);
      }
      this.logger.warn(
        `Échec de paiement mobile money pour l'école : ${payment.organisation?.name}`,
      );
    }

    return { success: true };
  }

  private mapMethod(method: string): SandboxPaymentMethod {
    switch (method.toLowerCase()) {
      case 'orange':
        return SandboxPaymentMethod.ORANGE_MONEY;
      case 'mtn':
        return SandboxPaymentMethod.MTN_MONEY;
      case 'wave':
        return SandboxPaymentMethod.WAVE;
      case 'card':
        return SandboxPaymentMethod.PREPAID_CARD;
      default:
        return SandboxPaymentMethod.MOBILE_MONEY;
    }
  }
}
