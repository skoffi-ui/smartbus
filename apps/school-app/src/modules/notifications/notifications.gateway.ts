import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(
      `Client connecté au Namespace des Notifications : ${client.id}`,
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      `Client déconnecté du Namespace des Notifications : ${client.id}`,
    );
  }

  /**
   * Permet à un parent de s'abonner aux notifications d'un enfant spécifique.
   */
  @SubscribeMessage('subscribe_child')
  handleSubscribeChild(
    @MessageBody() data: { childId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data && data.childId) {
      const room = `child_${data.childId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} a rejoint la salle : ${room}`);
      return {
        status: 'success',
        message: `Abonné avec succès à la salle ${room}`,
      };
    }
    return { status: 'error', message: 'childId invalide.' };
  }

  /**
   * Diffuse un événement de pointage biométrique à tous les parents abonnés à cet enfant.
   */
  sendPunchNotificationToParent(childId: string, payload: any) {
    const room = `child_${childId}`;
    this.server.to(room).emit('punch_event', payload);
    this.logger.log(
      `📢 Diffusion du pointage à la salle ${room} : ${JSON.stringify(payload)}`,
    );
  }
}
