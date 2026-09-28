import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SecretChiffre,
  validerEtConvertirCle,
  chiffrerAvecCle,
  dechiffrerAvecCle,
} from './secret-crypto.util';

export { SecretChiffre };

/**
 * Chiffrement des secrets tiers stockés en base (identifiants BioTime, clés d'API
 * d'appareils, etc.).
 *
 * AES-256-GCM : en plus de chiffrer, le mode GCM authentifie le message. Une ligne
 * altérée en base est détectée au déchiffrement au lieu de produire une valeur
 * silencieusement fausse.
 *
 * La clé vient de `ENCRYPTION_KEY` (64 caractères hexadécimaux = 32 octets). Elle
 * n'est jamais lue au démarrage mais à la première utilisation, pour qu'une
 * instance qui ne manipule aucun secret puisse démarrer sans elle.
 *
 * Le chiffrement lui-même vit dans `secret-crypto.util` (fonctions pures, sans
 * injection de dépendances) : c'est ce même utilitaire qu'utilise le
 * `ValueTransformer` de `Organisation.dbPassword`, qui ne peut pas passer par
 * l'injection Nest (TypeORM instancie les transformers lui-même).
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private cle: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  private obtenirCle(): Buffer {
    if (this.cle) return this.cle;
    try {
      this.cle = validerEtConvertirCle(this.config.get<string>('ENCRYPTION_KEY'));
    } catch (err: any) {
      throw new InternalServerErrorException(err.message);
    }
    return this.cle;
  }

  /** Indique si un secret peut être chiffré, sans lever d'exception. */
  estConfigure(): boolean {
    try {
      this.obtenirCle();
      return true;
    } catch {
      return false;
    }
  }

  chiffrer(valeurEnClair: string): SecretChiffre {
    return chiffrerAvecCle(valeurEnClair, this.obtenirCle());
  }

  dechiffrer(secret: SecretChiffre): string {
    try {
      return dechiffrerAvecCle(secret, this.obtenirCle());
    } catch (err: any) {
      // Cas typiques : ENCRYPTION_KEY changée, ou ligne altérée en base.
      this.logger.error(`Déchiffrement impossible : ${err.message}`);
      throw new InternalServerErrorException(
        'Secret illisible : la clé de chiffrement a changé ou la donnée est corrompue.',
      );
    }
  }
}
