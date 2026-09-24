import { Injectable, NotFoundException, ConflictException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Child, BiotimeSyncStatus } from '@app/database/tenant-entities/child.entity';
import { CreateChildDto, UpdateChildDto } from './dto/children.dto';
import { TenantService } from '../tenant/tenant.service';
import { Parent } from '@app/database/tenant-entities/parent.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ChildrenService {
  private readonly logger = new Logger(ChildrenService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private urlSuperApp(chemin: string): string {
    const base = this.configService.get<string>('SUPER_APP_URL', 'http://localhost:3000');
    return `${base}/api/v1/biotime/mon-ecole${chemin}`;
  }

  private enTetes(accessToken?: string): { headers: Record<string, string> } {
    return { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} };
  }

  private async getRepo(): Promise<Repository<Child>> {
    const dataSource = await this.tenantService.getDataSource();
    return dataSource.getRepository(Child);
  }

  private async getParentRepo(): Promise<Repository<Parent>> {
    const dataSource = await this.tenantService.getDataSource();
    return dataSource.getRepository(Parent);
  }

  async findAll(): Promise<Child[]> {
    const repo = await this.getRepo();
    return repo.find({ relations: { parent: true }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, accessToken?: string): Promise<Child> {
    const repo = await this.getRepo();
    const child = await repo.findOne({ where: { id }, relations: { parent: true } });
    if (!child) {
      throw new NotFoundException(`Élève ${id} introuvable.`);
    }

    if (!child.photoUrl && child.empCode) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(
            this.urlSuperApp(`/employee/${child.empCode}`),
            this.enTetes(accessToken),
          ),
        );
        if (response.data && response.data.photo) {
          const photo = response.data.photo;
          if (photo.startsWith('http')) {
            child.photoUrl = photo;
          } else if (photo.startsWith('/')) {
            child.photoUrl = `http://160.120.143.20:8080${photo}`;
          } else {
            child.photoUrl = `data:image/jpeg;base64,${photo}`;
          }
          await repo.save(child);
        }
      } catch (err) {
        // Silently ignore if super-app can't find the photo or is down
      }
    }

    return child;
  }

  async create(createChildDto: CreateChildDto, accessToken?: string): Promise<Child> {
    const repo = await this.getRepo();

    if (createChildDto.empCode) {
      const existing = await repo.findOne({ where: { empCode: createChildDto.empCode } });
      if (existing) {
        throw new ConflictException(`Le matricule BioTime ${createChildDto.empCode} est déjà assigné à un autre élève.`);
      }
    }

    if (!createChildDto.dateOfBirth) {
      createChildDto.dateOfBirth = '2015-01-01';
    }

    const child = repo.create({
      ...createChildDto,
      biotimeSyncStatus: BiotimeSyncStatus.PENDING,
    });

    if (createChildDto.parentId) {
      const parentRepo = await this.getParentRepo();
      const parent = await parentRepo.findOne({ where: { id: createChildDto.parentId } });
      if (!parent) {
        throw new NotFoundException(`Parent introuvable.`);
      }
      child.parent = parent;
    }

    const saved = await repo.save(child);

    this.pushSingleToBiotime(repo, saved, accessToken);

    return saved;
  }

  async update(id: string, updateChildDto: UpdateChildDto, accessToken?: string): Promise<Child> {
    const repo = await this.getRepo();
    const child = await this.findOne(id);

    if (updateChildDto.empCode && updateChildDto.empCode !== child.empCode) {
      const existing = await repo.findOne({ where: { empCode: updateChildDto.empCode } });
      if (existing) {
        throw new ConflictException(`Le matricule BioTime ${updateChildDto.empCode} est déjà assigné.`);
      }
    }

    if (updateChildDto.parentId && updateChildDto.parentId !== child.parentId) {
      const parentRepo = await this.getParentRepo();
      const parent = await parentRepo.findOne({ where: { id: updateChildDto.parentId } });
      if (!parent) {
        throw new NotFoundException(`Parent introuvable.`);
      }
      child.parent = parent;
    } else if (updateChildDto.parentId === null) {
      child.parent = null;
    }

    const ancienneClasse = child.className;
    Object.assign(child, updateChildDto);
    if (updateChildDto.parentId) {
      delete (child as any).parentId;
    }

    const saved = await repo.save(child);

    const champsBiotime = ['firstName', 'lastName', 'className', 'empCode'];
    const aChange = champsBiotime.some((k) => updateChildDto[k as keyof UpdateChildDto] !== undefined);
    const classeChangee = updateChildDto.className !== undefined && updateChildDto.className !== ancienneClasse;

    if (aChange || classeChangee) {
      await repo.update(saved.id, { biotimeSyncStatus: BiotimeSyncStatus.PENDING });
      saved.biotimeSyncStatus = BiotimeSyncStatus.PENDING;
      this.pushSingleToBiotime(repo, saved, accessToken);
    }

    return saved;
  }

  async remove(id: string): Promise<void> {
    const repo = await this.getRepo();
    const child = await this.findOne(id);
    await repo.remove(child);
  }

  // ─── Synchronisation SMARTBUS → BioTime ───────────────────────────────────

  /**
   * Push unitaire fire-and-forget vers BioTime via la super-app.
   * Met à jour le biotimeId et le statut de sync après réponse.
   */
  private pushSingleToBiotime(repo: Repository<Child>, child: Child, accessToken?: string): void {
    if (!accessToken) return;

    firstValueFrom(
      this.httpService.post(
        this.urlSuperApp('/push-child'),
        {
          empCode: child.empCode,
          firstName: child.firstName,
          lastName: child.lastName,
          className: child.className,
          biotimeId: child.biotimeId ?? null,
        },
        this.enTetes(accessToken),
      ),
    )
      .then(async (response) => {
        const { biotimeId, action, error } = response.data ?? {};
        if (action === 'skipped' && error) {
          await repo.update(child.id, {
            biotimeSyncStatus: BiotimeSyncStatus.FAILED,
            biotimeSyncError: error,
          });
          return;
        }
        await repo.update(child.id, {
          ...(biotimeId ? { biotimeId } : {}),
          biotimeSyncStatus: BiotimeSyncStatus.SYNCED,
          biotimeSyncError: null as any,
        });
        this.logger.log(
          `[BioTime→] ${child.firstName} ${child.lastName} → ${action} (biotimeId=${biotimeId})`,
        );
      })
      .catch(async (err) => {
        await repo.update(child.id, {
          biotimeSyncStatus: BiotimeSyncStatus.FAILED,
          biotimeSyncError: err.message?.slice(0, 255),
        }).catch(() => {});
        this.logger.warn(`[BioTime→] Push échoué pour ${child.id} : ${err.message}`);
      });
  }

  /**
   * Resynchronise vers BioTime tous les enfants en statut PENDING ou FAILED.
   * Utilise l'endpoint batch (BullMQ) pour ne pas saturer.
   */
  async retryFailedSync(accessToken?: string): Promise<{ enqueued: number }> {
    if (!accessToken) return { enqueued: 0 };

    const repo = await this.getRepo();
    const aSync = await repo.find({
      where: [
        { biotimeSyncStatus: BiotimeSyncStatus.PENDING },
        { biotimeSyncStatus: BiotimeSyncStatus.FAILED },
      ],
    });

    if (aSync.length === 0) return { enqueued: 0 };

    const enfants = aSync.map((c) => ({
      childId: c.id,
      empCode: c.empCode,
      firstName: c.firstName,
      lastName: c.lastName,
      className: c.className,
      biotimeId: c.biotimeId ?? undefined,
    }));

    try {
      await firstValueFrom(
        this.httpService.post(
          this.urlSuperApp('/push-children-batch'),
          { enfants },
          this.enTetes(accessToken),
        ),
      );
      this.logger.log(`[BioTime→] Batch retry de ${enfants.length} enfant(s) mis en file.`);
      return { enqueued: enfants.length };
    } catch (err: any) {
      this.logger.warn(`[BioTime→] Batch retry échoué : ${err.message}`);
      return { enqueued: 0 };
    }
  }

  // ─── Lecture BioTime ──────────────────────────────────────────────────────

  async getPunches(id: string, accessToken?: string): Promise<any[]> {
    const child = await this.findOne(id);
    if (!child.empCode) {
      return [];
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          this.urlSuperApp(`/punches/empcode/${child.empCode}`),
          this.enTetes(accessToken),
        ),
      );
      return response.data;
    } catch (error) {
      console.error(`Erreur lors de la récupération des pointages pour l'enfant ${id}`, error);
      return [];
    }
  }

  async getBiotimeDirectory(accessToken?: string): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.urlSuperApp('/directory'), this.enTetes(accessToken)),
      );
      return response.data || [];
    } catch (error) {
      console.error(`Erreur lors de la récupération du répertoire BioTime`, error);
      throw new HttpException('Erreur de communication avec le serveur central', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async bulkImport(empCodes: string[], accessToken?: string): Promise<any> {
    if (!empCodes || empCodes.length === 0) {
      return { message: 'Aucun matricule fourni', count: 0 };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.urlSuperApp('/directory/bulk'),
          { empCodes },
          this.enTetes(accessToken),
        ),
      );
      const employees = response.data || [];

      const repo = await this.getRepo();
      let importedCount = 0;

      for (const emp of employees) {
        const existing = await repo.findOne({ where: { empCode: emp.empCode } });
        if (!existing) {
          const child = repo.create({
            firstName: emp.firstName,
            lastName: emp.lastName,
            empCode: emp.empCode,
            className: emp.departmentName,
            dateOfBirth: '2015-01-01',
            isActive: true,
            biotimeSyncStatus: BiotimeSyncStatus.SYNCED,
          });

          if (emp.photo) {
            const photo = emp.photo;
            if (photo.startsWith('http')) {
              child.photoUrl = photo;
            } else if (photo.startsWith('/')) {
              child.photoUrl = `http://160.120.143.20:8080${photo}`;
            } else {
              child.photoUrl = `data:image/jpeg;base64,${photo}`;
            }
          }

          await repo.save(child);
          importedCount++;
        }
      }

      return { message: 'Importation réussie', count: importedCount };
    } catch (error) {
      console.error(`Erreur lors de l'importation en masse`, error);
      throw new HttpException('Erreur lors de l\'importation en masse', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async resyncPhotos(accessToken?: string): Promise<{ updated: number }> {
    const repo = await this.getRepo();
    const allChildren = await repo.find();
    let updated = 0;

    for (const child of allChildren) {
      let needsUpdate = false;

      if (child.photoUrl && child.photoUrl.includes('160.120.143.20') && !child.photoUrl.includes(':8080')) {
        child.photoUrl = child.photoUrl.replace('http://160.120.143.20', 'http://160.120.143.20:8080');
        needsUpdate = true;
      }

      if (!child.photoUrl && child.empCode) {
        try {
          const response = await firstValueFrom(
            this.httpService.get<any>(
              this.urlSuperApp(`/employee/${child.empCode}`),
              this.enTetes(accessToken),
            ),
          );
          if (response.data && response.data.photo) {
            const photo: string = response.data.photo;
            if (photo.startsWith('http')) {
              child.photoUrl = photo;
            } else if (photo.startsWith('/')) {
              child.photoUrl = `http://160.120.143.20:8080${photo}`;
            }
            needsUpdate = true;
          }
        } catch (_err) {
          // Ignorer les erreurs de réseau silencieusement
        }
      }

      if (needsUpdate) {
        await repo.save(child);
        updated++;
      }
    }

    return { updated };
  }

  /**
   * Synchronise les noms de classes locaux vers les départements BioTime.
   */
  async syncClassesToBiotime(accessToken?: string): Promise<any> {
    if (!accessToken) {
      return { message: 'Jeton requis', created: [], existing: [] };
    }

    const repo = await this.getRepo();
    const children = await repo.find({ select: { className: true } });
    const classNames = [...new Set(children.map((c) => c.className).filter(Boolean))];

    if (classNames.length === 0) {
      return { message: 'Aucune classe à synchroniser', created: [], existing: [] };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.urlSuperApp('/sync-departments'),
          { classNames },
          this.enTetes(accessToken),
        ),
      );
      return response.data;
    } catch (err: any) {
      this.logger.warn(`[BioTime→] Sync des classes échouée : ${err.message}`);
      return { message: 'Synchronisation échouée', error: err.message };
    }
  }
}
