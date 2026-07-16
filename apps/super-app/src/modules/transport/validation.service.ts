import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  Course, 
  Child, 
  Car, 
  Montee, 
  Alerte, 
  TypeAlerte, 
  MonteeStatut,
  CourseStatus,
  Affectation
} from '@app/database';
// Importation du service biotime existant si nécessaire
// import { BiotimeService } from '../biotime/biotime.service';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
    @InjectRepository(Car)
    private readonly carRepository: Repository<Car>,
    @InjectRepository(Montee)
    private readonly monteeRepository: Repository<Montee>,
    @InjectRepository(Alerte)
    private readonly alerteRepository: Repository<Alerte>,
    @InjectRepository(Affectation)
    private readonly affectationRepository: Repository<Affectation>,
    // private readonly biotimeService: BiotimeService,
  ) {}

  /**
   * Méthode appelée lorsqu'un enfant badge
   */
  async processValidation(data: { id_enfant: string, terminal: string, gps_lat?: number, gps_lng?: number, heure?: string }) {
    this.logger.log(`Traitement badge enfant: ${data.id_enfant} sur terminal ${data.terminal}`);
    
    // 1. Récupérer l'enfant
    const child = await this.childRepository.findOne({ where: { id: data.id_enfant } });
    if (!child) {
      this.logger.warn(`Enfant non trouvé: ${data.id_enfant}`);
      return;
    }

    // 2. Trouver le car lié au terminal (si applicable)
    const car = await this.carRepository.findOne({ where: { biotimeTerminalSn: data.terminal } });
    
    // 3. Retrouver la course active (simplifié)
    const activeCourse = await this.courseRepository.findOne({ 
      where: { statut: CourseStatus.ACTIVE, carId: car?.id } 
    });

    const now = new Date();
    const currentTime = data.heure || `${now.getHours()}:${now.getMinutes()}`;

    if (!activeCourse) {
      await this.createAlerte(TypeAlerte.COURSE_INACTIVE, "Aucune course active trouvée pour ce véhicule", child, car as any, undefined as any);
      return;
    }

    // 4. Vérifier l'affectation
    const affectation = await this.affectationRepository.findOne({ 
      where: { childId: child.id }, 
      relations: { pointRecuperation: true } 
    });

    if (!affectation) {
      await this.createAlerte(TypeAlerte.ENFANT_NON_AFFECTE, "L'enfant n'est affecté à aucun point", child, car as any, activeCourse);
      return;
    }

    // 5. Calcul distance (Haversine simple si pas PostGIS)
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
      // On peut tout de même enregistrer la montée mais en "refusé" ou avec avertissement
      await this.recordMontee(child, activeCourse, (car || undefined) as any, affectation.pointRecuperation.id, distance, MonteeStatut.REFUSE, "Hors zone");
    } else {
      // Validation OK
      await this.recordMontee(child, activeCourse, (car || undefined) as any, affectation.pointRecuperation.id, distance, MonteeStatut.VALIDE, "OK");
    }
  }

  private async createAlerte(type: TypeAlerte, description: string, child?: Child, car?: Car, course?: Course): Promise<void> {
    const alerte = this.alerteRepository.create({
      type,
      description,
      childId: child?.id,
      carId: car?.id,
      courseId: course?.id,
      date: new Date() as any,
      heure: new Date().toISOString().split('T')[1].substring(0, 8),
    } as any);
    await this.alerteRepository.save(alerte);
  }

  private async recordMontee(child: Child, course: Course, car: Car, pointId: string, distance: number, statut: MonteeStatut, msg: string) {
    const montee = this.monteeRepository.create({
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
    await this.monteeRepository.save(montee);
  }

  /**
   * Distance de Haversine en mètres
   */
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
