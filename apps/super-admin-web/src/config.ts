/** Point d'entrée unique de l'API : l'API Gateway (jamais les services directement). */
export const GATEWAY_URL: string =
  import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3002';
