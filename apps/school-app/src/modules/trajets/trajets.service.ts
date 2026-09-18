import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantService } from '../tenant/tenant.service';
import { Trajet } from '@app/database';
import { CreateTrajetDto } from './dto/create-trajet.dto';
import { UpdateTrajetDto } from './dto/update-trajet.dto';

@Injectable()
export class TrajetsService {
  private readonly logger = new Logger(TrajetsService.name);

  constructor(private readonly tenantService: TenantService) {}

  private async getRepo(): Promise<Repository<Trajet>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(Trajet);
  }

  async findAll(): Promise<Trajet[]> {
    const repo = await this.getRepo();
    return repo.find({ order: { nom: 'ASC' } });
  }

  async findById(id: string): Promise<Trajet> {
    const repo = await this.getRepo();
    const trajet = await repo.findOne({ where: { id } });
    if (!trajet) throw new NotFoundException(`Trajet ${id} introuvable`);
    return trajet;
  }

  async create(dto: CreateTrajetDto): Promise<Trajet> {
    const repo = await this.getRepo();
    const trajet = repo.create(dto as Partial<Trajet>);
    const saved = await repo.save(trajet);
    this.logger.log(`Trajet créé : ${saved.id} - ${saved.nom}`);
    return saved as Trajet;
  }

  async update(id: string, dto: UpdateTrajetDto): Promise<Trajet> {
    const repo = await this.getRepo();
    const trajet = await this.findById(id);
    Object.assign(trajet, dto);
    return repo.save(trajet);
  }

  /**
   * Met à jour uniquement le tracé GeoJSON d'un trajet.
   * Appelé par le composant MapEditor.tsx du frontend lors du dessin.
   */
  async updateGeoJson(id: string, geoJson: Record<string, any>): Promise<Trajet> {
    const repo = await this.getRepo();
    const trajet = await this.findById(id);
    trajet.geoJson = geoJson;
    return repo.save(trajet);
  }

  async delete(id: string): Promise<void> {
    const repo = await this.getRepo();
    await repo.delete(id);
    this.logger.log(`Trajet supprimé : ${id}`);
  }
}
