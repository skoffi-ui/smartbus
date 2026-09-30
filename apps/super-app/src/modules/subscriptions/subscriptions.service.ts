import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus } from '@app/database';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PaginationDto, PaginationResponseDto } from '@app/common';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  async create(dto: CreateSubscriptionDto): Promise<Subscription> {
    const sub = this.subscriptionRepository.create(dto);
    return this.subscriptionRepository.save(sub);
  }

  async findAll(
    pagination: PaginationDto,
  ): Promise<PaginationResponseDto<Subscription>> {
    const [data, total] = await this.subscriptionRepository.findAndCount({
      skip: pagination.skip,
      take: pagination.limit,
      order: { createdAt: 'DESC' },
      relations: { organisation: true },
    });
    return new PaginationResponseDto(
      data,
      total,
      pagination.page ?? 1,
      pagination.limit ?? 10,
    );
  }

  async findByOrganisation(organisationId: string): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { organisationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Subscription> {
    const sub = await this.subscriptionRepository.findOne({
      where: { id },
      relations: { organisation: true },
    });
    if (!sub) throw new NotFoundException(`Abonnement ${id} introuvable`);
    return sub;
  }

  async update(id: string, dto: UpdateSubscriptionDto): Promise<Subscription> {
    const sub = await this.findOne(id);
    Object.assign(sub, dto);
    return this.subscriptionRepository.save(sub);
  }

  async cancel(id: string): Promise<Subscription> {
    const sub = await this.findOne(id);
    sub.status = SubscriptionStatus.CANCELLED;
    return this.subscriptionRepository.save(sub);
  }

  async remove(id: string): Promise<void> {
    const sub = await this.findOne(id);
    await this.subscriptionRepository.remove(sub);
  }
}
