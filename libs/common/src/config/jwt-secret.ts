import { ConfigService } from '@nestjs/config';

/** Longueur minimale acceptée pour le secret de signature des jetons. */
const LONGUEUR_MINIMALE = 32;

/**
 * Valeurs qui ont figuré en dur dans le code, donc publiées dans l'historique Git.
 *
 * Elles sont refusées quelle que soit leur longueur : la phrase « change_in_production »
 * fait 46 caractères et passait le contrôle de longueur, tout en étant connue de
 * quiconque a accès au dépôt.
 */
const VALEURS_COMPROMISES = new Set([
  'secret',
  'your_super_secret_jwt_key_change_in_production',
  // Ancien exemple de `.env.example` pour JWT_REFRESH_SECRET : publié dans le dépôt.
  'your_super_secret_refresh_key_change_in_production',
  'changeme',
  'default',
]);

/**
 * Secret de signature des jetons, ou refus de démarrer.
 *
 * Chaque module d'authentification lisait `JWT_SECRET` avec une valeur de repli :
 * `'secret'` dans la super-app, `'your_super_secret_jwt_key_change_in_production'`
 * dans l'app école. Le refresh token retombait de même sur `'secret'`
 * (`JWT_REFRESH_SECRET`). Une variable oubliée en production ne provoquait
 * donc aucune erreur : les services signaient avec une chaîne publique.
 *
 * Il n'existe pas de repli sûr pour un secret de signature. Mieux vaut un service
 * qui refuse de démarrer qu'un service qui démarre en acceptant de faux jetons.
 */
function secretDeSignatureRequis(
  config: ConfigService,
  variable: 'JWT_SECRET' | 'JWT_REFRESH_SECRET',
): string {
  const secret = config.get<string>(variable);

  if (!secret) {
    throw new Error(
      `${variable} est requis : aucun service ne peut démarrer sans secret de signature.`,
    );
  }

  if (VALEURS_COMPROMISES.has(secret)) {
    throw new Error(
      `${variable} reprend une valeur compromise, présente dans le code source : en générer une nouvelle.`,
    );
  }

  if (secret.length < LONGUEUR_MINIMALE) {
    throw new Error(
      `${variable} est trop court (${secret.length} caractères, minimum ${LONGUEUR_MINIMALE}).`,
    );
  }

  return secret;
}

/** Secret HMAC des jetons d'accès. Aucun repli. */
export function jwtSecretRequis(config: ConfigService): string {
  return secretDeSignatureRequis(config, 'JWT_SECRET');
}

/**
 * Secret HMAC des refresh tokens, distinct de `JWT_SECRET`.
 * Aucun repli : l'ancienne valeur `'secret'` est refusée.
 */
export function jwtRefreshSecretRequis(config: ConfigService): string {
  return secretDeSignatureRequis(config, 'JWT_REFRESH_SECRET');
}

/**
 * Contrôle de démarrage du module qui émet les sessions (super-app).
 * Les deux secrets sont obligatoires. La valeur renvoyée est celle des
 * jetons d'accès, attendue par `JwtModule`.
 */
export function secretsJwtAuDemarrage(config: ConfigService): string {
  jwtRefreshSecretRequis(config);
  return jwtSecretRequis(config);
}
