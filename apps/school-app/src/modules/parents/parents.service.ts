import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Parent } from '@app/database/tenant-entities/parent.entity';
import { hasherPinParent } from '@app/common/security/parent-pin';
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
    const parents = await repo.find({ order: { createdAt: 'DESC' } });
    return parents.map((parent) => this.sansPin(parent));
  }

  async findOne(id: string): Promise<Parent> {
    return this.sansPin(await this.charger(id));
  }

  private async charger(id: string): Promise<Parent> {
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

  /** La réponse HTTP ne doit jamais exposer le hash (espace de 4 chiffres, attaquable hors ligne). */
  private sansPin(parent: Parent): Parent {
    const copie = { ...parent } as Parent;
    delete (copie as { pinCode?: string }).pinCode;
    return copie;
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
    const pinClair = createParentDto.pinCode || this.genererPinAleatoire();
    const parent = repo.create({
      ...createParentDto,
      pinCode: await hasherPinParent(pinClair),
    });
    const enregistre = await repo.save(parent);
    // Une seule fois dans la réponse, pour que l'école le communique.
    // La ligne enregistrée ne contient que le hash.
    return { ...enregistre, pinCode: pinClair } as Parent;
  }

  /**
   * Régénère le code PIN d'un parent (oublié, ou à révoquer après l'avoir
   * communiqué par un canal jugé compromis). La base reçoit le hash bcrypt ;
   * le PIN en clair n'existe que dans cette réponse, jamais journalisé.
   */
  async regeneratePin(id: string): Promise<Parent> {
    const repo = await this.getRepo();
    const parent = await this.charger(id);
    const pinClair = this.genererPinAleatoire();
    parent.pinCode = await hasherPinParent(pinClair);
    const enregistre = await repo.save(parent);
    return { ...enregistre, pinCode: pinClair } as Parent;
  }

  async update(id: string, updateParentDto: UpdateParentDto): Promise<Parent> {
    const repo = await this.getRepo();
    const parent = await this.charger(id);

    if (updateParentDto.phone && updateParentDto.phone !== parent.phone) {
      const existing = await repo.findOne({
        where: { phone: updateParentDto.phone },
      });
      if (existing) {
        throw new ConflictException(`Ce numéro de téléphone est déjà utilisé.`);
      }
    }

    const { pinCode, ...reste } = updateParentDto;
    Object.assign(parent, reste);
    if (pinCode) {
      parent.pinCode = await hasherPinParent(pinCode);
    }
    const enregistre = await repo.save(parent);
    return this.sansPin(enregistre);
  }

  async remove(id: string): Promise<void> {
    const repo = await this.getRepo();
    const parent = await this.charger(id);
    await repo.remove(parent);
  }
}
