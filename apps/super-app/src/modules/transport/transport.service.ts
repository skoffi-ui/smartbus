import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  Course, 
  Trajet, 
  PointRecuperation, 
  Affectation, 
  Montee, 
  Alerte
} from '@app/database';

@Injectable()
export class TransportService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Trajet)
    private readonly trajetRepository: Repository<Trajet>,
    @InjectRepository(PointRecuperation)
    private readonly pointRepository: Repository<PointRecuperation>,
    @InjectRepository(Affectation)
    private readonly affectationRepository: Repository<Affectation>,
    @InjectRepository(Montee)
    private readonly monteeRepository: Repository<Montee>,
    @InjectRepository(Alerte)
    private readonly alerteRepository: Repository<Alerte>,
  ) {}

  // --- Courses ---
  async findAllCourses(): Promise<Course[]> {
    return this.courseRepository.find({ relations: { car: true } });
  }

  async findCourseById(id: string): Promise<Course> {
    const course = await this.courseRepository.findOne({ where: { id }, relations: { car: true } });
    if (!course) throw new NotFoundException('Course introuvable');
    return course;
  }

  async createCourse(data: any): Promise<Course> {
    const course = this.courseRepository.create(data as Partial<Course>);
    return this.courseRepository.save(course) as Promise<Course>;
  }

  async updateCourse(id: string, data: any): Promise<Course> {
    await this.courseRepository.update(id, data);
    return this.findCourseById(id);
  }

  async deleteCourse(id: string): Promise<void> {
    await this.courseRepository.delete(id);
  }

  // --- Trajets & Points ---
  async createTrajet(data: any): Promise<Trajet> {
    const trajet = this.trajetRepository.create(data as Partial<Trajet>);
    return this.trajetRepository.save(trajet) as Promise<Trajet>;
  }

  async updateTrajet(id: string, data: any): Promise<Trajet> {
    await this.trajetRepository.update(id, data);
    return this.trajetRepository.findOneOrFail({ where: { id } });
  }

  async createPoint(data: any): Promise<PointRecuperation> {
    const point = this.pointRepository.create(data as Partial<PointRecuperation>);
    return this.pointRepository.save(point) as Promise<PointRecuperation>;
  }

  async getPointsByCourseId(courseId: string): Promise<PointRecuperation[]> {
    let trajet = await this.trajetRepository.findOne({ where: { courseId } });
    if (!trajet) {
      return [];
    }
    return this.pointRepository.find({
      where: { trajetId: trajet.id },
      order: { ordrePassage: 'ASC' }
    });
  }

  async createPointForCourse(courseId: string, data: any): Promise<PointRecuperation> {
    // 1. Trouver ou créer le Trajet lié à cette Course
    let trajet = await this.trajetRepository.findOne({ where: { courseId } });
    if (!trajet) {
      trajet = this.trajetRepository.create({ courseId });
      trajet = await this.trajetRepository.save(trajet);
    }
    
    // 2. Créer le point de récupération lié à ce trajet
    const point = this.pointRepository.create({
      ...data,
      trajetId: trajet.id,
    });
    return this.pointRepository.save(point) as unknown as Promise<PointRecuperation>;
  }

  async deletePoint(id: string): Promise<void> {
    await this.pointRepository.delete(id);
  }

  // --- Affectations ---
  async createAffectation(data: any): Promise<Affectation> {
    const affectation = this.affectationRepository.create(data as Partial<Affectation>);
    return this.affectationRepository.save(affectation) as Promise<Affectation>;
  }

  async getAffectationsByPoint(pointId: string): Promise<Affectation[]> {
    return this.affectationRepository.find({ 
      where: { pointId },
      relations: { child: true },
      order: { ordreMontee: 'ASC' }
    });
  }

  // --- Historique & Alertes ---
  async getMontees(): Promise<Montee[]> {
    return this.monteeRepository.find({
      relations: { child: true, course: true, car: true, point: true },
      order: { date: 'DESC', heure: 'DESC' }
    });
  }

  async getAlertes(): Promise<Alerte[]> {
    return this.alerteRepository.find({
      relations: { course: true, child: true, car: true },
      order: { date: 'DESC', heure: 'DESC' }
    });
  }
}
