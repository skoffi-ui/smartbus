import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { Course, CourseStatus } from '@app/database';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Repository } from 'typeorm';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly tenantService: TenantService) {}

  private async getRepo(): Promise<Repository<Course>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(Course);
  }

  async findAll(): Promise<Course[]> {
    const repo = await this.getRepo();
    return repo.find({
      relations: { trajet: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Course> {
    const repo = await this.getRepo();
    const course = await repo.findOne({
      where: { id },
      relations: { trajet: true },
    });
    if (!course) throw new NotFoundException(`Course ${id} introuvable`);
    return course;
  }

  async findActive(): Promise<Course[]> {
    const repo = await this.getRepo();
    return repo.find({
      where: { statut: CourseStatus.ACTIVE },
      relations: { trajet: true },
    });
  }

  async create(dto: CreateCourseDto): Promise<Course> {
    const repo = await this.getRepo();
    const course = repo.create(dto as Partial<Course>);
    const saved = await repo.save(course);
    this.logger.log(`Course créée : ${saved.id} - ${saved.nom}`);
    return saved as Course;
  }

  async update(id: string, dto: UpdateCourseDto): Promise<Course> {
    const repo = await this.getRepo();
    const course = await this.findById(id);
    Object.assign(course, dto);
    return repo.save(course);
  }

  async updateStatus(id: string, statut: CourseStatus): Promise<Course> {
    return this.update(id, { statut });
  }

  async delete(id: string): Promise<void> {
    const repo = await this.getRepo();
    await repo.delete(id);
    this.logger.log(`Course supprimée : ${id}`);
  }
}
