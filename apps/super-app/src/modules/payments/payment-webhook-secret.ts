import { ConfigService } from '@nestjs/config';
import {
  CINETPAY_WEBHOOK_SECRET_ENV,
  LONGUEUR_MINIMALE_SECRET_WEBHOOK,
} from './payment-webhook.constants';

/**
 * Secret du webhook de paiement, ou refus de démarrer.
 *
 * `POST /payments/webhook` n'a pas de JWT : sans secret obligatoire, n'importe
 * quel corps marquait un paiement PENDING comme réussi, prolongeait
 * l'abonnement et réactivait l'école. Il n'existe pas de repli sûr. Mieux vaut
 * une super-app qui refuse de démarrer qu'une route de paiement ouverte.
 *
 * Les espaces en tête et en fin sont retirés : un saut de ligne collé par
 * l'environnement ne doit pas rendre le secret impossible à présenter.
 */
export function secretWebhookPaiementRequis(config: ConfigService): string {
  const brut = config.get<string>(CINETPAY_WEBHOOK_SECRET_ENV);
  const secret = typeof brut === 'string' ? brut.trim() : '';

  if (!secret) {
    throw new Error(
      'CINETPAY_WEBHOOK_SECRET est requis : la super-app refuse de démarrer sans le secret du webhook de paiement.',
    );
  }

  if (secret.length < LONGUEUR_MINIMALE_SECRET_WEBHOOK) {
    throw new Error(
      `CINETPAY_WEBHOOK_SECRET est trop court (${secret.length} caractères, minimum ${LONGUEUR_MINIMALE_SECRET_WEBHOOK}).`,
    );
  }

  return secret;
}
