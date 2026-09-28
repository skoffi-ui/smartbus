import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { jwtSecretRequis } from '@app/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecretRequis(configService),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    // Le payload correspond au contenu déchiffré du JWT.
    // Il contient typiquement: sub (userId), email, role, organisationId, et
    // allowedFeatures (permissions par école, voir FeaturesGuard).
    //
    // `allowedFeatures` embarqué dans le JWT n'est qu'un instantané pris à
    // l'émission du jeton (jusqu'à 7 jours) : un compte déjà connecté quand le
    // Super Admin modifie les permissions d'une école garderait sinon l'ancien
    // accès jusqu'à expiration. La gateway relit ces permissions à chaque
    // requête (voir TenantGateService, TTL 15s) et les pose dans l'en-tête de
    // confiance `x-allowed-features` (jamais accepté depuis l'extérieur, voir
    // TRUSTED_HEADERS côté gateway) — on le préfère donc au payload du JWT.
    // Le payload reste le repli pour un appel direct à school-app sans passer
    // par la gateway (tests, dev local).
    const enTeteFeatures = req.headers['x-allowed-features'];
    let allowedFeatures = payload.allowedFeatures;
    if (typeof enTeteFeatures === 'string') {
      try {
        allowedFeatures = JSON.parse(enTeteFeatures);
      } catch {
        // En-tête corrompu (ne devrait jamais arriver, posé uniquement par la
        // gateway) : on retombe sur le payload du JWT plutôt que de planter.
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      organisationId: payload.organisationId,
      allowedFeatures,
    };
  }
}
