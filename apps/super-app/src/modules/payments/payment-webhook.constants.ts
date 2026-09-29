/** Variable d'environnement du secret partagé du webhook de paiement. */
export const CINETPAY_WEBHOOK_SECRET_ENV = 'CINETPAY_WEBHOOK_SECRET';

/**
 * En-tête HTTP portant ce secret. Distinct du JWT utilisateur : l'appelant
 * est le prestataire (ou le simulateur), pas un compte de l'application.
 */
export const CINETPAY_WEBHOOK_SECRET_HEADER = 'x-cinetpay-webhook-secret';

/** Nom du schéma de sécurité OpenAPI associé à cet en-tête. */
export const CINETPAY_WEBHOOK_SECURITY_SCHEME = 'cinetpay-webhook-secret';

/** Jeton d'injection du secret déjà validé au démarrage. */
export const JETON_SECRET_WEBHOOK_PAIEMENT = Symbol('CINETPAY_WEBHOOK_SECRET');

/** Longueur minimale : même barre que `JWT_SECRET`, un secret court n'est pas un secret. */
export const LONGUEUR_MINIMALE_SECRET_WEBHOOK = 32;
