import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { BiotimeService } from './biotime.service';

/**
 * Worker des synchronisations BioTime.
 *
 * Chaque job porte l'école concernée : les serveurs BioTime étant propres à chaque
 * établissement, il n'existe pas de synchronisation « globale » par défaut.
 *
 * Concurrency = 2 : au plus 2 jobs simultanés. Les serveurs BioTime sont des
 * machines d'école modestes, on ne les sature pas.
 */
@Processor('biotime-sync', { concurrency: 2 })
export class BiotimeProcessor extends WorkerHost {
  private readonly logger = new Logger(BiotimeProcessor.name);

  constructor(private readonly biotimeService: BiotimeService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const organisationId: string | undefined = job.data?.organisationId;

    switch (job.name) {
      case 'sync-punches':
        if (!organisationId) {
          return this.biotimeService.syncToutesLesEcoles();
        }
        return this.biotimeService.syncPunches(organisationId, job.data?.depuis);

      case 'sync-children':
        if (!organisationId) {
          throw new Error("Le job 'sync-children' exige un organisationId.");
        }
        return this.biotimeService.syncChildren(organisationId);

      case 'push-child': {
        if (!organisationId) {
          throw new Error("Le job 'push-child' exige un organisationId.");
        }
        return this.biotimeService.pushChild(organisationId, job.data);
      }

      case 'push-children-batch': {
        if (!organisationId) {
          throw new Error("Le job 'push-children-batch' exige un organisationId.");
        }
        const enfants = job.data.enfants ?? [];
        this.logger.log(
          `[BullMQ] Début du push batch de ${enfants.length} enfant(s) pour l'école ${organisationId}`,
        );
        return this.biotimeService.pushChildrenBatch(organisationId, enfants);
      }

      case 'sync-departments':
        if (!organisationId) {
          throw new Error("Le job 'sync-departments' exige un organisationId.");
        }
        return this.biotimeService.syncDepartmentsFromClasses(
          organisationId,
          job.data.classNames ?? [],
        );

      default:
        throw new Error(`Job non supporté : ${job.name}`);
    }
  }
}
