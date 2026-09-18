import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BiotimeService } from './biotime.service';

@Processor('biotime-sync')
export class BiotimeProcessor extends WorkerHost {
  constructor(private readonly biotimeService: BiotimeService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'sync-punches':
        const dateStr = job.data?.dateStr;
        return await this.biotimeService.syncPunches(dateStr);
      case 'sync-children':
        return await this.biotimeService.syncChildren();
      default:
        throw new Error(`Job non supporté: ${job.name}`);
    }
  }
}
