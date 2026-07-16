import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingRecord, PaymentStatus } from '@app/database';
import { CreateBillingRecordDto } from './dto/create-billing-record.dto';
import { PaginationDto, PaginationResponseDto } from '@app/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillingRecord)
    private readonly billingRepository: Repository<BillingRecord>,
  ) {}

  async create(dto: CreateBillingRecordDto): Promise<BillingRecord> {
    const record = this.billingRepository.create({
      ...dto,
      invoiceNumber: `INV-${Date.now()}-${uuidv4().split('-')[0].toUpperCase()}`,
    });
    return this.billingRepository.save(record);
  }

  async findAll(pagination: PaginationDto): Promise<PaginationResponseDto<BillingRecord>> {
    const [data, total] = await this.billingRepository.findAndCount({
      skip: pagination.skip,
      take: pagination.limit,
      order: { createdAt: 'DESC' },
      relations: { organisation: true },
    });
    return new PaginationResponseDto(data, total, pagination.page ?? 1, pagination.limit ?? 10);
  }

  async findByOrganisation(organisationId: string): Promise<BillingRecord[]> {
    return this.billingRepository.find({
      where: { organisationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<BillingRecord> {
    const record = await this.billingRepository.findOne({
      where: { id },
      relations: { organisation: true },
    });
    if (!record) throw new NotFoundException(`Facture ${id} introuvable`);
    return record;
  }

  async markAsCompleted(id: string, transactionId: string): Promise<BillingRecord> {
    const record = await this.findOne(id);
    record.status = PaymentStatus.COMPLETED;
    record.transactionId = transactionId;
    return this.billingRepository.save(record);
  }

  async markAsFailed(id: string): Promise<BillingRecord> {
    const record = await this.findOne(id);
    record.status = PaymentStatus.FAILED;
    return this.billingRepository.save(record);
  }
}
