import { ValueTransformer } from 'typeorm';
import {
  obtenirCleChiffrementDepuisEnv,
  chiffrerAvecCle,
  dechiffrerAvecCle,
  emballerSecret,
  deballerSecret,
} from '@app/common/crypto/secret-crypto.util';

/**
 * Chiffre `Organisation.dbPassword` au repos (AES-256-GCM, via
 * `secret-crypto.util` — le même cœur que `CryptoService`, mais accessible
 * sans injection de dépendances : TypeORM instancie les transformers
 * lui-même, hors du conteneur Nest).
 *
 * Avant ce transformer, ce mot de passe (celui qui ouvre la connexion
 * Postgres de CHAQUE école, et qui vaut aujourd'hui le mot de passe
 * applicatif central lui-même — voir `ProvisioningService.provisionOrganisation`)
 * était stocké tel quel dans `organisations.db_password`.
 *
 * `from()` reste tolérant sur une valeur non emballée (chaîne qui n'est pas
 * un `SecretChiffre` JSON valide) : la renvoie inchangée plutôt que de lever
 * une exception qui casserait toute lecture d'`Organisation` touchant cette
 * colonne. Ce cas correspond à une ligne pas encore rechiffrée par la
 * migration `EncryptOrganisationDbPassword` — jamais censé arriver après son
 * exécution, mais mieux vaut une valeur affichée que toute l'app en panne.
 */
export const OrganisationDbPasswordTransformer: ValueTransformer = {
  to(valeurEnClair: string | null | undefined): string | null | undefined {
    if (valeurEnClair === null || valeurEnClair === undefined) return valeurEnClair;
    const cle = obtenirCleChiffrementDepuisEnv();
    return emballerSecret(chiffrerAvecCle(valeurEnClair, cle));
  },

  from(valeurStockee: string | null | undefined): string | null | undefined {
    if (valeurStockee === null || valeurStockee === undefined) return valeurStockee;
    const secret = deballerSecret(valeurStockee);
    if (!secret) return valeurStockee; // legacy non chiffré, ou données inattendues
    const cle = obtenirCleChiffrementDepuisEnv();
    return dechiffrerAvecCle(secret, cle);
  },
};
