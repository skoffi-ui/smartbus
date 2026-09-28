import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature.decorator';
import { SCHOOL_FEATURE_LABELS, type SchoolFeature } from '../constants/school-features';

/**
 * Guard Features – vérifie que l'école du directeur connecté a accès à la
 * fonctionnalité requise. Doit être utilisé après `JwtAuthGuard` (a besoin de
 * `request.user`).
 *
 * `user.allowedFeatures` vient du JWT (voir `AuthService.generateTokens` et
 * `apps/school-app/src/modules/auth/jwt.strategy.ts`) : `null`/absent = pas
 * de restriction pour cette école (comportement historique, toutes les
 * écoles créées avant ce système). Un tableau = liste blanche des clés
 * autorisées.
 *
 * `@RequireFeature` peut lister plusieurs clés (OU) : l'accès est autorisé
 * dès que l'école a AU MOINS UNE des fonctionnalités listées.
 */
@Injectable()
export class FeaturesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFeatures = this.reflector.getAllAndOverride<SchoolFeature[] | undefined>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeatures || requiredFeatures.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const allowedFeatures: string[] | null | undefined = user?.allowedFeatures;

    if (!allowedFeatures) {
      return true;
    }

    if (!requiredFeatures.some((f) => allowedFeatures.includes(f))) {
      const labels = requiredFeatures.map((f) => SCHOOL_FEATURE_LABELS[f]).join(' / ');
      throw new ForbiddenException(
        `Cette fonctionnalité (${labels}) n'est pas activée pour votre école.`,
      );
    }

    return true;
  }
}
