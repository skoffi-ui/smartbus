import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, SandboxPaymentStatus, SandboxPaymentMethod, Subscription, SubscriptionStatus, Organisation, OrganisationStatus } from '@app/database';
import { v4 as uuidv4 } from 'uuid';
import { CinetpayWebhookDto } from './dto/cinetpay-webhook.dto';

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
  async initiatePayment(organisationId: string, plan: string, amount: number, method: string) {
    const org = await this.organisationRepository.findOne({ where: { id: organisationId } });
    if (!org) {
      throw new NotFoundException(`Organisation ${organisationId} introuvable.`);
    }

    // 1. Déterminer ou créer l'abonnement
    let subscription = await this.subscriptionRepository.findOne({ where: { organisationId } });
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
   *
   * Le montant et la devise doivent être ceux du paiement encore PENDING :
   * une notification authentifiée mais incohérente ne change rien. Le passage
   * d'état est conditionnel (`PENDING` uniquement) dans une transaction, donc
   * un rejeu — ou deux notifications concurrentes — ne prolonge l'abonnement
   * qu'une fois. Le second appel est refusé (409).
   */
  async handleWebhook(payload: CinetpayWebhookDto) {
    const { paymentId, status, transactionId, amount, currency } = payload;

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: { subscription: true, organisation: true },
    });

    if (!payment) {
      this.logger.error(`Webhook reçu pour un paiement introuvable : ${paymentId}`);
      throw new NotFoundException('Paiement introuvable');
    }

    if (payment.status !== SandboxPaymentStatus.PENDING) {
      this.logger.warn(
        `Webhook rejoué pour un paiement déjà traité : ${payment.id} (${payment.status}).`,
      );
      throw new ConflictException(
        'Cette transaction a déjà été traitée : l\'abonnement n\'est pas prolongé une seconde fois.',
      );
    }

    if (
      !this.montantCorrespond(payment.amount, amount) ||
      !this.deviseCorrespond(payment.currency, currency)
    ) {
      this.logger.warn(
        `Webhook refusé : montant ou devise incohérent pour le paiement ${payment.id}.`,
      );
      throw new BadRequestException(
        'Le montant ou la devise ne correspond pas au paiement en attente.',
      );
    }

    const succes = status === 'success';

    await this.paymentRepository.manager.transaction(async (em) => {
      const resultat = await em.update(
        Payment,
        { id: payment.id, status: SandboxPaymentStatus.PENDING },
        {
          status: succes ? SandboxPaymentStatus.SUCCESS : SandboxPaymentStatus.FAILED,
          externalReference: transactionId,
        },
      );

      if (!resultat.affected) {
        throw new ConflictException(
          'Cette transaction a déjà été traitée : l\'abonnement n\'est pas prolongé une seconde fois.',
        );
      }

      if (!succes) {
        const subscription = payment.subscription;
        if (subscription.status === SubscriptionStatus.PENDING) {
          subscription.status = SubscriptionStatus.EXPIRED;
          await em.save(subscription);
        }
        this.logger.warn(`Échec de paiement mobile money pour l'école : ${payment.organisation?.name}`);
        return;
      }

      const now = new Date();
      const subscription = payment.subscription;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.startDate = now;
      // Prolonger d'un mois
      subscription.endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      await em.save(subscription);

      const org = payment.organisation;
      if (org.status !== OrganisationStatus.ACTIVE) {
        org.status = OrganisationStatus.ACTIVE;
        await em.save(org);
      }

      this.logger.log(`Abonnement activé avec succès via Mobile Money pour l'école : ${org.name}`);
    });

    return { success: true };
  }

  /**
   * Le montant TypeORM `decimal` revient souvent en chaîne (`"50000.00"`).
   * On compare des centimes pour que `50000` et `"50000.00"` soient le même
   * paiement, et que `1` ne solde pas une facture de 50 000.
   */
  private montantCorrespond(stocke: number | string, notifie: number): boolean {
    const centimesStockes = this.versCentimes(stocke);
    const centimesNotifies = this.versCentimes(notifie);
    if (centimesStockes === null || centimesNotifies === null) return false;
    return centimesStockes === centimesNotifies;
  }

  private versCentimes(valeur: number | string): number | null {
    if (typeof valeur === 'number') {
      if (!Number.isFinite(valeur)) return null;
      return Math.round(valeur * 100);
    }
    const texte = valeur.trim();
    if (!/^\d+(\.\d+)?$/.test(texte)) return null;
    const n = Number(texte);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }

  private deviseCorrespond(stockee: string, notifiee: string): boolean {
    return stockee.trim().toUpperCase() === notifiee.trim().toUpperCase();
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
