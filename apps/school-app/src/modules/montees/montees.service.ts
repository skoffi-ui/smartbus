import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TenantService } from '../tenant/tenant.service';
import { Montee, Alerte, MonteeStatut, SensPointage, sensFromPunchState, TypeAlerte, Child, Car, Course, Affectation, CourseStatus } from '@app/database';
import { NotificationsGateway } from '../notifications/notifications.gateway';

export const VALIDATION_QUEUE = 'biotime_validations_queue';

@Injectable()
export class MonteesService {
  private readonly logger = new Logger(MonteesService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly notificationsGateway: NotificationsGateway,
    @InjectQueue(VALIDATION_QUEUE) private readonly validationQueue: Queue,
  ) {}

  private async getRepo<T extends object>(entity: new () => T, tenantId?: string): Promise<Repository<T>> {
    const ds = await this.tenantService.getDataSource(tenantId);
    return ds.getRepository<T>(entity as any);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LECTURE
  // ─────────────────────────────────────────────────────────────────────────

  async findAll(): Promise<Montee[]> {
    const repo = await this.getRepo(Montee);
    return repo.find({
      relations: { child: true, course: true, car: true, point: true },
      order: { date: 'DESC', heure: 'DESC' },
      take: 200,
    });
  }

  async findByChild(childId: string): Promise<Montee[]> {
    const repo = await this.getRepo(Montee);
    return repo.find({
      where: { childId },
      relations: { course: true, car: true, point: true },
      order: { date: 'DESC' },
      take: 50,
    });
  }

  async findAlertes(): Promise<Alerte[]> {
    const repo = await this.getRepo(Alerte);
    return repo.find({
      relations: { course: true, child: true, car: true },
      order: { date: 'DESC', heure: 'DESC' },
      take: 100,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATION ASYNCHRONE (via BullMQ)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Point d'entrée de la validation biométrique.
   * NE BLOQUE PAS : place un job dans la queue BullMQ et retourne immédiatement.
   * La logique lourde est traitée dans ValidationProcessor.
   */
  async enqueueValidation(payload: {
    empCode: string;
    terminalSn: string;
    gpsLat?: number;
    gpsLng?: number;
    punchTime: string;
    /** `punch_state` BioTime : détermine le sens (montée / descente). */
    punchState?: string;
    tenantId?: string;
  }): Promise<{ queued: true; jobId: string }> {
    const job = await this.validationQueue.add('validate', payload, {
      attempts: 3,            // 3 tentatives en cas d'échec
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 500,
      removeOnFail: 100,
    });
    this.logger.log(`[BullMQ] Job de validation en file (id: ${job.id}) pour empCode: ${payload.empCode}`);
    return { queued: true, jobId: String(job.id) };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIQUE MÉTIER (appelée par ValidationProcessor)
  // ─────────────────────────────────────────────────────────────────────────

  async processValidationJob(payload: {
    empCode: string;
    terminalSn: string;
    gpsLat?: number;
    gpsLng?: number;
    punchTime: string;
    punchState?: string;
    tenantId?: string;
  }): Promise<void> {
    const { empCode, terminalSn, gpsLat, gpsLng, punchTime, punchState, tenantId } = payload;
    const sens = sensFromPunchState(punchState);
    this.logger.log(`[Worker] Traitement badge : empCode=${empCode}, terminal=${terminalSn}`);

    const childRepo = await this.getRepo(Child, tenantId);
    const carRepo = await this.getRepo(Car, tenantId);
    const courseRepo = await this.getRepo(Course, tenantId);
    const affectationRepo = await this.getRepo(Affectation, tenantId);

    // 1. Trouver l'enfant via son empCode BioTime
    const child = await childRepo.findOne({ where: { empCode } });
    if (!child) {
      this.logger.warn(`[Worker] Enfant non trouvé pour empCode: ${empCode}`);
      return;
    }

    // 2. Trouver le car via le numéro de série du terminal
    const car = await carRepo.findOne({ where: { biotimeTerminalSn: terminalSn } });

    // 3. Trouver la course active pour ce car
    const activeCourse = await courseRepo.findOne({
      where: { statut: CourseStatus.ACTIVE, ...(car ? { carId: car.id } : {}) },
    });

    if (!activeCourse) {
      await this.saveAlerte(TypeAlerte.COURSE_INACTIVE, 'Aucune course active pour ce véhicule', child, car ?? undefined, undefined, tenantId);
      return;
    }

    // 4. Vérifier l'affectation enfant → point
    const affectation = await affectationRepo.findOne({
      where: { childId: child.id },
      relations: { pointRecuperation: true },
    });

    if (!affectation?.pointRecuperation) {
      await this.saveAlerte(TypeAlerte.ENFANT_NON_AFFECTE, 'Enfant non affecté à aucun point', child, car ?? undefined, activeCourse, tenantId);
      return;
    }

    const point = affectation.pointRecuperation;

    // 5. Calcul de distance Haversine
    const distance =
      gpsLat && gpsLng
        ? this.haversineDistance(gpsLat, gpsLng, point.latitude, point.longitude)
        : 0;

    const rayonDetection = (point as any).rayonDetection ?? 30;

    // 6. Décision : valider ou refuser
    if (distance > rayonDetection) {
      await this.saveAlerte(
        TypeAlerte.GPS_HORS_ZONE,
        `Badge à ${Math.round(distance)}m du point (tolérance: ${rayonDetection}m)`,
        child, car ?? undefined, activeCourse, tenantId,
      );
      await this.saveMontee(child, activeCourse, car ?? undefined, point.id, distance, MonteeStatut.REFUSE, 'Hors zone GPS', tenantId, sens);
    } else {
      await this.saveMontee(child, activeCourse, car ?? undefined, point.id, distance, MonteeStatut.VALIDE, 'OK', tenantId, sens);
    }

    // 7. Notifier en temps réel via WebSocket
    this.notificationsGateway.sendPunchNotificationToParent(child.id, {
      childId: child.id,
      childName: `${child.firstName} ${child.lastName}`,
      statut: distance > rayonDetection ? MonteeStatut.REFUSE : MonteeStatut.VALIDE,
      punchTime,
      carPlate: car?.plateNumber,
      pointNom: point.nom,
      distance: Math.round(distance),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVÉS
  // ─────────────────────────────────────────────────────────────────────────

  private async saveMontee(
    child: Child, course: Course, car: Car | undefined,
    pointId: string, distance: number,
    statut: MonteeStatut, msg: string, tenantId?: string,
    sens: SensPointage = SensPointage.MONTEE,
  ): Promise<void> {
    const repo = await this.getRepo(Montee, tenantId);
    const montee = repo.create({
      childId: child.id,
      courseId: course.id,
      carId: car?.id,
      pointId,
      date: new Date(),
      heure: new Date().toTimeString().substring(0, 8),
      distanceGps: distance,
      sens,
      statut,
      validationMessage: msg,
    });
    await repo.save(montee);
  }

  private async saveAlerte(
    type: TypeAlerte, description: string,
    child?: Child, car?: Car, course?: Course, tenantId?: string,
  ): Promise<void> {
    const repo = await this.getRepo(Alerte, tenantId);
    const alerte = repo.create({
      type, description,
      childId: child?.id,
      carId: car?.id,
      courseId: course?.id,
      date: new Date() as any,
      heure: new Date().toTimeString().substring(0, 8),
    } as any);
    await repo.save(alerte);
    this.logger.warn(`[Alerte] ${type}: ${description}`);
  }

  /** Formule Haversine pour calculer la distance GPS en mètres */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
