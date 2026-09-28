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
  // Les deux alimentent le même écran school-web (« Centre d'Alertes ») —
  // activables indépendamment : proximité (bénin) et anomalies critiques
  // n'ont pas le même niveau de gravité ni le même besoin.
  alertes: "Alertes de proximité (dans Centre d'Alertes)",
  'centre-alertes': "Anomalies critiques (Centre d'Alertes)",
  settings: 'Paramètres',
};
