import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { Notification } from '@app/database/tenant-entities/notification.entity';
import { Car } from '@app/database/tenant-entities/car.entity';
import { Child } from '@app/database/tenant-entities/child.entity';
import { GpsService } from '../gps/gps.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly gpsService: GpsService,
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

      // 1. Find the Child
      const child = await childRepo.findOne({ where: { empCode } });
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
          stateLabel = punchState === '1' || punchState === '5' ? 'descendu de' : 'monté dans';
        }
      } else {
        if (hour >= 4 && hour < 12) {
          stateLabel = hour < 9 ? 'monté dans' : 'descendu de';
        } else if (hour >= 12 && hour < 23) {
          stateLabel = hour < 17 ? 'monté dans' : 'descendu de';
        } else {
          stateLabel = punchState === '1' || punchState === '5' ? 'descendu de' : 'monté dans';
        }
      }
      
      // Override avec la machine si l'état est explicite
      if (punchState === '0' || punchState === '4') stateLabel = 'monté dans';
      if (punchState === '1' || punchState === '5') stateLabel = 'descendu de';
      
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
      return { success: true, notification };

    } catch (error) {
      this.logger.error(`Error handling internal webhook: ${error.message}`);
      return { success: false, error: error.message, stack: error.stack };
    }
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
