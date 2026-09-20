import { io, Socket } from 'socket.io-client';
import { GATEWAY_URL } from '../config';

// URL de la super-app qui héberge le serveur WebSocket
const WS_URL = import.meta.env.VITE_WS_URL || GATEWAY_URL;

let socket: Socket | null = null;

/**
 * Crée ou réutilise une connexion Socket.IO vers le namespace hardware stream
 */
export function getSocket(): Socket {
  if (!socket || socket.disconnected) {
    socket = io(`${WS_URL}/v1/hardware/stream`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      // Le serveur déduit l'école de ce jeton et n'envoie que les bus de cette école.
      auth: { token: localStorage.getItem('accessToken') || '' },
    });
  }
  return socket;
}

/**
 * Affine l'écoute sur une course précise.
 *
 * L'école n'est pas transmise : le serveur la déduit du jeton fourni à la connexion.
 * À la connexion, le client reçoit déjà toute l'activité de son école.
 */
export function subscribeToCourse(courseId: string): void {
  const s = getSocket();
  s.emit('subscribe', { courseId });
}

/**
 * Déconnecte proprement le socket
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Export nommé socketService requis par le layout et les pages d'alertes
export const socketService = {
  connect(): Socket {
    return getSocket();
  },
  disconnect(): void {
    disconnectSocket();
  }
};
