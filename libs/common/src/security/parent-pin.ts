import * as bcrypt from 'bcrypt';

/**
 * Même coût que les mots de passe utilisateurs dans `auth.service.ts`
 * (`bcrypt.hash(..., 12)`). Un PIN de 4 chiffres n'est supportable qu'avec
 * un hash lent : 10 000 combinaisons restent coûteuses à essayer.
 */
export const COUT_BCRYPT_PIN_PARENT = 12;

/**
 * Hash bcrypt (coût 12) d'une valeur qui n'est pas un PIN. Sert uniquement
 * à égaliser le temps de réponse quand le parent ou le hash est absent :
 * un refus « compte inconnu » ne doit pas revenir plus vite qu'un mauvais PIN.
 */
export const HASH_PIN_FACTICE =
  '$2b$12$3tGrKNgCzz8cuGbOsjOlMOnNsYordApUVbMDlV3Swmz7i2ONRHA02';

const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function estHashBcrypt(valeur: string | null | undefined): boolean {
  return typeof valeur === 'string' && BCRYPT_RE.test(valeur);
}

export async function hasherPinParent(pinClair: string): Promise<string> {
  return bcrypt.hash(pinClair, COUT_BCRYPT_PIN_PARENT);
}

/**
 * Comparaison bcrypt. Un PIN encore stocké en clair est refusé : la
 * migration tenant doit l'avoir re-hashé, sinon l'accès est perdu
 * (ADR 0013). Le temps de calcul reste celui d'un `bcrypt.compare`.
 */
export async function verifierPinParent(
  pinClair: string,
  stocke: string | null | undefined,
): Promise<boolean> {
  const hash = estHashBcrypt(stocke) ? (stocke as string) : HASH_PIN_FACTICE;
  try {
    const correspond = await bcrypt.compare(pinClair, hash);
    return estHashBcrypt(stocke) && correspond;
  } catch {
    return false;
  }
}
