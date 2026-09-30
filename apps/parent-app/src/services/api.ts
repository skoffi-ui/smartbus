import axios, { AxiosError } from 'axios';
import * as stockage from './storage';

/**
 * URL de la passerelle (même API Gateway que school-web/super-admin-web,
 * port 3002). Doit pointer sur l'IP LAN de la machine de dev, jamais
 * `localhost` : Expo Go tourne sur un appareil/émulateur séparé qui ne peut
 * pas résoudre le `localhost` de la machine de développement.
 */
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

export const TOKEN_KEY = 'smartbus_parent_token';

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await stockage.lire(TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Appelé sur 401 (jeton invalide/expiré). Contrairement à school-web,
 * `POST auth/parent/login` ne renvoie qu'un jeton d'accès — pas de jeton de
 * rafraîchissement côté parent aujourd'hui (voir `ParentPortalService.login`) —
 * donc pas de tentative de rafraîchissement silencieux ici : simplement
 * déconnecter et laisser l'écran de garde (`AuthContext`) renvoyer vers la
 * connexion.
 */
let surDeconnexionForcee: (() => void) | null = null;
export function definirGestionnaireDeconnexion(fn: (() => void) | null): void {
  surDeconnexionForcee = fn;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await stockage.supprimer(TOKEN_KEY);
      surDeconnexionForcee?.();
    }
    return Promise.reject(error);
  },
);

/**
 * Message affichable à l'écran. Même esprit que `messageFromError` côté
 * school-web : ne jamais afficher une erreur technique brute à un parent.
 */
export function messageFromError(
  error: unknown,
  fallback = 'Une erreur est survenue.',
): string {
  const err = error as AxiosError<{ message?: string }>;
  if (!err?.response) {
    return 'Le serveur est injoignable. Vérifiez votre connexion réseau.';
  }
  return err.response.data?.message || err.message || fallback;
}

export default api;
