import { SetMetadata } from '@nestjs/common';
import type { SchoolFeature } from '../constants/school-features';

export const REQUIRE_FEATURE_KEY = 'requireFeature';

/**
 * Décorateur @RequireFeature – restreint l'accès à une fonctionnalité
 * activée pour l'école du directeur connecté (voir `Organisation.allowedFeatures`
 * et `FeaturesGuard`). Sans effet pour un utilisateur dont `allowedFeatures`
 * est `null` (aucune restriction).
 *
 * Accepte plusieurs clés (logique OU) : certains endpoints ne servent pas
 * qu'une seule page school-web — ex. `GET /children` est utilisé par la page
 * "Élèves" (feature `children`) mais aussi par "Affecter Élèves" pour lister
 * les élèves à affecter (feature `affectation`). Sans le OU, une école avec
 * `affectation` mais pas `children` casserait sur cet appel malgré une
 * permission explicitement accordée par le Super Admin.
 * @example @RequireFeature('cars')
 * @example @RequireFeature('children', 'affectation')
 */
export const RequireFeature = (...features: SchoolFeature[]) => SetMetadata(REQUIRE_FEATURE_KEY, features);
