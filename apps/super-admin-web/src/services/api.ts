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

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ code?: string; message?: string }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      if (window.location.pathname !== '/login') window.location.href = '/login';
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
