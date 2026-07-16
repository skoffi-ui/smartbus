import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, SandboxPaymentStatus, SandboxPaymentMethod, Subscription, SubscriptionStatus, SubscriptionPlan, Organisation, OrganisationStatus } from '@app/database';

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
  ) {}

  /**
   * Simule un paiement réussi en Sandbox et prolonge l'abonnement de 5 minutes.
   */
  async sandboxCheckout(organisationId: string, plan: SubscriptionPlan = SubscriptionPlan.STARTER) {
    const org = await this.organisationRepository.findOne({ where: { id: organisationId } });
    if (!org) {
      throw new NotFoundException(`Organisation ${organisationId} introuvable.`);
    }

    // 1. Chercher l'abonnement existant ou en créer un nouveau
    let subscription = await this.subscriptionRepository.findOne({ where: { organisationId } });
    
    const now = new Date();
    // En mode test Sandbox, on ajoute 5 minutes (au lieu de 1 mois)
    const endDate = new Date(now.getTime() + 5 * 60 * 1000); 

    if (subscription) {
      subscription.plan = plan;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.endDate = endDate;
      // S'il était expiré, la date de début devient "maintenant", sinon on la laisse telle quelle
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
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
        pricePerMonth: plan === SubscriptionPlan.STARTER ? 50000 : 100000, // Faux prix pour le test
        maxCars: plan === SubscriptionPlan.STARTER ? 2 : 10,
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

    this.logger.log(`Paiement Sandbox réussi pour l'école ${org.code}. Fin de l'abonnement: ${endDate.toLocaleTimeString()}`);

    return {
      message: 'Paiement de test réussi ! L\'abonnement est prolongé de 5 minutes.',
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
