import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantService } from '../tenant/tenant.service';
import { 
  Course, 
  Trajet, 
  PointRecuperation, 
  Affectation, 
  Montee, 
  Alerte,
  Child,
  Car,
  TypeAlerte,
  MonteeStatut,
  CourseStatus
} from '@app/database';

@Injectable()
export class TransportService {
  private readonly logger = new Logger(TransportService.name);

  constructor(private readonly tenantService: TenantService) {}

  // --- Dynamic Repositories ---
  private async getCourseRepo(): Promise<Repository<Course>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(Course);
  }

  private async getTrajetRepo(): Promise<Repository<Trajet>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(Trajet);
  }

  private async getPointRepo(): Promise<Repository<PointRecuperation>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(PointRecuperation);
  }

  private async getAffectationRepo(): Promise<Repository<Affectation>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(Affectation);
  }

  private async getMonteeRepo(): Promise<Repository<Montee>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(Montee);
  }

  private async getAlerteRepo(): Promise<Repository<Alerte>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(Alerte);
  }

  private async getChildRepo(): Promise<Repository<Child>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(Child);
  }

  private async getCarRepo(): Promise<Repository<Car>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(Car);
  }

  // --- Courses ---
  async findAllCourses(): Promise<Course[]> {
    const repo = await this.getCourseRepo();
    return repo.find({ relations: { trajet: true } });
  }

  async findCourseById(id: string): Promise<Course> {
    const repo = await this.getCourseRepo();
    const course = await repo.findOne({ where: { id }, relations: { trajet: true } });
    if (!course) throw new NotFoundException('Course introuvable');
    return course;
  }

  async createCourse(data: any): Promise<Course> {
    const repo = await this.getCourseRepo();
    const course = repo.create(data as Partial<Course>);
    return repo.save(course) as Promise<Course>;
  }

  async updateCourse(id: string, data: any): Promise<Course> {
    const repo = await this.getCourseRepo();
    const course = await this.findCourseById(id);
    Object.assign(course, data);
    return repo.save(course);
  }

  async deleteCourse(id: string): Promise<void> {
    const repo = await this.getCourseRepo();
    await repo.delete(id);
  }

  // --- Trajets & Points ---
  async createTrajet(data: any): Promise<Trajet> {
    const repo = await this.getTrajetRepo();
    const trajet = repo.create(data as Partial<Trajet>);
    return repo.save(trajet) as Promise<Trajet>;
  }

  async updateTrajet(id: string, data: any): Promise<Trajet> {
    const repo = await this.getTrajetRepo();
    const trajet = await repo.findOneOrFail({ where: { id } });
    Object.assign(trajet, data);
    return repo.save(trajet);
  }

  async createPoint(data: any): Promise<PointRecuperation> {
    const repo = await this.getPointRepo();
    const point = repo.create(data as Partial<PointRecuperation>);
    return repo.save(point) as Promise<PointRecuperation>;
  }

  async getPointsByCourseId(courseId: string): Promise<PointRecuperation[]> {
    const trajetRepo = await this.getTrajetRepo();
    const pointRepo = await this.getPointRepo();
    
    // Chercher un trajet lié à cette course via Course.trajetId
    const courseRepo = await this.getCourseRepo();
    const course = await courseRepo.findOne({ where: { id: courseId } });
    if (!course || !course.trajetId) {
      return [];
    }
    return pointRepo.find({
      where: { trajetId: course.trajetId },
      order: { ordrePassage: 'ASC' }
    });
  }

  async createPointForCourse(courseId: string, data: any): Promise<PointRecuperation> {
    const pointRepo = await this.getPointRepo();
    const courseRepo = await this.getCourseRepo();

    // Trouver la course pour récupérer le trajetId associé
    const course = await courseRepo.findOne({ where: { id: courseId } });
    if (!course || !course.trajetId) {
      throw new NotFoundException(`Aucun trajet associé à la course ${courseId}. Veuillez d'abord lier un trajet à cette course.`);
    }
    
    // Créer le point de récupération lié au trajet de la course
    const point = pointRepo.create({
      ...data,
      trajetId: course.trajetId,
    });
    return pointRepo.save(point) as unknown as Promise<PointRecuperation>;
  }

  async deletePoint(id: string): Promise<void> {
    const repo = await this.getPointRepo();
    await repo.delete(id);
  }

  // --- Affectations ---
  async createAffectation(data: any): Promise<Affectation> {
    const repo = await this.getAffectationRepo();
    const affectation = repo.create(data as Partial<Affectation>);
    return repo.save(affectation) as Promise<Affectation>;
  }

  // --- Historique & Alertes ---
  async getMontees(): Promise<Montee[]> {
    const repo = await this.getMonteeRepo();
    return repo.find({
      relations: { child: true, course: true, car: true, point: true },
      order: { date: 'DESC', heure: 'DESC' }
    });
  }

  async getAlertes(): Promise<Alerte[]> {
    const repo = await this.getAlerteRepo();
    return repo.find({
      relations: { course: true, child: true, car: true },
      order: { date: 'DESC', heure: 'DESC' }
    });
  }

  // --- Validation Biométrique ---
  async processValidation(data: { id_enfant: string, terminal: string, gps_lat?: number, gps_lng?: number, heure?: string }) {
    this.logger.log(`Traitement badge enfant: ${data.id_enfant} sur terminal ${data.terminal}`);
    
    const childRepo = await this.getChildRepo();
    const carRepo = await this.getCarRepo();
    const courseRepo = await this.getCourseRepo();
    const affectationRepo = await this.getAffectationRepo();

    // 1. Récupérer l'enfant
    const child = await childRepo.findOne({ where: { id: data.id_enfant } });
    if (!child) {
      this.logger.warn(`Enfant non trouvé: ${data.id_enfant}`);
      return;
    }

    // 2. Trouver le car lié au terminal
    const car = await carRepo.findOne({ where: { biotimeTerminalSn: data.terminal } });
    
    // 3. Retrouver la course active
    const activeCourse = await courseRepo.findOne({ 
      where: { statut: CourseStatus.ACTIVE, carId: car?.id } 
    });

    const now = new Date();
    const currentTime = data.heure || `${now.getHours()}:${now.getMinutes()}`;

    if (!activeCourse) {
      await this.createAlerte(TypeAlerte.COURSE_INACTIVE, "Aucune course active trouvée pour ce véhicule", child, car as any, undefined as any);
      return;
    }

    // 4. Vérifier l'affectation
    const affectation = await affectationRepo.findOne({ 
      where: { childId: child.id }, 
      relations: { pointRecuperation: true } 
    });

    if (!affectation) {
      await this.createAlerte(TypeAlerte.ENFANT_NON_AFFECTE, "L'enfant n'est affecté à aucun point", child, car as any, activeCourse);
      return;
    }

    // 5. Calcul distance (Haversine)
    let distance = 0;
    if (data.gps_lat && data.gps_lng && affectation.pointRecuperation) {
      distance = this.calculateDistance(
        data.gps_lat, data.gps_lng, 
        affectation.pointRecuperation.latitude, affectation.pointRecuperation.longitude
      );
    }

    // Conditions de validation
    if (distance > 30) {
      // Tolérance 30 mètres
      await this.createAlerte(TypeAlerte.GPS_HORS_ZONE, `Validation à ${Math.round(distance)}m du point d'arrêt`, child, car as any, activeCourse);
      await this.recordMontee(child, activeCourse, (car || undefined) as any, affectation.pointRecuperation.id, distance, MonteeStatut.REFUSE, "Hors zone");
    } else {
      await this.recordMontee(child, activeCourse, (car || undefined) as any, affectation.pointRecuperation.id, distance, MonteeStatut.VALIDE, "OK");
    }
  }

  private async createAlerte(type: TypeAlerte, description: string, child?: Child, car?: Car, course?: Course): Promise<void> {
    const alerteRepo = await this.getAlerteRepo();
    const alerte = alerteRepo.create({
      type,
      description,
      childId: child?.id,
      carId: car?.id,
      courseId: course?.id,
      date: new Date() as any,
      heure: new Date().toISOString().split('T')[1].substring(0, 8),
    } as any);
    await alerteRepo.save(alerte);
  }

  private async recordMontee(child: Child, course: Course, car: Car, pointId: string, distance: number, statut: MonteeStatut, msg: string) {
    const monteeRepo = await this.getMonteeRepo();
    const montee = monteeRepo.create({
      childId: child.id,
      courseId: course.id,
      carId: car?.id,
      pointId: pointId,
      date: new Date(),
      heure: `${new Date().getHours()}:${new Date().getMinutes()}`,
      distanceGps: distance,
      statut,
      validationMessage: msg
    });
    await monteeRepo.save(montee);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }
}
