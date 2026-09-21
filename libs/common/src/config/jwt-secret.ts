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
  'changeme',
  'default',
]);

/**
 * Secret de signature des jetons, ou refus de démarrer.
 *
 * Chaque module d'authentification lisait `JWT_SECRET` avec une valeur de repli :
 * `'secret'` dans la super-app, `'your_super_secret_jwt_key_change_in_production'`
 * dans l'app école. Une variable d'environnement oubliée en production ne
 * provoquait donc aucune erreur : les services signaient les jetons avec une
 * chaîne publique, connue de quiconque lit ce dépôt — il suffisait de forger un
 * jeton `SUPER_ADMIN` pour prendre la main sur toutes les écoles.
 *
 * Il n'existe pas de repli sûr pour un secret de signature. Mieux vaut un service
 * qui refuse de démarrer qu'un service qui démarre en acceptant de faux jetons.
 */
export function jwtSecretRequis(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');

  if (!secret) {
    throw new Error(
      'JWT_SECRET est requis : aucun service ne peut démarrer sans secret de signature.',
    );
  }

  if (VALEURS_COMPROMISES.has(secret)) {
    throw new Error(
      'JWT_SECRET reprend une valeur compromise, présente dans le code source : en générer une nouvelle.',
    );
  }

  if (secret.length < LONGUEUR_MINIMALE) {
    throw new Error(
      `JWT_SECRET est trop court (${secret.length} caractères, minimum ${LONGUEUR_MINIMALE}).`,
    );
  }

  return secret;
}
