import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
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
    const parent = await repo.findOne({
      where: { id },
      relations: { children: true },
    });
    if (!parent) {
      throw new NotFoundException(`Parent ${id} introuvable.`);
    }
    return parent;
  }

  /** 4 chiffres, jamais '0000' (évident/faible) — voir CreateParentDto.pinCode. */
  private genererPinAleatoire(): string {
    let pin: string;
    do {
      pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    } while (pin === '0000');
    return pin;
  }

  async create(createParentDto: CreateParentDto): Promise<Parent> {
    const repo = await this.getRepo();
    const existing = await repo.findOne({
      where: { phone: createParentDto.phone },
    });
    if (existing) {
      throw new ConflictException(
        `Un parent avec ce numéro de téléphone existe déjà.`,
      );
    }
    const parent = repo.create({
      ...createParentDto,
      pinCode: createParentDto.pinCode || this.genererPinAleatoire(),
    });
    return repo.save(parent);
  }

  /**
   * Régénère le code PIN d'un parent (oublié, ou à révoquer après l'avoir
   * communiqué par un canal jugé compromis). Retourne le parent avec le
   * nouveau PIN en clair — jamais stocké ailleurs que dans `parents.pin_code`,
   * jamais journalisé.
   */
  async regeneratePin(id: string): Promise<Parent> {
    const repo = await this.getRepo();
    const parent = await this.findOne(id);
    parent.pinCode = this.genererPinAleatoire();
    return repo.save(parent);
  }

  async update(id: string, updateParentDto: UpdateParentDto): Promise<Parent> {
    const repo = await this.getRepo();
    const parent = await this.findOne(id);

    if (updateParentDto.phone && updateParentDto.phone !== parent.phone) {
      const existing = await repo.findOne({
        where: { phone: updateParentDto.phone },
      });
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
