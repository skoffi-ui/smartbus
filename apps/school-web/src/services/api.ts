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
  if (window.location.pathname !== '/login') window.location.href = '/login';
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
  (error: AxiosError<{ code?: GatewayErrorCode; message?: string }>) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const message = error.response?.data?.message;

    // Session invalide ou absente : retour à l'écran de connexion.
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
