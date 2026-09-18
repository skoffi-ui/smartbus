import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'v1/hardware/stream',
})
export class HardwareStreamGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(HardwareStreamGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.logger.log('Passerelle WebSocket Temps Réel initialisée.');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connecté : ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté : ${client.id}`);
  }

  /**
   * Action de souscription pour s'abonner de manière ciblée (par école et par trajet).
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    client: Socket,
    payload: { tenantId: string; courseId: string },
  ) {
    const { tenantId, courseId } = payload;
    if (!tenantId || !courseId) {
      client.emit('error', { message: 'Paramètres tenantId ou courseId manquants.' });
      return;
    }

    const room = `school:${tenantId}:course:${courseId}`;
    client.join(room);
    this.logger.log(`Le client [${client.id}] a rejoint le salon : ${room}`);
    
    // Confirmer la souscription au client
    client.emit('subscribed', { room, status: 'success' });
  }

  /**
   * Écoute l'événement local de pointage ZKTeco pour diffuser en temps réel.
   */
  @OnEvent('hardware.punch')
  handlePunchBroadcast(payload: { tenantId: string; courseId: string; data: any }) {
    const { tenantId, courseId, data } = payload;
    const room = `school:${tenantId}:course:${courseId}`;
    
    // Diffusion aux abonnés de la room
    this.server.to(room).emit('punch', data);
    this.logger.log(`[WS Broadcast] Pointage biométrique émis sur le salon : ${room}`);
  }

  /**
   * Écoute l'événement local de position GPS Libellule pour diffuser en temps réel.
   */
  @OnEvent('hardware.gps')
  handleGpsBroadcast(payload: { tenantId: string; courseId: string; data: any }) {
    const { tenantId, courseId, data } = payload;
    const room = `school:${tenantId}:course:${courseId}`;
    
    // Diffusion aux abonnés de la room
    this.server.to(room).emit('gps', data);
    this.logger.log(`[WS Broadcast] Position GPS émise sur le salon : ${room}`);
  }

  /**
   * Écoute l'événement local d'alerte de proximité pour diffuser en temps réel aux parents.
   */
  @OnEvent('hardware.proximity_alert')
  handleProximityAlertBroadcast(payload: { tenantId: string; courseId: string; data: any }) {
    const { tenantId, courseId, data } = payload;
    const room = `school:${tenantId}:course:${courseId}`;
    
    // Diffusion aux abonnés de la room
    this.server.to(room).emit('proximity_alert', data);
    this.logger.log(`[WS Broadcast] Alerte de proximité émise sur le salon : ${room}`);
  }

  /**
   * Écoute l'événement local d'anomalie critique pour diffuser en temps réel aux écoles.
   */
  @OnEvent('hardware.critical_anomaly')
  handleCriticalAnomalyBroadcast(payload: { tenantId: string; courseId: string; data: any }) {
    const { tenantId, courseId, data } = payload;
    // Envoyer à la room du trajet spécifique ET à la room générique wildcard
    this.server.to(`school:${tenantId}:course:${courseId}`).emit('critical_anomaly', data);
    this.server.to(`school:${tenantId}:course:*`).emit('critical_anomaly', data);
    this.logger.error(`[WS Broadcast] Anomalie critique émise sur les salons pour le tenant ${tenantId}`);
  }
}
