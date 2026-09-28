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
 * Cœur du chiffrement AES-256-GCM, sans dépendance à l'injection de
 * dépendances Nest — utilisable aussi bien depuis `CryptoService` (contextes
 * avec DI, où la valeur brute vient de `ConfigService.get('ENCRYPTION_KEY')`)
 * que depuis un `ValueTransformer` TypeORM posé directement sur une colonne
 * d'entité (contexte sans DI : TypeORM instancie les transformers lui-même,
 * en dehors du conteneur Nest — la valeur brute y vient alors directement de
 * `process.env.ENCRYPTION_KEY`, équivalent en pratique puisque
 * `ConfigModule.forRoot({ envFilePath: [...] })` fusionne déjà `.env` dans
 * `process.env` au démarrage).
 *
 * Prend la valeur brute déjà lue (jamais la source elle-même) : ça reste une
 * fonction pure, testable sans mock d'environnement ni de `ConfigService`.
 */
export function validerEtConvertirCle(brut: string | undefined, nomVariable = 'ENCRYPTION_KEY'): Buffer {
  if (!brut) {
    throw new Error(
      `${nomVariable} est absente : impossible de chiffrer ou déchiffrer un secret. ` +
        'Générez-la avec `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"`.',
    );
  }

  let cle: Buffer;
  try {
    cle = Buffer.from(brut.trim(), 'hex');
  } catch {
    throw new Error(`${nomVariable} doit être une chaîne hexadécimale.`);
  }

  if (cle.length !== LONGUEUR_CLE) {
    throw new Error(
      `${nomVariable} doit faire ${LONGUEUR_CLE} octets (${LONGUEUR_CLE * 2} caractères hexadécimaux), ` +
        `or elle en fait ${cle.length}.`,
    );
  }

  return cle;
}

/** Repli pour les contextes sans DI (ex. `ValueTransformer` TypeORM) : lit `process.env` directement. */
export function obtenirCleChiffrementDepuisEnv(nomVariable = 'ENCRYPTION_KEY'): Buffer {
  return validerEtConvertirCle(process.env[nomVariable], nomVariable);
}

export function chiffrerAvecCle(valeurEnClair: string, cle: Buffer): SecretChiffre {
  const iv = crypto.randomBytes(LONGUEUR_IV);
  const chiffreur = crypto.createCipheriv(ALGORITHME, cle, iv);
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

export function dechiffrerAvecCle(secret: SecretChiffre, cle: Buffer): string {
  const dechiffreur = crypto.createDecipheriv(ALGORITHME, cle, Buffer.from(secret.iv, 'base64'));
  dechiffreur.setAuthTag(Buffer.from(secret.tag, 'base64'));

  return Buffer.concat([
    dechiffreur.update(Buffer.from(secret.ciphertext, 'base64')),
    dechiffreur.final(),
  ]).toString('utf8');
}

/**
 * Emballe un `SecretChiffre` dans une seule chaîne (JSON), pour une colonne
 * texte unique — utilisé par `OrganisationDbPasswordTransformer`, où
 * `Organisation.dbPassword` reste une seule colonne `text` plutôt que 3
 * colonnes séparées (contrairement à `BiotimeConfig.password*`).
 */
export function emballerSecret(secret: SecretChiffre): string {
  return JSON.stringify(secret);
}

/** Inverse de `emballerSecret`. `null` si la valeur n'est pas un secret emballé valide. */
export function deballerSecret(valeur: string): SecretChiffre | null {
  try {
    const objet = JSON.parse(valeur);
    if (typeof objet?.ciphertext === 'string' && typeof objet?.iv === 'string' && typeof objet?.tag === 'string') {
      return objet;
    }
    return null;
  } catch {
    return null;
  }
}
