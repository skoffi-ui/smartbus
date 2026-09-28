/**
 * Fonctionnalités school-web activables/désactivables par école, assignées
 * par le Super Admin (voir `Organisation.allowedFeatures`). Une clé par
 * entrée de menu de `apps/school-web/src/components/Layout.tsx`, à
 * l'exception du tableau de bord — toujours accessible une fois connecté.
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

/** Libellés FR pour l'UI Super Admin (case à cocher par fonctionnalité). */
export const SCHOOL_FEATURE_LABELS: Record<SchoolFeature, string> = {
  live: 'Live Tracking',
  cars: 'Flotte (Bus)',
  drivers: 'Chauffeurs',
  parents: 'Parents',
  children: 'Élèves',
  courses: 'Courses',
  trajets: 'Trajets',
  affectation: 'Affectation des élèves',
  suivi: 'Suivi des montées',
  alertes: 'Alertes',
  'centre-alertes': "Centre d'Alertes",
  settings: 'Paramètres',
};

export function isSchoolFeature(value: string): value is SchoolFeature {
  return (SCHOOL_FEATURES as readonly string[]).includes(value);
}
