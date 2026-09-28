import { io, Socket } from 'socket.io-client';
import { TOKEN_KEY } from './api';
import * as stockage from './storage';

/**
 * Base de l'API Gateway (même origine que `EXPO_PUBLIC_API_URL`, sans le
 * suffixe `/api/v1`) — jamais super-app directement : la passerelle relaie
 * les connexions WebSocket vers super-app (voir `apps/api-gateway/src/main.ts`,
 * `app.getHttpServer().on('upgrade', ...)`), même chemin que school-web
 * (`apps/school-web/src/services/socket.service.ts`).
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';
const GATEWAY_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

let socket: Socket | null = null;

/**
 * Connexion au namespace hardware-stream, jeton parent en `auth.token`.
 * Le serveur (`HardwareStreamGateway.handleConnection`) détecte `role:
 * 'PARENT'` dans ce jeton et n'abonne le client qu'aux courses réellement
 * utilisées par ses propres enfants — jamais toute l'école (voir le
 * commentaire de sécurité dans hardware-stream.gateway.ts).
 */
export async function obtenirSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;

  const token = await stockage.lire(TOKEN_KEY);
  socket = io(`${GATEWAY_ORIGIN}/v1/hardware/stream`, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    auth: { token: token || '' },
  });
  return socket;
}

export function deconnecterSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
