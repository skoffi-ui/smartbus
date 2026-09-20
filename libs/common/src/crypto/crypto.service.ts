import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/** Secret chiffré au repos : le texte, son vecteur d'initialisation et son sceau d'intégrité. */
export interface SecretChiffre {
  ciphertext: string;
  iv: string;
  tag: string;
}

const ALGORITHME = 'aes-256-gcm';
const LONGUEUR_IV = 12; // recommandation GCM
const LONGUEUR_CLE = 32; // AES-256

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
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private cle: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  private obtenirCle(): Buffer {
    if (this.cle) return this.cle;

    const brut = this.config.get<string>('ENCRYPTION_KEY');
    if (!brut) {
      throw new InternalServerErrorException(
        "ENCRYPTION_KEY est absente : impossible de chiffrer ou déchiffrer un secret. " +
          'Générez-la avec `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"`.',
      );
    }

    let cle: Buffer;
    try {
      cle = Buffer.from(brut.trim(), 'hex');
    } catch {
      throw new InternalServerErrorException('ENCRYPTION_KEY doit être une chaîne hexadécimale.');
    }

    if (cle.length !== LONGUEUR_CLE) {
      throw new InternalServerErrorException(
        `ENCRYPTION_KEY doit faire ${LONGUEUR_CLE} octets (${LONGUEUR_CLE * 2} caractères hexadécimaux), ` +
          `or elle en fait ${cle.length}.`,
      );
    }

    this.cle = cle;
    return cle;
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
    const iv = crypto.randomBytes(LONGUEUR_IV);
    const chiffreur = crypto.createCipheriv(ALGORITHME, this.obtenirCle(), iv);
    const ciphertext = Buffer.concat([
      chiffreur.update(valeurEnClair, 'utf8'),
      chiffreur.final(),
    ]);

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: chiffreur.getAuthTag().toString('base64'),
    };
  }

  dechiffrer(secret: SecretChiffre): string {
    try {
      const dechiffreur = crypto.createDecipheriv(
        ALGORITHME,
        this.obtenirCle(),
        Buffer.from(secret.iv, 'base64'),
      );
      dechiffreur.setAuthTag(Buffer.from(secret.tag, 'base64'));

      return Buffer.concat([
        dechiffreur.update(Buffer.from(secret.ciphertext, 'base64')),
        dechiffreur.final(),
      ]).toString('utf8');
    } catch (err: any) {
      // Cas typiques : ENCRYPTION_KEY changée, ou ligne altérée en base.
      this.logger.error(`Déchiffrement impossible : ${err.message}`);
      throw new InternalServerErrorException(
        'Secret illisible : la clé de chiffrement a changé ou la donnée est corrompue.',
      );
    }
  }
}
