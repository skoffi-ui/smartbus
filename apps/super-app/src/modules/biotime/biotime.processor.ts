import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { BiotimeService } from './biotime.service';

/**
 * Worker des synchronisations BioTime.
 *
 * Chaque job porte l'école concernée : les serveurs BioTime étant propres à chaque
 * établissement, il n'existe pas de synchronisation « globale » par défaut.
 */
@Processor('biotime-sync')
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
          // Déclenché par le planificateur : toutes les écoles configurées.
          return this.biotimeService.syncToutesLesEcoles();
        }
        return this.biotimeService.syncPunches(organisationId, job.data?.depuis);

      case 'sync-children':
        if (!organisationId) {
          throw new Error("Le job 'sync-children' exige un organisationId.");
        }
        return this.biotimeService.syncChildren(organisationId);

      default:
        throw new Error(`Job non supporté : ${job.name}`);
    }
  }
}
