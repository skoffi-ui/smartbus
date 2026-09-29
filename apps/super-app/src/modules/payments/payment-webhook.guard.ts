import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  CINETPAY_WEBHOOK_SECRET_ENV,
  CINETPAY_WEBHOOK_SECRET_HEADER,
  JETON_SECRET_WEBHOOK_PAIEMENT,
} from './payment-webhook.constants';

/**
 * Authentifie la notification de paiement par secret partagé.
 *
 * Même principe que `creerGardeCleFluxMateriel` (`device-stream-api-key.guard.ts`) :
 * comparaison en temps constant, refus si le secret n'est pas configuré.
 * Pas de repli sur un paramètre d'URL : un secret de paiement dans la query
 * finirait dans les journaux d'accès. Le prestataire et le simulateur peuvent
 * poser un en-tête, contrairement à certains logiciels de badgeuse.
 *
 * Le secret injecté a déjà été validé au démarrage (`secretWebhookPaiementRequis`).
 * Le contrôle ci-dessous reste un filet : une valeur vide ne doit jamais
 * laisser passer la notification.
 */
@Injectable()
export class PaymentWebhookGuard implements CanActivate {
  private readonly logger = new Logger(PaymentWebhookGuard.name);

  constructor(
    @Inject(JETON_SECRET_WEBHOOK_PAIEMENT)
    private readonly secretAttendu: string,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.secretAttendu) {
      this.logger.error(
        `${CINETPAY_WEBHOOK_SECRET_ENV} absente : webhook refusé.`,
      );
      throw new InternalServerErrorException(
        'Secret de webhook de paiement non configuré sur ce service.',
      );
    }

    const requete = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const fourni = requete?.headers?.[CINETPAY_WEBHOOK_SECRET_HEADER];

    if (typeof fourni !== 'string' || !this.egal(fourni, this.secretAttendu)) {
      this.logger.warn(
        'Webhook de paiement refusé : secret absent ou invalide.',
      );
      throw new UnauthorizedException('Webhook de paiement non autorisé.');
    }

    return true;
  }

  /**
   * `timingSafeEqual` lève si les longueurs diffèrent : on refuse d'abord
   * dans ce cas, comme le garde des flux matériel.
   */
  private egal(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  }
}
