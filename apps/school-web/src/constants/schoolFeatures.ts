/**
 * Copie frontend de `libs/common/src/constants/school-features.ts` (les apps
 * Vite ne peuvent pas importer `@app/common`, une lib NestJS). Garder les
 * deux listes synchronisées.
 */
export const SCHOOL_FEATURES = [
  'live',
  'cars',
  'drivers',
  'parents',
  'children',
  'courses',
  'trajets',
  'affectation',
  'suivi',
  'alertes',
  'centre-alertes',
  'settings',
] as const;

export type SchoolFeature = (typeof SCHOOL_FEATURES)[number];

/**
 * Lit `allowedFeatures` depuis le JWT stocké (même motif de décodage déjà
 * utilisé dans Dashboard.tsx/Settings.tsx/CentreAlertes.tsx). `null`/absent =
 * aucune restriction (école non configurée par le Super Admin, ou jeton
 * antérieur à ce système).
 */
export function mesFeaturesAutorisees(): string[] | null {
  try {
    const jeton = localStorage.getItem('accessToken');
    if (!jeton) return null;
    const contenu = JSON.parse(atob(jeton.split('.')[1]));
    return Array.isArray(contenu.allowedFeatures) ? contenu.allowedFeatures : null;
  } catch {
    return null;
  }
}

export function aAcces(feature: SchoolFeature): boolean {
  const autorisees = mesFeaturesAutorisees();
  return !autorisees || autorisees.includes(feature);
}

/** Contenu utile du jeton décodé, sans validation de signature (juste de la lecture côté UI). */
function contenuJeton(): any | null {
  try {
    const jeton = localStorage.getItem('accessToken');
    if (!jeton) return null;
    return JSON.parse(atob(jeton.split('.')[1]));
  } catch {
    return null;
  }
}

/** `organisationId` du compte connecté, ou `null` s'il n'a pas encore d'école. */
export function monOrganisationId(): string | null {
  return contenuJeton()?.organisationId ?? null;
}

/**
 * Cette école peut-elle créer des comptes directeur supplémentaires ?
 * Affichage seulement (voir Layout.tsx) — la vérification réelle se fait
 * côté serveur, toujours relue en base (voir UsersService).
 */
export function peutGererEquipe(): boolean {
  return contenuJeton()?.allowAdditionalDirectors === true;
}
