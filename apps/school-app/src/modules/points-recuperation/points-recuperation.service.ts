import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantService } from '../tenant/tenant.service';
import { PointRecuperation, Trajet, TrajetSens } from '@app/database';
import { CreatePointDto } from './dto/create-point.dto';

@Injectable()
export class PointsRecuperationService {
  private readonly logger = new Logger(PointsRecuperationService.name);

  constructor(private readonly tenantService: TenantService) {}

  private async getRepo(): Promise<Repository<PointRecuperation>> {
    const ds = await this.tenantService.getDataSource();
    return ds.getRepository(PointRecuperation);
  }

  /**
   * Points d'un trajet, ou tous les points de l'école si `trajetId` est omis
   * (paramètre optionnel).
   *
   * `pourAffectation` : cet endpoint est partagé par 3 usages très
   * différents (édition du trajet dans `TrajetEditor.tsx`, carte live dans
   * `LiveTracking.tsx`, choix du point à affecter dans `AffectationEleves.tsx`)
   * — filtrer sans distinction casserait les deux premiers. Seul le 3e passe
   * ce drapeau : le point d'arrivée n'y est un point de récupération que si
   * le trajet est `mixte` (le point reste par ailleurs visible/éditable
   * normalement partout ailleurs).
   */
  async findByTrajet(
    trajetId?: string,
    pourAffectation = false,
  ): Promise<PointRecuperation[]> {
    const repo = await this.getRepo();
    const points = await repo.find({
      where: trajetId ? { trajetId } : {},
      order: { ordrePassage: 'ASC' },
    });

    if (!pourAffectation || !trajetId) return points;

    const ds = await this.tenantService.getDataSource();
    const trajet = await ds
      .getRepository(Trajet)
      .findOne({ where: { id: trajetId } });
    if (trajet?.sens === TrajetSens.MIXTE) return points;

    return points.filter((p) => p.type !== 'arrivee');
  }

  async findById(id: string): Promise<PointRecuperation> {
    const repo = await this.getRepo();
    const point = await repo.findOne({ where: { id } });
    if (!point)
      throw new NotFoundException(`Point de récupération ${id} introuvable`);
    return point;
  }

  async create(dto: CreatePointDto): Promise<PointRecuperation> {
    const repo = await this.getRepo();
    const point = repo.create({
      ...dto,
      rayonDetection: dto.rayonDetection ?? 100, // 100 m : marge réaliste pour un GPS embarqué
    } as Partial<PointRecuperation>);
    const saved = await repo.save(point);
    this.logger.log(
      `Point créé : ${saved.id} - ${saved.nom} (trajet: ${dto.trajetId})`,
    );
    return saved as PointRecuperation;
  }

  async update(
    id: string,
    dto: Partial<CreatePointDto>,
  ): Promise<PointRecuperation> {
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
