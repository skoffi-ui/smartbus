import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantService } from '../tenant/tenant.service';
import { Affectation } from '@app/database';
import { CreateAffectationDto } from './dto/create-affectation.dto';

@Injectable()
export class AffectationsService {
  private readonly logger = new Logger(AffectationsService.name);

  constructor(private readonly tenantService: TenantService) {}

  private async getRepo(): Promise<Repository<Affectation>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(Affectation);
  }

  async findAll(): Promise<Affectation[]> {
    const repo = await this.getRepo();
    return repo.find({
      relations: { child: true, pointRecuperation: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findByChild(childId: string): Promise<Affectation | null> {
    const repo = await this.getRepo();
    return repo.findOne({
      where: { childId },
      relations: { pointRecuperation: true },
    });
  }

  async findByPoint(pointId: string): Promise<Affectation[]> {
    const repo = await this.getRepo();
    return repo.find({
      where: { pointId },
      relations: { child: true },
      order: { ordreMontee: 'ASC' },
    });
  }

  async create(dto: CreateAffectationDto): Promise<Affectation> {
    const repo = await this.getRepo();

    // Vérifier si l'enfant est déjà affecté à un point
    const existing = await this.findByChild(dto.childId);
    if (existing) {
      throw new ConflictException(
        `L'enfant ${dto.childId} est déjà affecté au point ${existing.pointId}. Veuillez d'abord supprimer l'affectation existante.`
      );
    }

    const affectation = repo.create(dto as Partial<Affectation>);
    const saved = await repo.save(affectation);
    this.logger.log(`Affectation créée : enfant ${dto.childId} → point ${dto.pointId}`);
    return saved as Affectation;
  }

  async delete(id: string): Promise<void> {
    const repo = await this.getRepo();
    const result = await repo.delete(id);
    if (result.affected === 0) throw new NotFoundException(`Affectation ${id} introuvable`);
    this.logger.log(`Affectation supprimée : ${id}`);
  }

  async deleteByChild(childId: string): Promise<void> {
    const repo = await this.getRepo();
    await repo.delete({ childId });
    this.logger.log(`Affectation(s) de l'enfant ${childId} supprimées`);
  }
}
