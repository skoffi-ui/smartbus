import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';

/** Salon recevant tous les événements d'une école, toutes courses confondues. */
const schoolRoom = (organisationId: string) => `school:${organisationId}`;

/** Salon d'une course précise d'une école. */
const courseRoom = (organisationId: string, courseId: string) =>
  `school:${organisationId}:course:${courseId}`;

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

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('Passerelle WebSocket Temps Réel initialisée.');
  }

  /**
   * Toute connexion doit présenter un JWT valide. L'école du client en est déduite
   * et figée pour la durée de la session : un client ne peut jamais demander à
   * écouter une autre école que la sienne.
   */
  async handleConnection(client: Socket) {
    const raw =
      client.handshake.auth?.token ||
      (client.handshake.headers?.authorization as string | undefined);
    const token = (raw || '').replace(/^Bearer\s+/i, '');

    if (!token) {
      this.logger.warn(`Connexion refusée (aucun token) : ${client.id}`);
      client.emit('unauthorized', { message: 'Token manquant.' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        organisationId?: string;
      }>(token);

      if (!payload.organisationId) {
        this.logger.warn(`Connexion refusée (compte sans école) : ${client.id}`);
        client.emit('unauthorized', { message: "Aucune école associée à ce compte." });
        client.disconnect(true);
        return;
      }

      client.data.organisationId = payload.organisationId;
      client.data.userId = payload.sub;

      // Abonnement immédiat à toute l'activité de SON école (carte de suivi live).
      client.join(schoolRoom(payload.organisationId));

      this.logger.log(
        `Client connecté : ${client.id} (école ${payload.organisationId})`,
      );
      client.emit('connected', { organisationId: payload.organisationId });
    } catch {
      this.logger.warn(`Connexion refusée (token invalide) : ${client.id}`);
      client.emit('unauthorized', { message: 'Session invalide ou expirée.' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté : ${client.id}`);
  }

  /**
   * Affinage optionnel de l'écoute sur une course précise.
   *
   * L'école n'est PAS lue dans le payload : elle vient du JWT validé à la connexion.
   * Un `tenantId` envoyé par le client est ignoré.
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() payload: { courseId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const organisationId = client.data.organisationId as string | undefined;
    if (!organisationId) {
      client.emit('unauthorized', { message: 'Session non authentifiée.' });
      client.disconnect(true);
      return;
    }

    const courseId = payload?.courseId;
    if (!courseId || courseId === '*') {
      // Déjà couvert par le salon de l'école, rejoint à la connexion.
      const room = schoolRoom(organisationId);
      client.emit('subscribed', { room, status: 'success' });
      return;
    }

    const room = courseRoom(organisationId, courseId);
    client.join(room);
    this.logger.log(`Le client [${client.id}] a rejoint le salon : ${room}`);
    client.emit('subscribed', { room, status: 'success' });
  }

  /**
   * Diffuse un événement aux abonnés d'une école : ceux qui suivent la course
   * concernée, et ceux qui suivent toute l'école. Socket.IO ne livre qu'une fois
   * par client, même s'il appartient aux deux salons.
   */
  private broadcast(
    event: string,
    label: string,
    payload: { tenantId: string; courseId: string; data: any },
  ): void {
    const { tenantId, courseId, data } = payload;
    if (!tenantId) {
      this.logger.error(
        `[WS Broadcast] ${label} sans tenantId : diffusion annulée pour éviter toute fuite.`,
      );
      return;
    }

    this.server
      .to(courseRoom(tenantId, courseId))
      .to(schoolRoom(tenantId))
      .emit(event, data);

    this.logger.log(`[WS Broadcast] ${label} émis à l'école ${tenantId}`);
  }

  /**
   * Écoute l'événement local de pointage ZKTeco pour diffuser en temps réel.
   */
  @OnEvent('hardware.punch')
  handlePunchBroadcast(payload: { tenantId: string; courseId: string; data: any }) {
    this.broadcast('punch', 'Pointage biométrique', payload);
  }

  /**
   * Écoute l'événement local de position GPS Libellule pour diffuser en temps réel.
   */
  @OnEvent('hardware.gps')
  handleGpsBroadcast(payload: { tenantId: string; courseId: string; data: any }) {
    this.broadcast('gps', 'Position GPS', payload);
  }

  /**
   * Écoute l'événement local d'alerte de proximité pour diffuser en temps réel aux parents.
   */
  @OnEvent('hardware.proximity_alert')
  handleProximityAlertBroadcast(payload: { tenantId: string; courseId: string; data: any }) {
    this.broadcast('proximity_alert', 'Alerte de proximité', payload);
  }

  /**
   * Écoute l'événement local d'anomalie critique pour diffuser en temps réel aux écoles.
   */
  @OnEvent('hardware.critical_anomaly')
  handleCriticalAnomalyBroadcast(payload: { tenantId: string; courseId: string; data: any }) {
    this.broadcast('critical_anomaly', 'Anomalie critique', payload);
  }
}
