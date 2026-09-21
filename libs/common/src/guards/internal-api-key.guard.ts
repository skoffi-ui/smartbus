import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/** En-tête portant le secret partagé entre services. */
export const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

/**
 * Authentifie un appel de service à service.
 *
 * Certaines routes ne sont appelées par aucun utilisateur mais par un autre
 * service de la plateforme (la SUPER APP qui relaie un pointage vers l'APP
 * école, par exemple). Elles ne peuvent donc pas exiger de JWT — ce qui les
 * laissait totalement ouvertes : n'importe qui pouvait injecter de fausses
 * notifications aux parents.
 *
 * La comparaison est faite en temps constant pour ne pas permettre de deviner
 * le secret octet par octet.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const attendu = this.config.get<string>('INTERNAL_API_KEY');
    if (!attendu) {
      // Refuser plutôt que laisser passer : une variable oubliée ne doit pas
      // rouvrir silencieusement la route.
      this.logger.error('INTERNAL_API_KEY absente : appel interne refusé.');
      throw new InternalServerErrorException(
        "Secret d'appel interne non configuré sur ce service.",
      );
    }

    const requete = context.switchToHttp().getRequest();
    const fourni = requete?.headers?.[INTERNAL_API_KEY_HEADER];

    if (typeof fourni !== 'string' || !this.egal(fourni, attendu)) {
      this.logger.warn("Appel interne refusé : secret absent ou invalide.");
      throw new UnauthorizedException('Appel interne non autorisé.');
    }

    return true;
  }

  private egal(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  }
}
