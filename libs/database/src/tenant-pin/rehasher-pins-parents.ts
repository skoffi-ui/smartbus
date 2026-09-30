import {
  estHashBcrypt,
  hasherPinParent,
} from '../../../common/src/security/parent-pin';

/**
 * Re-hashe les PIN parents encore en clair (bcrypt, coût 12) sans les
 * invalider : le parent garde le même code, seule la colonne change.
 * Les valeurs déjà au format bcrypt sont laissées telles quelles, pour
 * qu'une reprise après échec ne les hashe pas une seconde fois.
 *
 * Hors du dossier des migrations : TypeORM instancie chaque export d'un
 * fichier chargé par le glob, et cette fonction n'est pas une classe.
 */
export async function rehasherPinsParents(
  query: (sql: string, parameters?: unknown[]) => Promise<unknown>,
): Promise<number> {
  const brut = await query(
    `SELECT "id", "pin_code" FROM "parents" WHERE "pin_code" IS NOT NULL AND "pin_code" <> ''`,
  );
  const lignes = Array.isArray(brut)
    ? (brut as Array<{ id: string; pin_code: string }>)
    : [];
  let rehashes = 0;

  for (const ligne of lignes) {
    if (!ligne?.pin_code || estHashBcrypt(ligne.pin_code)) continue;
    const hash = await hasherPinParent(ligne.pin_code);
    await query(
      `UPDATE "parents" SET "pin_code" = $1, "updated_at" = now() WHERE "id" = $2`,
      [hash, ligne.id],
    );
    rehashes++;
  }

  return rehashes;
}
