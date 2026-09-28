import axios, { AxiosError } from 'axios';
import { GATEWAY_URL } from '../config';

export const API_BASE_URL = `${GATEWAY_URL}/api/v1`;

/** Codes d'erreur émis par l'API Gateway (voir apps/api-gateway/src/route-table.ts). */
export type GatewayErrorCode =
  | 'TOKEN_MISSING'
  | 'TOKEN_INVALID'
  | 'NO_ORGANISATION'
  | 'TENANT_SUSPENDED'
  | 'TENANT_INACTIVE'
  | 'TENANT_NOT_FOUND'
  | 'APP_UPDATE_REQUIRED'
  | 'ROUTE_NOT_FOUND'
  | 'UPSTREAM_UNAVAILABLE';

/** Raison d'un blocage d'accès, lue par la page /acces-bloque. */
export const BLOCK_REASON_KEY = 'smartbus:blocage';

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function logout(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  if (window.location.pathname !== '/login') window.location.href = '/login';
}

/**
 * Rafraîchissement automatique du jeton.
 *
 * Sans ça, un jeton d'accès reste valable 7 jours (JWT_EXPIRES_IN) sans
 * jamais être renouvelé : un changement de permissions par le Super Admin
 * (voir Organisation.allowedFeatures) n'était donc visible qu'après une
 * déconnexion/reconnexion complète, puisque `generateTokens()` ne relit les
 * permissions à jour qu'à l'émission d'un nouveau jeton.
 *
 * `refreshingPromise` : si plusieurs requêtes échouent en même temps (cas
 * fréquent : une page qui charge plusieurs endpoints en parallèle), une
 * seule d'entre elles déclenche l'appel à /auth/refresh — les autres
 * attendent son résultat au lieu de rafraîchir chacune de leur côté.
 */
let refreshingPromise: Promise<string> | null = null;

function decoderUserId(accessToken: string): string | null {
  try {
    return JSON.parse(atob(accessToken.split('.')[1])).sub ?? null;
  } catch {
    return null;
  }
}

async function rafraichirJeton(): Promise<string> {
  const accessTokenActuel = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  const userId = accessTokenActuel ? decoderUserId(accessTokenActuel) : null;

  if (!refreshToken || !userId) {
    throw new Error('Pas de jeton de rafraîchissement disponible.');
  }

  // `axios` brut, pas `api` : éviter de redéclencher cet intercepteur en boucle.
  const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { userId, refreshToken });
  localStorage.setItem('accessToken', response.data.accessToken);
  localStorage.setItem('refreshToken', response.data.refreshToken);
  return response.data.accessToken;
}

/**
 * Le jeton de rafraîchissement est à usage unique côté serveur (rotation, voir
 * AuthService.refreshTokens) : si deux onglets l'envoient à quelques millisecondes
 * d'écart (ex. l'un et l'autre rouverts/rechargés en même temps, voir App.tsx),
 * le premier réussit et invalide le second, qui se fait alors déconnecter à tort.
 *
 * Web Locks API : verrou réel, partagé par tous les onglets de la même origine.
 * Un seul onglet à la fois exécute `rafraichirJeton()` ; les autres attendent
 * leur tour puis relisent directement le jeton déjà rafraîchi en localStorage
 * au lieu de renvoyer, eux aussi, l'ancien refreshToken désormais invalide.
 */
async function rafraichirAvecVerrouInterOnglets(): Promise<string> {
  const accessTokenAvant = localStorage.getItem('accessToken');

  const executer = async (): Promise<string> => {
    const actuel = localStorage.getItem('accessToken');
    if (actuel && actuel !== accessTokenAvant) return actuel; // un autre onglet vient de le faire
    return rafraichirJeton();
  };

  // Repli pour un navigateur trop ancien pour Web Locks : dédoublonnage dans
  // l'onglet uniquement (comportement précédent), risque résiduel entre onglets.
  if (typeof navigator === 'undefined' || !('locks' in navigator)) {
    return executer();
  }
  return navigator.locks.request('smartbus:jeton-refresh', executer);
}

/**
 * Version dédupliquée de `rafraichirJeton` : partage `refreshingPromise` avec
 * l'intercepteur ci-dessous pour qu'un rafraîchissement déclenché au chargement
 * de l'appli (voir `App.tsx`) et un autre déclenché par une requête en échec au
 * même moment n'appellent `/auth/refresh` qu'une seule fois DANS l'onglet ;
 * `rafraichirAvecVerrouInterOnglets` couvre le cas ENTRE onglets.
 */
export async function rafraichirJetonDedupe(): Promise<string> {
  refreshingPromise ??= rafraichirAvecVerrouInterOnglets().finally(() => { refreshingPromise = null; });
  return refreshingPromise;
}

function block(code: GatewayErrorCode, message: string): void {
  try {
    sessionStorage.setItem(BLOCK_REASON_KEY, JSON.stringify({ code, message }));
  } catch {
    // Mode navigation privée : la page affichera son message par défaut.
  }
  if (window.location.pathname !== '/acces-bloque') {
    window.location.href = '/acces-bloque';
  }
}

/**
 * Message affichable par les pages. Les réponses de la gateway portent un `code`
 * stable ; les autres erreurs retombent sur le message du service ou un défaut.
 */
export function messageFromError(error: unknown, fallback = 'Une erreur est survenue.'): string {
  const err = error as AxiosError<{ code?: string; message?: string }>;
  const data = err?.response?.data;

  if (!err?.response) {
    return "Le serveur est injoignable. Vérifiez votre connexion réseau.";
  }
  switch (data?.code) {
    case 'UPSTREAM_UNAVAILABLE':
      return 'Le service est momentanément indisponible. Réessayez dans un instant.';
    case 'ROUTE_NOT_FOUND':
      return "Cette fonctionnalité n'est pas disponible sur le serveur.";
    case 'NO_ORGANISATION':
      return "Aucune école n'est associée à votre compte.";
  }
  if (err.response.status === 503) {
    return data?.message || 'Service momentanément indisponible.';
  }
  return data?.message || err.message || fallback;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: GatewayErrorCode; message?: string }>) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const message = error.response?.data?.message;
    const requeteOriginale = error.config as (typeof error.config & { _dejaRejouee?: boolean }) | undefined;

    // Jeton expiré (401), ou fonctionnalité refusée (403 générique, sans code
    // gateway) : peut-être juste un jeton dont les permissions sont périmées
    // (voir rafraichirJeton ci-dessus) plutôt qu'un vrai refus. On tente un
    // rafraîchissement puis on rejoue la requête, une seule fois.
    const rafraichissable =
      (status === 401 || (status === 403 && !code)) &&
      requeteOriginale &&
      !requeteOriginale._dejaRejouee &&
      !!localStorage.getItem('refreshToken');

    if (rafraichissable) {
      requeteOriginale._dejaRejouee = true;
      try {
        const nouveauAccessToken = await rafraichirJetonDedupe();
        if (requeteOriginale.headers) {
          requeteOriginale.headers.Authorization = `Bearer ${nouveauAccessToken}`;
        }
        return api(requeteOriginale);
      } catch {
        // Le rafraîchissement a lui-même échoué (refresh token invalide/expiré) :
        // la session ne peut plus être sauvée, quel que soit le statut d'origine.
        logout();
        return Promise.reject(error);
      }
    }

    // Session invalide ou absente (pas de refresh possible, ou déjà tenté) :
    // retour à l'écran de connexion.
    if (status === 401) {
      logout();
    }

    // École suspendue ou non activée : on NE déconnecte pas. L'utilisateur doit
    // pouvoir lire la raison et régulariser son abonnement.
    else if (
      status === 403 &&
      (code === 'TENANT_SUSPENDED' || code === 'TENANT_INACTIVE' || code === 'TENANT_NOT_FOUND')
    ) {
      block(code, message || "L'accès à votre établissement est actuellement bloqué.");
    }

    // Version de l'application trop ancienne pour ce serveur.
    else if (status === 426) {
      block('APP_UPDATE_REQUIRED', message || 'Une mise à jour de l\'application est requise.');
    }

    return Promise.reject(error);
  },
);

export default api;
