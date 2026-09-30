import { ConfigService } from '@nestjs/config';

/** Durée par défaut du jeton parent : 12 h, au lieu des 7 jours de `JWT_EXPIRES_IN`. */
export const DUREE_JETON_PARENT_DEFAUT = '12h';

export const ETAPES_VERROU_PIN_DEFAUT = '60,300,900,3600';

export function entierPositif(
  config: ConfigService,
  cle: string,
  defaut: number,
): number {
  const brut = config.get<string | number | undefined>(cle);
  if (brut === undefined || brut === null || brut === '') return defaut;
  const n = typeof brut === 'number' ? brut : parseInt(String(brut), 10);
  if (!Number.isFinite(n) || n <= 0) return defaut;
  return n;
}

/**
 * Durée du jeton parent. Volontairement distincte de `JWT_EXPIRES_IN`
 * (comptes école, 7 jours) : un oubli de variable ne doit pas rallonger
 * la session parent. Le renouvellement est une nouvelle connexion — ce
 * correctif ne change pas les claims du jeton et n'ajoute pas de refresh.
 */
export function dureeJetonParent(config: ConfigService): string {
  const valeur = config.get<string>('PARENT_JWT_EXPIRES_IN');
  if (typeof valeur === 'string' && valeur.trim().length > 0)
    return valeur.trim();
  return DUREE_JETON_PARENT_DEFAUT;
}

/** Durées de verrouillage progressif, en millisecondes, après chaque série d'échecs. */
export function dureesVerrouPinMs(config: ConfigService): number[] {
  const brut = config.get<string>(
    'PARENT_PIN_LOCK_STEPS_SEC',
    ETAPES_VERROU_PIN_DEFAUT,
  );
  const secondes = String(brut)
    .split(',')
    .map((partie) => parseInt(partie.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const retenues = secondes.length > 0 ? secondes : [60, 300, 900, 3600];
  return retenues.map((s) => s * 1000);
}

/** Clé de verrouillage : école + identifiant, insensible à la casse et aux espaces. */
export function cleCompteParent(
  schoolCode: string,
  emailOrPhone: string,
): string {
  return `${schoolCode.trim().toUpperCase()}|${emailOrPhone.trim().toLowerCase()}`;
}

function texteCorps(valeur: unknown): string {
  if (typeof valeur === 'string') return valeur;
  if (typeof valeur === 'number' || typeof valeur === 'boolean')
    return String(valeur);
  return '';
}

export function cleIdentifiantDepuisRequete(req: {
  body?: Record<string, unknown>;
}): string {
  const body = req.body ?? {};
  return cleCompteParent(
    texteCorps(body.schoolCode),
    texteCorps(body.emailOrPhone),
  );
}

/**
 * Dernier saut de `X-Forwarded-For` : la gateway (`xfwd`) ajoute l'adresse
 * réelle du client en fin de liste. Le premier saut est celui que le client
 * peut forger.
 */
export function extraireIpClient(req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  const header = req.headers?.['x-forwarded-for'];
  const brut = Array.isArray(header) ? header.join(',') : header;
  if (typeof brut === 'string' && brut.trim()) {
    const sauts = brut
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const dernier = sauts[sauts.length - 1];
    if (dernier) return dernier;
  }
  return req.ip || req.socket?.remoteAddress || 'inconnu';
}
