import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaData } from '@app/database';

@Injectable()
export class MetaDataService {
  constructor(
    @InjectRepository(MetaData)
    private readonly metaDataRepository: Repository<MetaData>,
  ) {}

  async getCurrentVersion(): Promise<MetaData | null> {
    const versions = await this.metaDataRepository.find({
      order: { appliedAt: 'DESC' },
      take: 1,
    });
    return versions.length > 0 ? versions[0] : null;
  }
}
