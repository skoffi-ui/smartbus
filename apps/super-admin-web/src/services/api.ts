import axios, { AxiosError } from 'axios';
import { GATEWAY_URL } from '../config';

export const API_BASE_URL = `${GATEWAY_URL}/api/v1`;

/**
 * Client unique de la console Super Admin.
 *
 * Toutes les requêtes passent par l'API Gateway : le jeton est ajouté ici, et les
 * codes d'erreur de la gateway sont traités en un seul endroit.
 */
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
 * Rafraîchissement automatique du jeton — sans ça, un jeton d'accès reste
 * valable 7 jours (JWT_EXPIRES_IN) sans jamais être renouvelé, ce qui forçait
 * une déconnexion/reconnexion manuelle pour obtenir un jeton à jour.
 *
 * `refreshingPromise` : si plusieurs requêtes échouent en même temps, une
 * seule déclenche l'appel à /auth/refresh — les autres attendent son résultat.
 */
let refreshingPromise: Promise<string> | null = null;

async function rafraichirJeton(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');

  if (!refreshToken) {
    throw new Error('Pas de jeton de rafraîchissement disponible.');
  }

  // `axios` brut, pas `api` : éviter de redéclencher cet intercepteur en boucle.
  // L'identifiant est dans le jeton vérifié côté serveur : le corps ne porte que le refresh token.
  const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
  localStorage.setItem('accessToken', response.data.accessToken);
  localStorage.setItem('refreshToken', response.data.refreshToken);
  return response.data.accessToken;
}

/**
 * Le jeton de rafraîchissement est à usage unique côté serveur (rotation) :
 * si deux onglets expirent en même temps et l'envoient tous les deux, le
 * premier réussit et invalide le second, qui se ferait alors déconnecter à
 * tort. Web Locks API : verrou réel partagé entre tous les onglets de la même
 * origine — un seul appelle vraiment /auth/refresh, les autres relisent le
 * jeton déjà rafraîchi en localStorage.
 */
async function rafraichirAvecVerrouInterOnglets(): Promise<string> {
  const accessTokenAvant = localStorage.getItem('accessToken');

  const executer = async (): Promise<string> => {
    const actuel = localStorage.getItem('accessToken');
    if (actuel && actuel !== accessTokenAvant) return actuel; // un autre onglet vient de le faire
    return rafraichirJeton();
  };

  if (typeof navigator === 'undefined' || !('locks' in navigator)) {
    return executer(); // repli navigateur ancien : dédoublonnage dans l'onglet seulement
  }
  return navigator.locks.request('smartbus:jeton-refresh', executer);
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string; message?: string }>) => {
    const status = error.response?.status;
    const requeteOriginale = error.config as (typeof error.config & { _dejaRejouee?: boolean }) | undefined;

    const rafraichissable =
      status === 401 &&
      requeteOriginale &&
      !requeteOriginale._dejaRejouee &&
      !!localStorage.getItem('refreshToken');

    if (rafraichissable) {
      requeteOriginale._dejaRejouee = true;
      try {
        refreshingPromise ??= rafraichirAvecVerrouInterOnglets().finally(() => { refreshingPromise = null; });
        const nouveauAccessToken = await refreshingPromise;
        if (requeteOriginale.headers) {
          requeteOriginale.headers.Authorization = `Bearer ${nouveauAccessToken}`;
        }
        return api(requeteOriginale);
      } catch {
        logout();
        return Promise.reject(error);
      }
    }

    if (status === 401) {
      logout();
    }
    return Promise.reject(error);
  },
);

/** Message affichable, en privilégiant les codes stables de la gateway. */
export function messageFromError(error: unknown, fallback = 'Une erreur est survenue.'): string {
  const err = error as AxiosError<{ code?: string; message?: string }>;
  const data = err?.response?.data;

  if (!err?.response) {
    return 'Le serveur est injoignable. Vérifiez votre connexion réseau.';
  }
  switch (data?.code) {
    case 'UPSTREAM_UNAVAILABLE':
      return 'Le service est momentanément indisponible. Réessayez dans un instant.';
    case 'ROUTE_NOT_FOUND':
      return "Cette fonctionnalité n'est pas disponible sur le serveur.";
    case 'APP_UPDATE_REQUIRED':
      return "Console obsolète : rechargez la page pour récupérer la dernière version.";
  }
  if (err.response.status === 403) {
    return data?.message || "Accès refusé : cette action requiert le rôle super admin.";
  }
  return data?.message || err.message || fallback;
}

export default api;
