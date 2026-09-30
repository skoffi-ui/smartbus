import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
  Type,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/** En-tête portant le secret partagé, envoyé par le logiciel tiers qui pousse le flux. */
export const DEVICE_STREAM_API_KEY_HEADER = 'x-device-api-key';
/** Repli pour les logiciels qui ne permettent pas de personnaliser les en-têtes sortants. */
export const DEVICE_STREAM_API_KEY_QUERY_PARAM = 'key';

/**
 * Authentifie un flux entrant de matériel tiers (GPSWOX, Traccar, ZKTeco/
 * Libellule, serveur BioTime) par secret partagé.
 *
 * `POST /hardware/stream`, `POST /hardware/traccar` et `POST /biotime/webhook`
 * étaient volontairement `@Public()` — n'importe qui connaissant un numéro de
 * série pouvait injecter un flux (position GPS ou pointage biométrique
 * falsifié). Ces appels viennent tous de logiciels tiers qu'on ne programme
 * pas (serveur Traccar, terminaux ZKTeco, forwarder Libellule, serveur
 * BioTime) : impossible de leur faire calculer une signature HMAC par
 * appareil, donc pas d'alternative réaliste au secret partagé — même
 * principe que `InternalApiKeyGuard`, ici paramétré par variable d'env pour
 * ne pas dupliquer trois fois la même classe (un secret distinct par type de
 * flux, pour limiter la casse si l'un fuit).
 *
 * Repli sur un paramètre de requête (`?key=...`) en plus de l'en-tête : tous
 * les logiciels concernés ne permettent pas de personnaliser un en-tête HTTP
 * sortant, mais tous permettent de configurer l'URL cible complète.
 *
 * Comparaison en temps constant pour ne pas permettre de deviner le secret
 * octet par octet.
 */
export function creerGardeCleFluxMateriel(
  nomVariableEnv: string,
): Type<CanActivate> {
  @Injectable()
  class DeviceStreamApiKeyGuard implements CanActivate {
    private readonly logger = new Logger(
      `DeviceStreamApiKeyGuard(${nomVariableEnv})`,
    );

    constructor(private readonly config: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
      const attendu = this.config.get<string>(nomVariableEnv);
      if (!attendu) {
        // Refuser plutôt que laisser passer : une variable oubliée ne doit
        // jamais rouvrir silencieusement la route.
        this.logger.error(`${nomVariableEnv} absente : flux refusé.`);
        throw new InternalServerErrorException(
          'Secret de flux matériel non configuré sur ce service.',
        );
      }

      const requete = context.switchToHttp().getRequest();
      const fourni =
        requete?.headers?.[DEVICE_STREAM_API_KEY_HEADER] ??
        requete?.query?.[DEVICE_STREAM_API_KEY_QUERY_PARAM];

      if (typeof fourni !== 'string' || !this.egal(fourni, attendu)) {
        this.logger.warn('Flux matériel refusé : secret absent ou invalide.');
        throw new UnauthorizedException('Flux matériel non autorisé.');
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

  return DeviceStreamApiKeyGuard;
}
