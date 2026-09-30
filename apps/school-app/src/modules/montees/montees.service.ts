import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantService } from '../tenant/tenant.service';
import { Montee, Alerte } from '@app/database';

/**
 * Retiré de ce fichier : `enqueueValidation`/`processValidationJob` (file
 * BullMQ `biotime_validations_queue` + `ValidationProcessor`) et leurs
 * helpers (`saveMontee`, `saveAlerte`, `haversineDistance`).
 *
 * Ce chemin était définitivement inatteignable : `POST /montees/validation`
 * est explicitement bloqué à la gateway (`BLOCKED_ROUTES`,
 * `apps/api-gateway/src/route-table.ts`), et rien dans le dépôt n'appelait
 * `enqueueValidation` en interne. L'ingestion réelle des badgeages passe
 * uniquement par `HardwareStreamService.processZktPunches`/`saveMontee`
 * côté super-app (voir la mémoire de session « chaîne de badgeage qui fait
 * foi »). Ce module dupliquait — avec une logique divergente — la même
 * détection d'anomalies sans jamais être exécuté, tout en gardant une file
 * BullMQ et sa connexion Redis ouvertes pour rien.
 */
@Injectable()
export class MonteesService {
  constructor(private readonly tenantService: TenantService) {}

  private async getRepo<T extends object>(
    entity: new () => T,
    tenantId?: string,
  ): Promise<Repository<T>> {
    const ds = await this.tenantService.getDataSource(tenantId);
    return ds.getRepository<T>(entity as any);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LECTURE — seule partie de ce module réellement atteinte : l'ingestion des
  // badgeages fait foi côté super-app (HardwareStreamService.processZktPunches/
  // saveMontee), pas ici. Voir la note de suppression ci-dessous.
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
}
