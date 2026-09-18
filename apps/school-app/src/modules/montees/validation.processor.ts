import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MonteesService, VALIDATION_QUEUE } from './montees.service';

/**
 * Worker BullMQ qui consomme les jobs de la file `biotime_validations_queue`.
 * Il est le seul à exécuter la logique métier lourde (vérification GPS, alertes, etc.)
 * de manière asynchrone, sans bloquer les requêtes entrantes de la badgeuse.
 */
@Processor(VALIDATION_QUEUE)
export class ValidationProcessor extends WorkerHost {
  private readonly logger = new Logger(ValidationProcessor.name);

  constructor(private readonly monteesService: MonteesService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`[Worker] Traitement du job #${job.id} - Tentative ${job.attemptsMade + 1}`);
    try {
      await this.monteesService.processValidationJob(job.data);
      this.logger.log(`[Worker] Job #${job.id} traité avec succès`);
    } catch (error) {
      this.logger.error(`[Worker] Erreur sur le job #${job.id}: ${error.message}`);
      throw error; // BullMQ re-mettra en file pour un retry
    }
  }
}
