import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanTarif, SubscriptionPlan } from '@app/database';
import { UpdatePlanTarifDto } from './dto/update-plan-tarif.dto';

@Injectable()
export class PlanTarifsService {
  constructor(
    @InjectRepository(PlanTarif)
    private readonly repo: Repository<PlanTarif>,
  ) {}

  /** Les 5 forfaits, toujours dans le même ordre (croissant en prix). */
  async findAll(): Promise<PlanTarif[]> {
    return this.repo.find({ order: { pricePerMonth: 'ASC' } });
  }

  async findOne(plan: SubscriptionPlan): Promise<PlanTarif> {
    const tarif = await this.repo.findOne({ where: { plan } });
    if (!tarif) throw new NotFoundException(`Aucun tarif pour le forfait ${plan}.`);
    return tarif;
  }

  async update(plan: SubscriptionPlan, dto: UpdatePlanTarifDto): Promise<PlanTarif> {
    const tarif = await this.findOne(plan);
    Object.assign(tarif, dto);
    return this.repo.save(tarif);
  }
}
