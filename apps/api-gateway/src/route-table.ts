/**
 * Table de routage de l'API Gateway SMARTBUS.
 *
 * Chaque requête est associée à un service cible (super-app ou school-app) et à un
 * niveau d'accès. Toute route absente de cette table est refusée (404) : les endpoints
 * internes (ex: notifications/internal-webhook, montees/validation) ne sont donc jamais
 * exposés à l'extérieur.
 */

export type GatewayTarget = 'super' | 'school';

export interface ResolvedRoute {
  target: GatewayTarget;
  /** true = aucun JWT exigé (login, inscription, webhooks appareils) */
  isPublic: boolean;
}

const API_PREFIX = /^\/api\/v\d+\//;

/** Ressources servies par la SUPER APP (JWT exigé, sans contrôle de statut école). */
const SUPER_RESOURCES = new Set([
  'auth',
  'users',
  'organisations',
  'roles',
  'subscriptions',
  'billing',
  'payments',
  'provisioning',
  'metadata',
  'devices',
  'biotime',
  'hardware',
  'parent',
]);

/** Ressources servies par l'APP ÉCOLE (JWT + école active exigés). */
const SCHOOL_RESOURCES = new Set([
  'affectations',
  'alertes-critiques',
  'cars',
  'children',
  'courses',
  'drivers',
  'gps',
  'montees',
  'notifications',
  'parents',
  'ping',
  'points-recuperation',
  'trajets',
]);

/** Routes publiques : "METHODE resource/sous-chemin" (le préfixe /api/vN/ est retiré). */
const PUBLIC_ROUTES = new Set([
  'POST auth/login',
  'POST auth/register',
  'POST auth/register-school',
  'POST auth/refresh',
  'POST auth/forgot-password',
  'POST auth/reset-password',
  'POST auth/parent/login',
  'POST payments/webhook',
  // Ingestion depuis les appareils (badgeuse BioTime, trackers GPS)
  'POST biotime/webhook',
  'POST hardware/stream',
  'POST hardware/traccar',
]);

/** Routes internes jamais exposées par la gateway (appels de service à service). */
const BLOCKED_ROUTES = new Set([
  'POST notifications/internal-webhook',
  'POST montees/validation',
]);

export function resolveRoute(method: string, path: string): ResolvedRoute | null {
  if (!API_PREFIX.test(path)) return null;

  const relative = path.replace(API_PREFIX, '').split('?')[0].replace(/\/+$/, '');
  const resource = relative.split('/')[0];
  const key = `${method.toUpperCase()} ${relative}`;

  if (BLOCKED_ROUTES.has(key)) return null;

  if (SUPER_RESOURCES.has(resource)) {
    return { target: 'super', isPublic: PUBLIC_ROUTES.has(key) };
  }
  if (SCHOOL_RESOURCES.has(resource)) {
    return { target: 'school', isPublic: PUBLIC_ROUTES.has(key) };
  }
  return null;
}
