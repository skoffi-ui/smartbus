import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Organisation,
  Child,
  Car,
  Course,
  Trajet,
  PointRecuperation,
  Affectation,
  Montee,
  Alerte,
  BiometricEvent,
  Parent,
  Driver,
  Notification,
  Pointage,
  BiometricEventType,
  CourseStatus,
  TypeAlerte,
  AlerteCritique,
  MonteeStatut,
  SensPointage,
  sensFromPunchState,
  TENANT_ENTITIES,
} from '@app/database';
import { INTERNAL_API_KEY_HEADER } from '@app/common';

/**
 * Résultat de la résolution du propriétaire d'un appareil.
 *
 * `pending` n'est pas une erreur : l'appareil est en stock dans l'inventaire central
 * et attend qu'un administrateur lui attribue une école.
 */
export type DeviceResolution =
  | { state: 'assigned'; tenant: any }
  | { state: 'pending' };

/**
 * Verdict d'un pointage, produit par l'analyse d'anomalies et consigné dans
 * l'historique des montées (table `montees`), que le pointage soit accepté ou non.
 */
export interface VerdictPointage {
  statut: MonteeStatut;
  message: string;
  /** Arrêt attendu de l'enfant, connu seulement s'il est affecté à ce trajet. */
  pointId?: string;
  /** Distance du bus à cet arrêt, en mètres, si une position GPS était disponible. */
  distanceMetres?: number;
  /** Vrai si aucune montée ne peut être consignée (ni car, ni course identifiés). */
  sansCourse?: boolean;
}

/** Position live d'un bus, toujours rattachée à l'école qui possède le véhicule. */
export interface LiveCarPosition {
  organisationId: string;
  carId: string;
  plateNumber?: string;
  lat: number;
  lng: number;
  speed?: number;
  time?: string;
}

@Injectable()
export class HardwareStreamService {
  private readonly logger = new Logger(HardwareStreamService.name);
  private readonly tenantDataSources = new Map<string, DataSource>();
  private readonly triggeredAlerts = new Map<string, Set<string>>(); // courseId -> Set<childId>
  // Clé : `${organisationId}:${carId}`. La position d'un bus n'est jamais lisible
  // depuis une autre école : le filtrage est structurel, pas applicatif.
  private readonly latestCarGps = new Map<string, LiveCarPosition>();
  private lastCleanupDate = new Date().toDateString();

  constructor(
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    private readonly centralDataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Extrait l'identifiant du périphérique depuis le payload brut du Webhook.
   */
  private extractDeviceId(payload: any): string | null {
    if (!payload) return null;
    
    // Cas ZKTeco / BioTime
    if (payload.terminal_sn) return payload.terminal_sn;
    if (payload.terminalSn) return payload.terminalSn;
    if (payload.sn) return payload.sn;

    // Cas Libellule / GPS
    if (payload.device_id) return payload.device_id;
    if (payload.deviceId) return payload.deviceId;
    if (payload.imei) return payload.imei;

    return null;
  }

  /** Clé de cache d'une position : toujours préfixée par l'école propriétaire du bus. */
  private gpsKey(organisationId: string, carId: string): string {
    return `${organisationId}:${carId}`;
  }

  /**
   * Résout l'école propriétaire d'un appareil à partir de l'inventaire central.
   *
   * Un appareil sans affectation renvoie `pending` : il reste en stock jusqu'à ce
   * qu'on lui attribue une école. Ses données ne sont écrites dans aucune base
   * entre-temps — les rattacher à une école arbitraire mélangerait deux clients.
   */
  private async resolveTenantForDevice(deviceId: string): Promise<DeviceResolution> {
    // Une erreur d'infrastructure est propagée telle quelle : l'émetteur pourra
    // réessayer, plutôt que de voir son flux classé à tort « en attente ».
    const result = await this.centralDataSource.query(
      `
        SELECT od.organisation_id as "organisationId", o.name, o.db_name as "dbName",
               o.db_host as "dbHost", o.db_port as "dbPort", o.db_user as "dbUser",
               o.db_password as "dbPassword", o.db_provisioned as "dbProvisioned"
        FROM organisation_devices od
        INNER JOIN devices d ON d.id = od.device_id
        INNER JOIN organisations o ON o.id = od.organisation_id
        WHERE (d.serial_number = $1 OR d.imei = $1)
          AND od.released_at IS NULL
          AND d.deleted_at IS NULL
        LIMIT 1
      `,
      [deviceId],
    );

    if (result && result.length > 0) {
      return { state: 'assigned', tenant: result[0] };
    }
    return { state: 'pending' };
  }

  /** Déduit la nature de l'appareil à partir de la forme de son payload. */
  private inferDeviceType(payload: any): 'BADGEUSE' | 'GPS' {
    return payload?.terminal_sn || payload?.terminalSn || payload?.sn ? 'BADGEUSE' : 'GPS';
  }

  /**
   * Inscrit l'appareil à l'inventaire central s'il est inconnu, et rafraîchit son
   * heartbeat. Un appareil inconnu entre « en stock », sans école : il apparaît
   * ainsi dans le parc du Super Admin, qui peut l'attribuer à une école.
   */
  private async ensureDeviceRegistered(
    deviceId: string,
    typeDevice: 'BADGEUSE' | 'GPS',
  ): Promise<void> {
    try {
      const existing = await this.centralDataSource.query(
        `SELECT id FROM devices WHERE (serial_number = $1 OR imei = $1) AND deleted_at IS NULL LIMIT 1`,
        [deviceId],
      );

      if (existing && existing.length > 0) {
        await this.centralDataSource.query(
          `UPDATE devices SET last_seen_at = now(), status = 'ACTIVE' WHERE id = $1`,
          [existing[0].id],
        );
        return;
      }

      await this.centralDataSource.query(
        `INSERT INTO devices (type_device, serial_number, status, last_seen_at)
         VALUES ($1, $2, 'ACTIVE', now())`,
        [typeDevice, deviceId],
      );
      this.logger.log(
        `[Inventaire] Appareil ${typeDevice} "${deviceId}" inconnu : mis en stock, en attente d'affectation à une école.`,
      );
    } catch (err: any) {
      this.logger.error(
        `Impossible d'inscrire l'appareil ${deviceId} à l'inventaire : ${err.message}`,
      );
    }
  }

  /** Réponse renvoyée à l'émetteur tant que l'appareil n'a pas d'école. */
  private pendingResponse(deviceId: string) {
    this.logger.warn(
      `Appareil "${deviceId}" en attente d'affectation : flux accepté mais enregistré dans aucune base école.`,
    );
    return {
      success: true,
      pending: true,
      message:
        `Appareil "${deviceId}" en stock, en attente d'affectation à une école. ` +
        `Aucune donnée métier n'a été enregistrée.`,
    };
  }

  /**
   * Retourne ou crée un DataSource TypeORM connecté à la base de données isolée du tenant.
   */
  public async getTenantDataSource(org: any): Promise<DataSource> {
    const tenantId = org.organisationId || org.id;
    if (this.tenantDataSources.has(tenantId)) {
      const cached = this.tenantDataSources.get(tenantId)!;
      if (cached.isInitialized) return cached;
      this.tenantDataSources.delete(tenantId);
    }

    const host = org.dbHost || this.configService.get<string>('SUPER_DB_HOST', 'localhost');
    const port = org.dbPort || this.configService.get<number>('SUPER_DB_PORT', 5432);
    const username = org.dbUser || this.configService.get<string>('SUPER_DB_USER', 'postgres');
    const password = org.dbPassword || this.configService.get<string>('SUPER_DB_PASSWORD', 'postgres');

    const ds = new DataSource({
      type: 'postgres',
      host,
      port,
      username,
      password,
      database: org.dbName,
      // Source unique partagée avec le provisionnement et la connexion tenant :
      // une liste locale divergerait du schéma réellement créé en base.
      entities: TENANT_ENTITIES,
      synchronize: false,
    });

    await ds.initialize();
    this.tenantDataSources.set(tenantId, ds);
    this.logger.log(`[Dynamic Conn] Nouvelle connexion ouverte vers la base isolée : ${org.dbName}`);
    return ds;
  }

  /**
   * Traite le flux entrant unifié de streaming matériel.
   */
  async handleStream(payload: any): Promise<any> {
    const deviceId = this.extractDeviceId(payload);
    if (!deviceId) {
      return { success: false, message: "Identifiant de périphérique introuvable dans le payload." };
    }

    // 1. Inventaire central : l'appareil est inscrit s'il est inconnu, et son
    //    heartbeat rafraîchi dans tous les cas.
    await this.ensureDeviceRegistered(deviceId, this.inferDeviceType(payload));

    // 2. À quelle école appartient-il ?
    const resolution = await this.resolveTenantForDevice(deviceId);
    if (resolution.state === 'pending') {
      return this.pendingResponse(deviceId);
    }

    const tenantDetails = resolution.tenant;
    if (!tenantDetails.dbProvisioned || !tenantDetails.dbName) {
      return { success: false, message: `La base de données du tenant ${tenantDetails.name} n'est pas provisionnée.` };
    }

    // 4. Bascule dynamique vers la base isolée du Tenant
    const tenantDataSource = await this.getTenantDataSource(tenantDetails);

    // 5. Détermination du type de flux (ZKTeco vs Libellule) et traitement
    if (payload.terminal_sn || payload.terminalSn || payload.sn) {
      return this.processZktPunches(payload, tenantDetails, tenantDataSource);
    } else {
      return this.processLibelluleGps(payload, tenantDetails, tenantDataSource);
    }
  }

  /**
   * Traitement spécifique du flux de pointage BioTime / ZKTeco.
   */
  private async processZktPunches(payload: any, tenantDetails: any, tenantDataSource: DataSource): Promise<any> {
    this.logger.log(`[Stream Routing] Flux ZKTeco intercepté pour le tenant ${tenantDetails.name}`);

    const childRepo = tenantDataSource.getRepository(Child);
    const eventRepo = tenantDataSource.getRepository(BiometricEvent);
    const carRepo = tenantDataSource.getRepository(Car);
    const courseRepo = tenantDataSource.getRepository(Course);

    const empCode = payload.emp_code || payload.empCode;
    const terminalSn = payload.terminal_sn || payload.terminalSn || payload.sn;
    const punchTime = payload.punch_time || payload.time || new Date().toISOString();
    const punchState = payload.punch_state ?? payload.punchState ?? '0';
    const sens = sensFromPunchState(punchState);

    // Trouver l'enfant dans la base isolée du tenant (facultatif)
    const child = await childRepo.findOne({ where: { empCode } });

    // Résoudre le véhicule puis la course active AVANT de tracer l'événement :
    // l'événement porte la course quand elle est connue.
    let courseId = 'default-course';
    const car = await carRepo.findOne({ where: { biotimeTerminalSn: terminalSn } });
    let activeCourse: Course | null = null;
    if (car) {
      activeCourse = await courseRepo.findOne({ where: { carId: car.id, statut: CourseStatus.ACTIVE } });
      if (activeCourse) {
        courseId = activeCourse.id;
      }
    }

    // Trace brute du badgeage, conservée même sans course identifiée.
    const bioEvent = eventRepo.create({
      childId: child ? child.id : undefined,
      courseId: activeCourse ? activeCourse.id : undefined,
      type: sens === SensPointage.DESCENTE ? BiometricEventType.ALIGHTING : BiometricEventType.BOARDING,
      occurredAt: new Date(punchTime),
      notificationSent: false,
    });
    await eventRepo.save(bioEvent);

    // Analyse des anomalies, puis consignation du pointage dans l'historique.
    if (child) {
      const verdict = await this.validatePunchAnomalies(
        child, car, activeCourse, terminalSn, punchTime, tenantDetails, tenantDataSource,
      );

      // L'historique des montées exige une course : sans car ni course active, seule
      // l'alerte critique fait foi (c'est ce que consulte le centre d'alertes).
      if (!verdict.sansCourse && activeCourse) {
        await this.saveMontee(
          tenantDataSource, child, activeCourse, car, sens, verdict, punchTime,
        );
      }
    }

    // Émettre l'événement temps réel pour la passerelle WebSocket (pour affichage instantané)
    this.eventEmitter.emit('hardware.punch', {
      tenantId: tenantDetails.organisationId,
      courseId,
      data: {
        empCode: empCode || 'N/A',
        childId: child ? child.id : null,
        childName: child ? `${child.firstName} ${child.lastName}` : `Élève Inconnu (Matricule: ${empCode || 'N/A'})`,
        punchState,
        time: punchTime,
        terminalSn,
      },
    });

    // Relayer l'information à school-app pour l'envoi de notifications (WhatsApp/Web) et la fusion GPS
    try {
      const payloadToSchool = {
        empCode,
        terminalSn,
        punchState,
        time: punchTime,
        organisationId: tenantDetails.organisationId,
      };

      // Port 3001 de school-app
      const schoolWebhookUrl = this.configService.get<string>('SCHOOL_APP_WEBHOOK_URL', 'http://localhost:3001/api/v1/notifications/internal-webhook');
      await firstValueFrom(
        this.httpService.post(schoolWebhookUrl, payloadToSchool, {
          headers: {
            [INTERNAL_API_KEY_HEADER]: this.configService.get<string>('INTERNAL_API_KEY', ''),
          },
        }),
      );
      this.logger.log(`[Stream Routing] Notification relayée à school-app avec succès.`);
    } catch (err) {
      this.logger.error(`[Stream Routing] Relais vers school-app : ${err.message}`);
    }

    return { success: true, message: 'Pointage ZKTeco traité et acheminé.', tenant: tenantDetails.name };
  }

  /**
   * Traitement spécifique du flux de géolocalisation Libellule.
   */
  private async processLibelluleGps(payload: any, tenantDetails: any, tenantDataSource: DataSource): Promise<any> {
    this.logger.log(`[Stream Routing] Flux GPS Libellule intercepté pour le tenant ${tenantDetails.name}`);

    const carRepo = tenantDataSource.getRepository(Car);
    const notifRepo = tenantDataSource.getRepository(Notification);

    const deviceId = payload.device_id || payload.deviceId || payload.imei;
    const lat = parseFloat(payload.latitude || payload.lat);
    const lng = parseFloat(payload.longitude || payload.lng);
    const speed = parseFloat(payload.speed || 0);
    const time = payload.time || payload.timestamp || new Date().toISOString();

    // Trouver le véhicule correspondant au GPS
    const car = await carRepo.findOne({
      where: [{ gpsDeviceId: deviceId }, { plateNumber: deviceId }]
    });

    if (car) {
      // Mettre à jour la cache en mémoire
      if (car && lat && lng) {
        this.latestCarGps.set(this.gpsKey(tenantDetails.organisationId, car.id), {
          organisationId: tenantDetails.organisationId,
          lat,
          lng,
          speed,
          carId: car.id,
          plateNumber: car.plateNumber,
          time: payload.time || new Date().toISOString(),
        });
      }

      // Journaliser un enregistrement de notification ou d'alerte pour le suivi de trajet
      const notification = notifRepo.create({
        title: `Position GPS mise à jour : ${car.plateNumber}`,
        message: `Véhicule ${car.plateNumber} localisé à Lat: ${lat}, Lng: ${lng} (Vitesse: ${speed} km/h).`,
        type: 'INFO',
        metadata: {
          carId: car.id,
          plateNumber: car.plateNumber,
          lat,
          lng,
          speed,
          time,
        },
        car: { id: car.id }
      });
      await notifRepo.save(notification);
      this.logger.log(`[GPS Stream] Position mise à jour pour le car ${car.plateNumber}`);

      // Résoudre le trajet (course) actif pour ce véhicule
      const courseRepo = tenantDataSource.getRepository(Course);
      let courseId = 'default-course';
      const activeCourse = await courseRepo.findOne({ where: { carId: car.id, statut: CourseStatus.ACTIVE } });
      if (activeCourse) {
        courseId = activeCourse.id;
      }

      // Émettre l'événement temps réel pour la passerelle WebSocket
      this.eventEmitter.emit('hardware.gps', {
        tenantId: tenantDetails.organisationId,
        courseId,
        data: {
          carId: car.id,
          plateNumber: car.plateNumber,
          lat,
          lng,
          speed,
          time,
        },
      });

      // Lancer le calcul de proximité pour les alertes de proximité des élèves
      await this.checkProximityAlerts(lat, lng, courseId, car.id, tenantDetails, tenantDataSource);
    } else {
      this.logger.warn(`[GPS Stream] Aucun véhicule associé au périphérique GPS ${deviceId}`);
    }

    return { success: true, message: 'Position GPS Libellule traitée.', tenant: tenantDetails.name };
  }

  /**
   * Récupère tous les équipements inactifs (pas de signal depuis > 5 min).
   */
  async getDeviceAlerts(): Promise<any[]> {
    try {
      const query = `
        SELECT id, type_device as "type", serial_number as "serialNumber", imei, last_seen_at as "lastSeenAt", status
        FROM devices
        WHERE (status = 'INACTIVE' OR last_seen_at < now() - INTERVAL '5 minutes')
          AND status != 'DECOMMISSIONED'
          AND deleted_at IS NULL
        ORDER BY last_seen_at DESC NULLS FIRST
      `;
      return await this.centralDataSource.query(query);
    } catch (err) {
      this.logger.error(`Erreur lors de la récupération des alertes matérielles : ${err.message}`);
      return [];
    }
  }

  /**
   * Calcul de la distance géodésique en km entre deux coordonnées GPS via la formule de Haversine.
   */
  private calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Rayon de la terre en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Vérifie si l'alerte a déjà été déclenchée aujourd'hui pour cet élève durant cette course.
   */
  private isAlreadyAlerted(courseId: string, childId: string): boolean {
    const today = new Date().toDateString();
    if (this.lastCleanupDate !== today) {
      this.triggeredAlerts.clear();
      this.lastCleanupDate = today;
    }
    return this.triggeredAlerts.get(courseId)?.has(childId) ?? false;
  }

  /**
   * Marque l'alerte comme déclenchée pour éviter les calculs futurs redondants.
   */
  private markAsAlerted(courseId: string, childId: string): void {
    if (!this.triggeredAlerts.has(courseId)) {
      this.triggeredAlerts.set(courseId, new Set());
    }
    this.triggeredAlerts.get(courseId)!.add(childId);
  }

  /**
   * Vérifie et lève des alertes de proximité (rayon de 1.5 km) pour les élèves attendus sur ce trajet.
   */
  private async checkProximityAlerts(
    lat: number,
    lng: number,
    courseId: string,
    carId: string,
    tenantDetails: any,
    tenantDataSource: DataSource,
  ): Promise<void> {
    if (courseId === 'default-course') return;

    try {
      // 1. Récupérer les arrêts et les élèves de la tournée courante
      const query = `
        SELECT 
          c.id as "childId",
          c.first_name as "firstName",
          c.last_name as "lastName",
          pr.id as "stopId",
          pr.nom as "stopName",
          pr.latitude as "stopLatitude",
          pr.longitude as "stopLongitude"
        FROM affectations aff
        INNER JOIN children c ON c.id = aff.child_id
        INNER JOIN points_recuperation pr ON pr.id = aff.point_id
        INNER JOIN courses co ON co.trajet_id = pr.trajet_id
        WHERE co.id = $1
          AND c.deleted_at IS NULL
          AND co.deleted_at IS NULL
      `;
      const targets = await tenantDataSource.query(query, [courseId]);

      if (!targets || targets.length === 0) return;

      const alerteRepo = tenantDataSource.getRepository(Alerte);

      // 2. Parcourir et calculer la distance Haversine pour chaque élève
      for (const target of targets) {
        if (this.isAlreadyAlerted(courseId, target.childId)) {
          continue; // Déjà alerté pour cette course, on saute les calculs
        }

        const stopLat = parseFloat(target.stopLatitude);
        const stopLng = parseFloat(target.stopLongitude);
        if (isNaN(stopLat) || isNaN(stopLng)) continue;

        const distance = this.calculateHaversine(lat, lng, stopLat, stopLng);

        // Si le bus entre dans un rayon de 1.5 km
        if (distance <= 1.5) {
          // A. Marquer comme alerté (anti-doublon)
          this.markAsAlerted(courseId, target.childId);

          // B. Persister l'alerte en BDD isolée
          const now = new Date();
          const alerte = alerteRepo.create({
            type: TypeAlerte.GPS_HORS_ZONE, // proximity detection alert
            message: `Alerte Proximité : Le bus est à ${distance.toFixed(2)} km de l'arrêt [${target.stopName}] pour l'élève ${target.firstName} ${target.lastName}.`,
            date: now,
            heure: now.toTimeString().split(' ')[0],
            courseId,
            childId: target.childId,
            carId,
          });
          await alerteRepo.save(alerte);

          this.logger.log(
            `[Proximity Alert] Déclenchée pour l'élève ${target.firstName} ${target.lastName} (arrêt : ${target.stopName}, distance : ${distance.toFixed(2)} km)`,
          );

          // C. Émettre l'événement pour la passerelle WebSocket en temps réel
          this.eventEmitter.emit('hardware.proximity_alert', {
            tenantId: tenantDetails.organisationId,
            courseId,
            data: {
              childId: target.childId,
              childName: `${target.firstName} ${target.lastName}`,
              stopName: target.stopName,
              distance: parseFloat(distance.toFixed(2)),
              time: now.toISOString(),
            },
          });
        }
      }
    } catch (err) {
      this.logger.error(`Erreur lors du calcul de proximité GPS : ${err.message}`);
    }
  }

  /**
   * Analyse un pointage ZKTeco en temps réel pour détecter les anomalies critiques :
   * 1/ Non affectation de l'élève à ce véhicule (mauvais car / trajet)
   * 2/ Mauvais arrêt d'embarquement/débarquement
   */
  /**
   * Consigne le pointage dans l'historique de l'école (table `montees`), avec son
   * sens et le verdict de validation. C'est cette table que lit l'écran de suivi.
   */
  private async saveMontee(
    tenantDataSource: DataSource,
    child: Child,
    course: Course,
    car: Car | null,
    sens: SensPointage,
    verdict: VerdictPointage,
    punchTime: string,
  ): Promise<void> {
    try {
      const repo = tenantDataSource.getRepository(Montee);
      const moment = new Date(punchTime);

      const montee = repo.create({
        childId: child.id,
        courseId: course.id,
        carId: car?.id,
        pointId: verdict.pointId,
        date: moment,
        heure: moment.toTimeString().substring(0, 8),
        distanceGps: verdict.distanceMetres,
        sens,
        statut: verdict.statut,
        validationMessage: verdict.message,
      });
      await repo.save(montee);

      this.logger.log(
        `[Montée] ${child.firstName} ${child.lastName} — ${sens} ${verdict.statut} (course ${course.nom})`,
      );
    } catch (err: any) {
      // Un échec d'écriture de l'historique ne doit pas faire échouer l'ingestion :
      // l'événement biométrique et l'alerte éventuelle sont déjà enregistrés.
      this.logger.error(`[Montée] Consignation impossible : ${err.message}`);
    }
  }

  private async validatePunchAnomalies(
    child: Child,
    car: Car | null,
    activeCourse: Course | null,
    terminalSn: string,
    punchTime: string,
    tenantDetails: any,
    tenantDataSource: DataSource,
  ): Promise<VerdictPointage> {
    const alerteCritiqueRepo = tenantDataSource.getRepository(AlerteCritique);
    const now = new Date(punchTime);

    // 1. Si aucun véhicule associé à cette badgeuse
    if (!car) {
      const errorMsg = `Badgeage de l'élève ${child.firstName} ${child.lastName} sur une badgeuse inconnue (SN: ${terminalSn}).`;
      const critAlerte = alerteCritiqueRepo.create({
        type: 'CAR_INCONNU',
        severity: 'HIGH',
        message: errorMsg,
        childId: child.id,
        childName: `${child.firstName} ${child.lastName}`,
        childEmpCode: child.empCode,
        terminalSn,
        punchTime: now,
      });
      await alerteCritiqueRepo.save(critAlerte);

      this.eventEmitter.emit('hardware.critical_anomaly', {
        tenantId: tenantDetails.organisationId,
        courseId: 'default-course',
        data: {
          type: 'CAR_INCONNU',
          childId: child.id,
          childName: `${child.firstName} ${child.lastName}`,
          detectedCarPlate: terminalSn,
          expectedCarPlate: null,
          message: errorMsg,
          time: now.toISOString(),
        },
      });
      return { statut: MonteeStatut.REFUSE, message: errorMsg, sansCourse: true };
    }

    // 2. Si aucune course active pour ce véhicule
    if (!activeCourse) {
      const errorMsg = `L'élève ${child.firstName} ${child.lastName} a badgé sur le véhicule ${car.plateNumber} mais aucune course n'est active actuellement sur ce bus.`;
      const critAlerte = alerteCritiqueRepo.create({
        type: 'COURSE_INACTIVE',
        severity: 'HIGH',
        message: errorMsg,
        childId: child.id,
        childName: `${child.firstName} ${child.lastName}`,
        childEmpCode: child.empCode,
        detectedCarId: car.id,
        detectedCarPlate: car.plateNumber,
        terminalSn,
        punchTime: now,
      });
      await alerteCritiqueRepo.save(critAlerte);

      this.eventEmitter.emit('hardware.critical_anomaly', {
        tenantId: tenantDetails.organisationId,
        courseId: 'default-course',
        data: {
          type: 'COURSE_INACTIVE',
          childId: child.id,
          childName: `${child.firstName} ${child.lastName}`,
          detectedCarPlate: car.plateNumber,
          expectedCarPlate: null,
          message: errorMsg,
          time: now.toISOString(),
        },
      });
      return { statut: MonteeStatut.REFUSE, message: errorMsg, sansCourse: true };
    }

    // 3. Vérifier l'affectation de l'élève à ce véhicule (via le trajet de la course active)
    const affectationResult = await tenantDataSource.query(`
      SELECT aff.point_id as "pointId", pr.nom as "stopName", pr.latitude as "stopLatitude", pr.longitude as "stopLongitude", pr.trajet_id as "trajetId"
      FROM affectations aff
      INNER JOIN points_recuperation pr ON pr.id = aff.point_id
      WHERE aff.child_id = $1 AND pr.trajet_id = $2
      LIMIT 1
    `, [child.id, activeCourse.trajetId]);

    if (!affectationResult || affectationResult.length === 0) {
      // Élève non affecté à ce trajet/véhicule. Cherchons s'il a au moins une affectation
      const anyAffectation = await tenantDataSource.query(`
        SELECT aff.point_id as "pointId", pr.nom as "stopName", pr.trajet_id as "trajetId"
        FROM affectations aff
        INNER JOIN points_recuperation pr ON pr.id = aff.point_id
        WHERE aff.child_id = $1
        LIMIT 1
      `, [child.id]);

      let typeAlerte = 'MAUVAIS_CAR';
      let errorMsg = `L'élève ${child.firstName} ${child.lastName} est monté dans le mauvais bus (${car.plateNumber}) pour la course "${activeCourse.nom}".`;
      let expectedCourseId: string | null = null;

      if (!anyAffectation || anyAffectation.length === 0) {
        typeAlerte = 'ENFANT_NON_AFFECTE';
        errorMsg = `L'élève ${child.firstName} ${child.lastName} a badgé sur la course "${activeCourse.nom}" (${car.plateNumber}) mais n'est affecté à aucun trajet.`;
      } else {
        // Trouver la course théorique attendue de l'élève
        const expectedCourse = await tenantDataSource.query(`
          SELECT id, nom FROM courses WHERE trajet_id = $1 AND deleted_at IS NULL LIMIT 1
        `, [anyAffectation[0].trajetId]);
        if (expectedCourse && expectedCourse.length > 0) {
          expectedCourseId = expectedCourse[0].id;
          errorMsg = `L'élève ${child.firstName} ${child.lastName} est monté dans le mauvais bus (${car.plateNumber}, course "${activeCourse.nom}"). Il était attendu sur la course "${expectedCourse[0].nom}".`;
        }
      }

      const critAlerte = alerteCritiqueRepo.create({
        type: typeAlerte,
        severity: 'CRITICAL',
        message: errorMsg,
        childId: child.id,
        childName: `${child.firstName} ${child.lastName}`,
        childEmpCode: child.empCode,
        detectedCarId: car.id,
        detectedCarPlate: car.plateNumber,
        terminalSn,
        detectedCourseId: activeCourse.id,
        expectedCourseId,
        punchTime: now,
      });
      await alerteCritiqueRepo.save(critAlerte);

      this.eventEmitter.emit('hardware.critical_anomaly', {
        tenantId: tenantDetails.organisationId,
        courseId: activeCourse.id,
        data: {
          type: typeAlerte,
          childId: child.id,
          childName: `${child.firstName} ${child.lastName}`,
          detectedCarPlate: car.plateNumber,
          expectedCarPlate: null,
          message: errorMsg,
          time: now.toISOString(),
          detectedCourseId: activeCourse.id,
          expectedCourseId,
        },
      });
      return { statut: MonteeStatut.REFUSE, message: errorMsg };
    }

    // 4. L'élève est sur la bonne course. Vérifions s'il s'agit du bon arrêt !
    const expectedStop = affectationResult[0];
    const carGps = this.latestCarGps.get(this.gpsKey(tenantDetails.organisationId, car.id));
    let distanceMetres: number | undefined;

    if (carGps) {
      const stopLat = parseFloat(expectedStop.stopLatitude);
      const stopLng = parseFloat(expectedStop.stopLongitude);

      if (!isNaN(stopLat) && !isNaN(stopLng)) {
        const distance = this.calculateHaversine(carGps.lat, carGps.lng, stopLat, stopLng);
        distanceMetres = Math.round(distance * 1000);

        // Si le bus est à plus de 500 mètres de l'arrêt théorique de l'élève
        if (distance > 0.5) {
          const errorMsg = `L'élève ${child.firstName} ${child.lastName} a badgé sur le bus ${car.plateNumber} à ${distance.toFixed(2)} km de son arrêt théorique "${expectedStop.stopName}".`;
          
          const critAlerte = alerteCritiqueRepo.create({
            type: 'MAUVAIS_ARRET',
            severity: 'HIGH',
            message: errorMsg,
            childId: child.id,
            childName: `${child.firstName} ${child.lastName}`,
            childEmpCode: child.empCode,
            detectedCarId: car.id,
            detectedCarPlate: car.plateNumber,
            terminalSn,
            detectedCourseId: activeCourse.id,
            expectedStopId: expectedStop.pointId,
            expectedStopName: expectedStop.stopName,
            punchTime: now,
          });
          await alerteCritiqueRepo.save(critAlerte);

          this.eventEmitter.emit('hardware.critical_anomaly', {
            tenantId: tenantDetails.organisationId,
            courseId: activeCourse.id,
            data: {
              type: 'MAUVAIS_ARRET',
              childId: child.id,
              childName: `${child.firstName} ${child.lastName}`,
              detectedCarPlate: car.plateNumber,
              message: errorMsg,
              time: now.toISOString(),
              detectedCourseId: activeCourse.id,
              expectedStopName: expectedStop.stopName,
              distance: parseFloat(distance.toFixed(2)),
            },
          });

          return {
            statut: MonteeStatut.REFUSE,
            message: errorMsg,
            pointId: expectedStop.pointId,
            distanceMetres,
          };
        }
      }
    }

    return {
      statut: MonteeStatut.VALIDE,
      message: `Pointage conforme à l'arrêt « ${expectedStop.stopName} ».`,
      pointId: expectedStop.pointId,
      distanceMetres,
    };
  }

  // --- TRACCAR INTEGRATION ---
  
  public async handleTraccarStream(payload: any) {
    this.logger.debug("Received Traccar Payload: " + JSON.stringify(payload));
    let deviceId;
    let lat, lng, speed, time;

    // Traccar Webhook structure depends on the event (positions vs events)
    // Often it sends position wrapped in a 'position' object.
    if (payload.position) {
       deviceId = payload.device?.uniqueId || payload.position.deviceId;
       lat = payload.position.latitude;
       lng = payload.position.longitude;
       speed = payload.position.speed;
       time = payload.position.deviceTime || payload.position.fixTime || new Date().toISOString();
    } else if (payload.uniqueId) { // Forward payload style
       deviceId = payload.uniqueId;
       lat = payload.latitude;
       lng = payload.longitude;
       speed = payload.speed;
       time = payload.deviceTime || new Date().toISOString();
    }

    if (!deviceId) return { success: false, message: 'No device ID found in Traccar payload' };
    if (!lat || !lng) return { success: false, message: 'No coordinates in payload' };

    try {
      await this.ensureDeviceRegistered(deviceId, 'GPS');

      const resolution = await this.resolveTenantForDevice(deviceId);
      if (resolution.state === 'pending') {
        return this.pendingResponse(deviceId);
      }

      const org = resolution.tenant;
      const ds = await this.getTenantDataSource(org);
      const carRepo = ds.getRepository(Car);
      
      const car = await carRepo.findOne({ where: { gpsDeviceId: deviceId } });
      if (car) {
         this.latestCarGps.set(this.gpsKey(org.organisationId, car.id), {
           organisationId: org.organisationId,
           lat,
           lng,
           speed,
           time,
           carId: car.id,
           plateNumber: car.plateNumber,
         });
         this.logger.log(`Traccar GPS updated for car ${car.plateNumber} (Lat: ${lat}, Lng: ${lng})`);
      } else {
         this.logger.warn(`No car mapped to Traccar device ID ${deviceId}`);
      }
      return { success: true };
    } catch (e) {
      this.logger.error("Error processing Traccar stream: " + e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Positions en direct des bus d'UNE école.
   *
   * `organisationId` est obligatoire et provient toujours d'un JWT vérifié : il n'existe
   * volontairement aucune façon d'obtenir par cet appel les positions de toutes les écoles.
   */
  public getLiveLocations(organisationId: string): LiveCarPosition[] {
    if (!organisationId) return [];
    return Array.from(this.latestCarGps.values()).filter(
      (position) => position.organisationId === organisationId,
    );
  }

}
