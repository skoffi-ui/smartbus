import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Parent } from '@app/database/tenant-entities/parent.entity';
import { CreateParentDto, UpdateParentDto } from './dto/parents.dto';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class ParentsService {
  constructor(private readonly tenantService: TenantService) {}

  private async getRepo(): Promise<Repository<Parent>> {
    const dataSource = await this.tenantService.getDataSource();
    return dataSource.getRepository(Parent);
  }

  async findAll(): Promise<Parent[]> {
    const repo = await this.getRepo();
    return repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Parent> {
    const repo = await this.getRepo();
    const parent = await repo.findOne({ where: { id }, relations: { children: true } });
    if (!parent) {
      throw new NotFoundException(`Parent ${id} introuvable.`);
    }
    return parent;
  }

  async create(createParentDto: CreateParentDto): Promise<Parent> {
    const repo = await this.getRepo();
    const existing = await repo.findOne({ where: { phone: createParentDto.phone } });
    if (existing) {
      throw new ConflictException(`Un parent avec ce numéro de téléphone existe déjà.`);
    }
    const parent = repo.create(createParentDto);
    return repo.save(parent);
  }

  async update(id: string, updateParentDto: UpdateParentDto): Promise<Parent> {
    const repo = await this.getRepo();
    const parent = await this.findOne(id);
    
    if (updateParentDto.phone && updateParentDto.phone !== parent.phone) {
      const existing = await repo.findOne({ where: { phone: updateParentDto.phone } });
      if (existing) {
        throw new ConflictException(`Ce numéro de téléphone est déjà utilisé.`);
      }
    }

    Object.assign(parent, updateParentDto);
    return repo.save(parent);
  }

  async remove(id: string): Promise<void> {
    const repo = await this.getRepo();
    const parent = await this.findOne(id);
    await repo.remove(parent);
  }
}
