import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TenantService } from '../tenant/tenant.service';
import { Notification } from '@app/database/tenant-entities/notification.entity';
import { Car } from '@app/database/tenant-entities/car.entity';
import { Child } from '@app/database/tenant-entities/child.entity';
import { Parent } from '@app/database/tenant-entities/parent.entity';
import { SensPointage, sensFromPunchState } from '@app/database/tenant-entities/montee.entity';
import { GpsService } from '../gps/gps.service';
import { NotificationsGateway } from './notifications.gateway';
import { OnEvent } from '@nestjs/event-emitter';

// Mode Mock pour FCM car pas de fichier firebase-adminsdk.json fourni
// import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly gpsService: GpsService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async handleInternalPunchWebhook(payload: any) {
    const { empCode, terminalSn, punchState, time } = payload;
    
    // We assume the user has a valid tenant session or this is a secure internal call.
    // For the prototype, we bypass the request scope or assume tenant is 1.
    // However, since it's an internal webhook, we might need a workaround for Scope.REQUEST
    // For now, we will handle it by just using the TenantService if the middleware applies,
    // OR we can just inject DataSource directly if we hardcode tenant 1 for prototype.
    try {
      // Pour être intelligent, on récupère dynamiquement l'école active pour ce webhook
      // En production avec multi-écoles, super-app devrait envoyer le tenantId dans le payload
      const dynamicTenantId = payload.organisationId || await this.tenantService.getFirstOrganisationId();
      if (!dynamicTenantId) return { success: false, message: 'Aucune école active trouvée' };

      const dataSource = await this.tenantService.getDataSource(dynamicTenantId);
      const carRepo = dataSource.getRepository(Car);
      const childRepo = dataSource.getRepository(Child);
      const notifRepo = dataSource.getRepository(Notification);

      // 1. Find the Child with parent relation
      const child = await childRepo.findOne({ where: { empCode }, relations: { parent: true } });
      if (!child) return { success: false, message: 'Child not found' };

      // 2. Find the Car
      const car = await carRepo.findOne({ where: { biotimeTerminalSn: terminalSn } });
      
      const childName = `${child.firstName} ${child.lastName}`;
      
      // Logique intelligente basée sur les tranches horaires
      const dateObj = new Date(time);
      const hour = dateObj.getHours();
      const isSaturday = dateObj.getDay() === 6;
      let stateLabel = '';

      if (isSaturday) {
        if (hour >= 4 && hour < 10) {
          stateLabel = 'monté dans';
        } else if (hour >= 10 && hour < 14) {
          stateLabel = 'descendu de';
        } else {
          stateLabel = sensFromPunchState(punchState) === SensPointage.DESCENTE ? 'descendu de' : 'monté dans';
        }
      } else {
        if (hour >= 4 && hour < 12) {
          stateLabel = hour < 9 ? 'monté dans' : 'descendu de';
        } else if (hour >= 12 && hour < 23) {
          stateLabel = hour < 17 ? 'monté dans' : 'descendu de';
        } else {
          stateLabel = sensFromPunchState(punchState) === SensPointage.DESCENTE ? 'descendu de' : 'monté dans';
        }
      }

      // La badgeuse fait foi dès qu'elle annonce un état : l'heuristique horaire
      // ci-dessus ne sert que lorsque `punch_state` est absent du flux.
      if (punchState !== undefined && punchState !== null && punchState !== '') {
        stateLabel =
          sensFromPunchState(punchState) === SensPointage.DESCENTE ? 'descendu de' : 'monté dans';
      }
      
      let title = `Pointage de ${childName}`;
      let message = `${childName} est ${stateLabel} `;
      let metadata: any = { empCode, punchState, time };

      if (car) {
        message += `le véhicule ${car.plateNumber} (${car.brand})`;
        
        // Fetch live GPS for this specific car
        if (car.gpsDeviceId) {
           const liveLocations = await this.gpsService.getLiveLocations(dynamicTenantId);
           const carLocation = liveLocations.find(l => l.carId === car.id);
           if (carLocation) {
             metadata.lat = carLocation.lat;
             metadata.lng = carLocation.lng;
             metadata.speed = carLocation.speed;
             message += ` (Position GPS enregistrée).`;
           }
        }
      } else {
        message += `le terminal ${terminalSn}.`;
      }

      const notification = notifRepo.create({
        title,
        message,
        type: 'INFO',
        metadata,
        child: { id: child.id },
        ...(car ? { car: { id: car.id } } : {})
      });

      await notifRepo.save(notification);
      this.logger.log(`Notification créée: ${message}`);

      // Envoyer via WebSockets en direct aux parents abonnés
      try {
        this.notificationsGateway.sendPunchNotificationToParent(child.id, {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          metadata: notification.metadata,
          createdAt: notification.createdAt,
        });
      } catch (wsError) {
        this.logger.error(`Échec de diffusion WebSocket : ${wsError.message}`);
      }

      // Envoyer via Novu de manière asynchrone si le parent est renseigné
      if (child.parent) {
        this.triggerNovuNotification(child.parent, childName, message).catch(err => {
          this.logger.error(`Échec du déclenchement de la notification Novu : ${err.message}`);
        });

        // Simuler le Push FCM
        this.sendFcmMockPush(child.parent, title, message, metadata);
      }

      return { success: true, notification };

    } catch (error) {
      this.logger.error(`Error handling internal webhook: ${error.message}`);
      return { success: false, error: error.message, stack: error.stack };
    }
  }

  /**
   * Appelle l'API REST de Novu pour envoyer des SMS, e-mails ou push
   */
  private async triggerNovuNotification(parent: any, childName: string, message: string): Promise<void> {
    const novuApiKey = this.configService.get<string>('NOVU_API_KEY');
    const novuTriggerId = this.configService.get<string>('NOVU_TRIGGER_ID', 'smartbus-punch-alert');

    if (!novuApiKey) {
      this.logger.warn("NOVU_API_KEY non configurée. Envoi de notification de secours ignoré.");
      return;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.novu.co/v1/events/trigger',
          {
            name: novuTriggerId,
            to: {
              subscriberId: parent.id,
              phone: parent.phone,
              email: parent.email,
              firstName: parent.firstName,
              lastName: parent.lastName,
            },
            payload: {
              childName,
              message,
              title: 'Alerte Transport SMARTBUS',
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `ApiKey ${novuApiKey}`,
            },
          }
        )
      );
      this.logger.log(`✅ Alerte Novu déclenchée avec succès (Status: ${response.status})`);
    } catch (error: any) {
      this.logger.error(`Erreur API Novu: ${error.response?.data?.message || error.message}`);
    }
  }

  // ==========================================
  // FCM MOCK & BUS APPROACHING LOGIC
  // ==========================================

  @OnEvent('bus.approaching', { async: true })
  async handleBusApproaching(payload: { childId: string; carId: string; distanceKm: number; etaMins: number; tenantId: string }) {
    try {
      this.logger.debug(`Event received: bus.approaching for child ${payload.childId}`);
      const ds = await this.tenantService.getDataSource(payload.tenantId);
      const childRepo = ds.getRepository(Child);
      const notifRepo = ds.getRepository(Notification);

      const child = await childRepo.findOne({ where: { id: payload.childId }, relations: { parent: true } });
      if (!child || !child.parent) return;

      const title = 'Le bus approche ! 🚌';
      const message = `Le bus de ${child.firstName} arrive dans environ ${payload.etaMins} minutes (${payload.distanceKm.toFixed(1)} km).`;
      const metadata = { childId: child.id, carId: payload.carId, event: 'APPROACHING' };

      const notification = notifRepo.create({
        title,
        message,
        type: 'INFO',
        metadata,
        child: { id: child.id },
        car: { id: payload.carId }
      });
      await notifRepo.save(notification);

      // WebSockets
      this.notificationsGateway.sendPunchNotificationToParent(child.id, notification);

      // FCM Mock Push
      this.sendFcmMockPush(child.parent, title, message, metadata);
    } catch (e) {
      this.logger.error(`Failed to handle bus.approaching event: ${e.message}`);
    }
  }

  private sendFcmMockPush(parent: Parent, title: string, body: string, dataPayload: any) {
    if (!parent.fcmToken) {
      this.logger.warn(`Parent ${parent.firstName} n'a pas de token FCM. Enregistré en BDD uniquement.`);
      return;
    }

    this.logger.log(`\n======================================================`);
    this.logger.log(`📱 [MOCK FCM PUSH] -> Téléphone de ${parent.firstName} ${parent.lastName}`);
    this.logger.log(`Title : ${title}`);
    this.logger.log(`Body  : ${body}`);
    this.logger.log(`Data  : ${JSON.stringify(dataPayload)}`);
    this.logger.log(`Token : ${parent.fcmToken}`);
    this.logger.log(`======================================================\n`);
  }

  async updateParentToken(parentId: string, fcmToken: string) {
    const ds = await this.tenantService.getDataSource(); // Assuming tenant 1 for MVP / context
    const repo = ds.getRepository(Parent);
    const parent = await repo.findOne({ where: { id: parentId } });
    
    if (!parent) return { success: false, message: 'Parent introuvable' };
    
    parent.fcmToken = fcmToken;
    await repo.save(parent);
    return { success: true, message: 'Jeton FCM mis à jour.' };
  }

  async getRecentNotifications() {
    const dataSource = await this.tenantService.getDataSource();
    const notifRepo = dataSource.getRepository(Notification);
    return notifRepo.find({
      order: { createdAt: 'DESC' },
      take: 50,
      relations: { child: true, car: true }
    });
  }
}
