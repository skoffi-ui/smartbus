import { io, Socket } from 'socket.io-client';

// URL de la super-app qui héberge le serveur WebSocket
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

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
    });
  }
  return socket;
}

/**
 * Souscrit à la room d'une école + course
 */
export function subscribeToCourse(tenantId: string, courseId: string): void {
  const s = getSocket();
  s.emit('subscribe', { tenantId, courseId });
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
