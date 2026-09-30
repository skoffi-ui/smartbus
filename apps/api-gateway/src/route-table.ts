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
  'plan-tarifs',
  'billing',
  'payments',
  'provisioning',
  'metadata',
  'devices',
  'stats',
  'biotime',
  'hardware',
  'parent',
  // BiotimeAdminController vit sous `admin/biotime/...` (apps/super-app/src/modules/biotime/
  // biotime-admin.controller.ts) — sans cette entrée, tout /admin/biotime/* renvoyait 404
  // à travers la gateway (le premier segment de chemin est "admin", pas "biotime") : la
  // page "Gestion BioTime Centralisée" de super-admin-web était donc inaccessible en
  // pratique. Seul ce contrôleur utilise ce préfixe aujourd'hui, entièrement côté super-app.
  'admin',
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
  // Aucun compte n'existe encore à ce stade — voir AuthController.candidatureDirecteur.
  // Ne crée qu'un compte PENDING, sans jeton ni école : pas le risque d'abus
  // qu'avait l'ancien /auth/register-school (qui provisionnait une base
  // complète sans authentification), retiré du public pour cette raison.
  'POST auth/candidature-directeur',
  // 'POST auth/creer-mon-ecole' : PAS public — réservé à un directeur déjà
  // authentifié et activé (voir AuthController.creerMonEcole).
  'POST auth/refresh',
  'POST auth/forgot-password',
  'POST auth/reset-password',
  // Un collaborateur n'a encore aucun compte à ce stade — protégé par le
  // jeton d'invitation lui-même (voir AuthController.rejoindreEcole), pas par le JWT.
  'POST auth/rejoindre-ecole',
  'POST auth/parent/login',
  // Pas de JWT utilisateur : l'appelant est le prestataire de paiement.
  // L'authenticité est vérifiée dans la super-app (PaymentWebhookGuard,
  // en-tête x-cinetpay-webhook-secret / CINETPAY_WEBHOOK_SECRET).
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
