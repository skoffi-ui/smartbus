import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantService } from '../tenant/tenant.service';
import { PointRecuperation } from '@app/database';
import { CreatePointDto } from './dto/create-point.dto';

@Injectable()
export class PointsRecuperationService {
  private readonly logger = new Logger(PointsRecuperationService.name);

  constructor(private readonly tenantService: TenantService) {}

  private async getRepo(): Promise<Repository<PointRecuperation>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(PointRecuperation);
  }

  async findByTrajet(trajetId: string): Promise<PointRecuperation[]> {
    const repo = await this.getRepo();
    return repo.find({
      where: { trajetId },
      order: { ordrePassage: 'ASC' },
    });
  }

  async findById(id: string): Promise<PointRecuperation> {
    const repo = await this.getRepo();
    const point = await repo.findOne({ where: { id } });
    if (!point) throw new NotFoundException(`Point de récupération ${id} introuvable`);
    return point;
  }

  async create(dto: CreatePointDto): Promise<PointRecuperation> {
    const repo = await this.getRepo();
    const point = repo.create({
      ...dto,
      rayonDetection: dto.rayonDetection ?? 30, // Valeur par défaut: 30 mètres
    } as Partial<PointRecuperation>);
    const saved = await repo.save(point);
    this.logger.log(`Point créé : ${saved.id} - ${saved.nom} (trajet: ${dto.trajetId})`);
    return saved as PointRecuperation;
  }

  async update(id: string, dto: Partial<CreatePointDto>): Promise<PointRecuperation> {
    const repo = await this.getRepo();
    const point = await this.findById(id);
    Object.assign(point, dto);
    return repo.save(point);
  }

  async delete(id: string): Promise<void> {
    const repo = await this.getRepo();
    await repo.delete(id);
    this.logger.log(`Point supprimé : ${id}`);
  }

  /**
   * Recalcule et sauvegarde l'ordre de passage d'une liste de points.
   * Appelé depuis le frontend quand l'utilisateur réordonne les arrêts.
   */
  async reorder(pointIds: string[]): Promise<void> {
    const repo = await this.getRepo();
    const updates = pointIds.map((id, index) =>
      repo.update(id, { ordrePassage: index + 1 }),
    );
    await Promise.all(updates);
    this.logger.log(`Réordonnancement de ${pointIds.length} points effectué`);
  }
}
