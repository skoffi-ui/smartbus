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
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { TenantConnectionService } from '@app/database';

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

  constructor(
    private readonly jwtService: JwtService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Connexion à la base d'une école, hors contexte HTTP — même mécanisme que
   * `CronService.connexionEcole` (apps/super-app/.../cron.service.ts) :
   * `TenantConnectionService` est en portée requête (lit un en-tête HTTP),
   * qu'un handshake WebSocket n'a jamais. Un contexte vide suffit puisque
   * l'identifiant d'école est déjà connu (extrait du JWT).
   */
  private async connexionEcole(organisationId: string) {
    const contextId = ContextIdFactory.create();
    this.moduleRef.registerRequestByContextId({}, contextId);
    const service = await this.moduleRef.resolve(
      TenantConnectionService,
      contextId,
      {
        strict: false,
      },
    );
    return service.getTenantConnection(organisationId);
  }

  /**
   * Salons `course:{courseId}` des courses réellement utilisées par les
   * enfants de ce parent — jamais `schoolRoom` (voir `handleConnection`).
   * Même jointure que `ParentPortalService.getChildren`
   * (apps/super-app/.../parent-portal.service.ts), dupliquée ici plutôt que
   * d'importer tout `ParentPortalModule` dans `HardwareStreamModule` pour
   * une seule requête — évite un couplage inter-modules superflu.
   */
  private async coursesDuParent(
    organisationId: string,
    parentId: string,
  ): Promise<string[]> {
    try {
      const tenantDS = await this.connexionEcole(organisationId);
      const lignes = await tenantDS.query(
        `
          SELECT DISTINCT co.id
          FROM children c
          INNER JOIN affectations aff ON aff.child_id = c.id
          INNER JOIN points_recuperation pr ON pr.id = aff.point_id
          INNER JOIN courses co ON co.trajet_id = pr.trajet_id AND co.deleted_at IS NULL
          WHERE c.parent_id = $1 AND c.deleted_at IS NULL
        `,
        [parentId],
      );
      return lignes.map((l: { id: string }) => l.id);
    } catch (err: any) {
      this.logger.error(
        `[WS Parent] Résolution des courses du parent ${parentId} impossible : ${err.message}`,
      );
      return [];
    }
  }

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
        role?: string;
      }>(token);

      if (!payload.organisationId) {
        this.logger.warn(
          `Connexion refusée (compte sans école) : ${client.id}`,
        );
        client.emit('unauthorized', {
          message: 'Aucune école associée à ce compte.',
        });
        client.disconnect(true);
        return;
      }

      const organisationId = payload.organisationId;
      client.data.organisationId = organisationId;
      client.data.userId = payload.sub;

      if (payload.role === 'PARENT') {
        // Jamais `schoolRoom` : un parent ne doit recevoir ni la position ni
        // les pointages des enfants des autres familles — seulement les
        // courses réellement utilisées par SES enfants. La liste est aussi
        // gardée dans `client.data` : `handleSubscribe` s'en sert pour
        // refuser toute tentative de rejoindre une AUTRE course de l'école.
        client.data.role = 'PARENT';
        const courseIds = await this.coursesDuParent(
          organisationId,
          payload.sub,
        );
        client.data.allowedCourseIds = courseIds;
        courseIds.forEach((courseId) =>
          client.join(courseRoom(organisationId, courseId)),
        );
        this.logger.log(
          `Client parent connecté : ${client.id} (école ${organisationId}, ${courseIds.length} course(s))`,
        );
      } else {
        // Compte école : déjà admin de toute l'école, abonnement à son activité complète.
        client.join(schoolRoom(organisationId));
        this.logger.log(
          `Client connecté : ${client.id} (école ${organisationId})`,
        );
      }

      client.emit('connected', { organisationId });
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

    // Un parent ne peut jamais rejoindre une course qui n'est pas celle
    // d'un de ses propres enfants — sans ce garde, `handleConnection`
    // scoperait correctement la connexion initiale, mais n'importe quel
    // parent pourrait ensuite demander explicitement `{ courseId: '<celle
    // d'une autre famille>' }` et l'obtenir.
    if (client.data.role === 'PARENT') {
      const autorisees: string[] = client.data.allowedCourseIds || [];
      if (!courseId || courseId === '*') {
        client.emit('subscribed', {
          room: 'toutes vos courses (déjà rejointes)',
          status: 'success',
        });
        return;
      }
      if (!autorisees.includes(courseId)) {
        this.logger.warn(
          `[WS Parent] Tentative refusée : ${client.id} → course ${courseId} (pas la sienne)`,
        );
        client.emit('unauthorized', {
          message: "Cette course n'appartient pas à l'un de vos enfants.",
        });
        return;
      }
      const room = courseRoom(organisationId, courseId);
      client.join(room); // déjà rejoint à la connexion — idempotent
      client.emit('subscribed', { room, status: 'success' });
      return;
    }

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
  handlePunchBroadcast(payload: {
    tenantId: string;
    courseId: string;
    data: any;
  }) {
    this.broadcast('punch', 'Pointage biométrique', payload);
  }

  /**
   * Écoute l'événement local de position GPS Libellule pour diffuser en temps réel.
   */
  @OnEvent('hardware.gps')
  handleGpsBroadcast(payload: {
    tenantId: string;
    courseId: string;
    data: any;
  }) {
    this.broadcast('gps', 'Position GPS', payload);
  }

  /**
   * Écoute l'événement local d'alerte de proximité pour diffuser en temps réel aux parents.
   */
  @OnEvent('hardware.proximity_alert')
  handleProximityAlertBroadcast(payload: {
    tenantId: string;
    courseId: string;
    data: any;
  }) {
    this.broadcast('proximity_alert', 'Alerte de proximité', payload);
  }

  /**
   * Écoute l'événement local d'anomalie critique pour diffuser en temps réel aux écoles.
   */
  @OnEvent('hardware.critical_anomaly')
  handleCriticalAnomalyBroadcast(payload: {
    tenantId: string;
    courseId: string;
    data: any;
  }) {
    this.broadcast('critical_anomaly', 'Anomalie critique', payload);
  }

  /**
   * Écoute le changement de permissions par école (voir OrganisationsService.update)
   * pour prévenir en temps réel les clients déjà connectés de cette école.
   *
   * Aucune donnée de permission n'est envoyée ici, seulement un signal : le
   * client réagit en rafraîchissant son jeton (voir school-web/App.tsx), qui
   * seul fait foi (relu en direct par la gateway, voir TenantGateService).
   * Ce salon est déjà rejoint par tout client connecté (suivi live/alertes) :
   * aucune connexion ni requête supplémentaire n'est nécessaire pour ce signal.
   */
  @OnEvent('organisation.permissions_updated')
  handlePermissionsUpdatedBroadcast(payload: { organisationId: string }) {
    this.server
      .to(schoolRoom(payload.organisationId))
      .emit('permissions_updated');
    this.logger.log(
      `[WS Broadcast] Permissions mises à jour, école ${payload.organisationId}`,
    );
  }
}
